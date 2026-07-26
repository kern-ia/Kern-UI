// Command kern-ui serves the Kern interface: it ingests run transitions pushed by
// kern-orch and streams them to the browser.
package main

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/yoann/kern-ui/internal/httpapi"
)

const shutdownGrace = 10 * time.Second

func main() {
	if err := run(); err != nil {
		slog.Error("kern-ui stopped", "error", err)
		os.Exit(1)
	}
}

func run() error {
	addr := envOr("KERN_UI_ADDR", "127.0.0.1:7777")

	srv := &http.Server{
		Addr:              addr,
		Handler:           httpapi.NewRouter(httpapi.Config{WebDir: os.Getenv("KERN_UI_WEB_DIR")}),
		ReadHeaderTimeout: 5 * time.Second,
	}

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	errc := make(chan error, 1)
	go func() {
		slog.Info("kern-ui listening", "addr", addr)
		if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			errc <- err
			return
		}
		errc <- nil
	}()

	select {
	case err := <-errc:
		return err
	case <-ctx.Done():
		slog.Info("shutting down")
		shutdownCtx, cancel := context.WithTimeout(context.Background(), shutdownGrace)
		defer cancel()
		return srv.Shutdown(shutdownCtx)
	}
}

func envOr(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
