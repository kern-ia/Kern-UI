// Package httpapi wires the HTTP surface of kern-ui: the ingestion endpoint fed by
// kern-orch, the SSE stream consumed by the browser, and the single-page app itself.
package httpapi

import (
	"encoding/json"
	"log/slog"
	"net/http"
	"time"

	"github.com/yoann/kern-ui/internal/auth"
	"github.com/yoann/kern-ui/internal/projection"
	"github.com/yoann/kern-ui/internal/registry"
	"github.com/yoann/kern-ui/internal/stream"
)

// defaultHeartbeat keeps idle SSE connections alive through proxies that would otherwise
// close them.
const defaultHeartbeat = 25 * time.Second

// subscriberBuffer is how many run updates a browser may lag behind before the hub starts
// dropping them for that connection. The snapshot sent on connect is what makes dropping
// safe.
const subscriberBuffer = 64

// sessionLifetime is how long a browser stays logged in. A working day, so nobody is thrown
// out mid-task, and nobody stays logged in over a weekend on a shared machine.
const sessionLifetime = 12 * time.Hour

// Config holds the router's dependencies. The zero value is usable: missing dependencies
// are created on first use, and NewRouterWithDeps hands them back to the caller.
type Config struct {
	// WebDir is the directory holding the built single-page app. When empty, no static
	// files are served. The binary will embed this directory once the front-end build
	// exists; serving from disk keeps the bootstrap free of an empty embed pattern.
	WebDir string

	// Runs is the projection fed by the ingestion endpoint.
	Runs *projection.Projection

	// Hub broadcasts every run change to the connected browsers.
	Hub *stream.Hub[projection.Run]

	// Registry is the skills catalogue published by kern-orch. It rides its own endpoint
	// rather than the run stream: it changes when skills are installed, not when a graph
	// advances, and the browser fetches it when the Grimoire opens.
	Registry *registry.Store

	// Heartbeat is the interval between SSE keep-alive comments. Defaults to 25s.
	Heartbeat time.Duration

	// ProducerToken is the secret a producer presents to post events. **Empty leaves the
	// ingestion endpoints open**, which is what local development wants and what a public
	// address must never have — `cmd/kern-ui` refuses to listen on one without it.
	ProducerToken string

	// Accounts are the people who may read. **An empty store leaves the read endpoints
	// open**, same reasoning and same refusal at startup.
	Accounts *auth.Accounts

	// Sessions holds the browser sessions. Created on first use.
	Sessions *auth.Sessions
}

func (c *Config) fillDefaults() {
	if c.Runs == nil {
		c.Runs = projection.New()
	}
	if c.Hub == nil {
		c.Hub = stream.NewHub[projection.Run](subscriberBuffer)
	}
	if c.Registry == nil {
		c.Registry = registry.New()
	}
	if c.Sessions == nil {
		c.Sessions = auth.NewSessions(sessionLifetime)
	}
	if c.Heartbeat <= 0 {
		c.Heartbeat = defaultHeartbeat
	}
}

// NewRouter builds the HTTP handler for kern-ui.
func NewRouter(cfg Config) http.Handler {
	return NewRouterWithDeps(&cfg)
}

// NewRouterWithDeps behaves like NewRouter but fills cfg in place, so the caller keeps a
// handle on the dependencies the router ended up using.
func NewRouterWithDeps(cfg *Config) http.Handler {
	cfg.fillDefaults()
	s := &server{cfg: cfg}

	mux := http.NewServeMux()

	// Open: a liveness probe carries no credential, and the login page has to be reachable
	// before anyone has a session.
	mux.HandleFunc("GET /healthz", handleHealthz)
	mux.HandleFunc("POST /api/v1/login", s.handleLogin)
	mux.HandleFunc("POST /api/v1/logout", s.handleLogout)
	mux.HandleFunc("GET /api/v1/session", s.handleSession)

	// Producers post; they never read.
	mux.HandleFunc("POST /api/v1/steps", s.requireProducer(s.handleIngestStep))
	mux.HandleFunc("POST /api/v1/runs/{id}/steps", s.requireProducer(s.handleIngestStep))
	mux.HandleFunc("POST /api/v1/activity", s.requireProducer(s.handleIngestActivity))
	mux.HandleFunc("POST /api/v1/registry", s.requireProducer(s.handlePublishRegistry))

	// People read; they never post events.
	mux.HandleFunc("GET /api/v1/runs", s.requireSession(s.handleListRuns))
	mux.HandleFunc("GET /api/v1/runs/{id}", s.requireSession(s.handleGetRun))
	mux.HandleFunc("GET /api/v1/stream", s.requireSession(s.handleStream))
	mux.HandleFunc("GET /api/v1/registry", s.requireSession(s.handleGetRegistry))

	if cfg.WebDir != "" {
		mux.Handle("GET /", http.FileServer(http.Dir(cfg.WebDir)))
	}

	return mux
}

type server struct {
	cfg *Config
}

func handleHealthz(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

func writeJSON(w http.ResponseWriter, status int, payload any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	if err := json.NewEncoder(w).Encode(payload); err != nil {
		// The status line is already sent; there is nothing left to tell the client.
		slog.Error("encode response", "error", err)
	}
}

func writeError(w http.ResponseWriter, status int, message string) {
	writeJSON(w, status, map[string]string{"error": message})
}
