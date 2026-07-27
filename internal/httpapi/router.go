// Package httpapi wires the HTTP surface of kern-ui: the ingestion endpoint fed by
// kern-orch, the SSE stream consumed by the browser, and the single-page app itself.
package httpapi

import (
	"encoding/json"
	"log/slog"
	"net/http"
	"time"

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
	mux.HandleFunc("GET /healthz", handleHealthz)
	mux.HandleFunc("POST /api/v1/steps", s.handleIngestStep)
	mux.HandleFunc("POST /api/v1/runs/{id}/steps", s.handleIngestStep)
	mux.HandleFunc("GET /api/v1/runs", s.handleListRuns)
	mux.HandleFunc("GET /api/v1/runs/{id}", s.handleGetRun)
	mux.HandleFunc("GET /api/v1/stream", s.handleStream)
	mux.HandleFunc("POST /api/v1/registry", s.handlePublishRegistry)
	mux.HandleFunc("GET /api/v1/registry", s.handleGetRegistry)

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
