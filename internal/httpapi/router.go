// Package httpapi wires the HTTP surface of kern-ui: the ingestion endpoint fed by
// kern-orch, the SSE stream consumed by the browser, and the single-page app itself.
package httpapi

import (
	"encoding/json"
	"net/http"
	"os"
)

// Config holds the router's dependencies. A zero Config yields a router that answers
// /healthz and nothing else, which is what the bootstrap ships.
type Config struct {
	// WebDir is the directory holding the built single-page app. When empty, no static
	// files are served. The binary will embed this directory once the front-end build
	// exists; serving from disk keeps the bootstrap free of an empty embed pattern.
	WebDir string
}

// NewRouter builds the HTTP handler for kern-ui.
func NewRouter(cfg Config) http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /healthz", handleHealthz)

	if cfg.WebDir != "" {
		mux.Handle("GET /", http.FileServer(http.Dir(cfg.WebDir)))
	}

	return mux
}

func handleHealthz(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

func writeJSON(w http.ResponseWriter, status int, payload any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	if err := json.NewEncoder(w).Encode(payload); err != nil {
		// The status line is already sent; log and move on.
		os.Stderr.WriteString("kern-ui: encode response: " + err.Error() + "\n")
	}
}
