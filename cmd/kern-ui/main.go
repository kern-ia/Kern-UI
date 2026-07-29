// Command kern-ui serves the Kern interface: it ingests run transitions pushed by
// kern-orch and streams them to the browser.
package main

import (
	"bufio"
	"context"
	"crypto/tls"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"path/filepath"
	"strings"
	"syscall"
	"time"

	"github.com/yoann/kern-ui/internal/auth"
	"github.com/yoann/kern-ui/internal/httpapi"
	"github.com/yoann/kern-ui/internal/tools"
)

const shutdownGrace = 10 * time.Second

func main() {
	// One subcommand, because creating an account must never mean typing a hash by hand.
	if len(os.Args) > 1 && os.Args[1] == "useradd" {
		if err := useradd(os.Args[2:]); err != nil {
			fmt.Fprintln(os.Stderr, "kern-ui:", err)
			os.Exit(1)
		}
		return
	}

	if err := run(); err != nil {
		slog.Error("kern-ui stopped", "error", err)
		os.Exit(1)
	}
}

func run() error {
	addr := envOr("KERN_UI_ADDR", "127.0.0.1:7777")
	producerToken := os.Getenv("KERN_UI_TOKEN")
	certFile, keyFile := os.Getenv("KERN_UI_TLS_CERT"), os.Getenv("KERN_UI_TLS_KEY")
	trustProxy := os.Getenv("KERN_UI_TRUST_PROXY") != ""
	// kern-ui is the caller here, not the one being called: KERN_ORCH_URL/TOKEN are the
	// credential *we* present to kern-orch's daemon, the opposite direction from
	// KERN_UI_TOKEN above. Empty KERN_ORCH_URL leaves the Espace's tool source unconfigured
	// rather than pointed at nothing.
	orchURL := os.Getenv("KERN_ORCH_URL")
	orchToken := os.Getenv("KERN_ORCH_TOKEN")

	if err := checkTLSPair(certFile, keyFile); err != nil {
		return err
	}

	accounts, err := auth.LoadAccounts(envOr("KERN_UI_ACCOUNTS", defaultAccountsPath))
	if err != nil {
		return err
	}

	// Before the socket, not after: a server that has already bound the port has already
	// exposed whatever it was going to expose.
	if err := checkExposure(exposure{
		addr:          addr,
		producerToken: producerToken,
		accounts:      accounts.Len(),
		tls:           certFile != "",
		trustProxy:    trustProxy,
	}); err != nil {
		return err
	}
	if !isPublic(addr) && (producerToken == "" || accounts.Len() == 0) {
		slog.Info("kern-ui: running unauthenticated on a local address; " +
			"set KERN_UI_TOKEN and KERN_UI_ACCOUNTS before exposing it")
	}

	srv := &http.Server{
		Addr: addr,
		Handler: httpapi.NewRouter(httpapi.Config{
			WebDir:        os.Getenv("KERN_UI_WEB_DIR"),
			ProducerToken: producerToken,
			Accounts:      accounts,
			TrustProxy:    trustProxy,
			Tools:         &tools.Client{BaseURL: orchURL, Token: orchToken},
		}),
		ReadHeaderTimeout: 5 * time.Second,
		// TLS 1.2 is the floor: everything below it is broken, and everything that speaks
		// only below it is old enough that we would rather know.
		TLSConfig: &tls.Config{MinVersion: tls.VersionTLS12},
	}

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	errc := make(chan error, 1)
	go func() {
		serving := "http"
		if certFile != "" {
			serving = "https"
		}
		slog.Info("kern-ui listening", "addr", addr, "scheme", serving, "behind_proxy", trustProxy)

		var err error
		if certFile != "" {
			err = srv.ListenAndServeTLS(certFile, keyFile)
		} else {
			err = srv.ListenAndServe()
		}
		if err != nil && !errors.Is(err, http.ErrServerClosed) {
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

// defaultAccountsPath is where accounts live unless KERN_UI_ACCOUNTS says otherwise.
const defaultAccountsPath = "./data/accounts"

// useradd appends an account, prompting for the password on standard input.
//
// The password is never an argument: it would land in the shell history and in the process
// list, where anyone on the machine can read it. Reading it from stdin also means the
// command composes with a secret manager.
func useradd(args []string) error {
	if len(args) != 1 || strings.TrimSpace(args[0]) == "" {
		return errors.New("usage: kern-ui useradd <name>   (the password is read from stdin)")
	}
	name := strings.TrimSpace(args[0])
	if strings.ContainsAny(name, ":\n") {
		return errors.New("a name cannot contain `:` or a newline: those separate the file")
	}

	path := envOr("KERN_UI_ACCOUNTS", defaultAccountsPath)
	existing, err := auth.LoadAccounts(path)
	if err != nil {
		return err
	}
	if existing.Has(name) {
		return fmt.Errorf("%q already has an account in %s", name, path)
	}

	fmt.Fprintf(os.Stderr, "Password for %s: ", name)
	password, err := readPassword(os.Stdin)
	if err != nil {
		return err
	}

	hash, err := auth.HashPassword(password)
	if err != nil {
		return err
	}

	if dir := filepath.Dir(path); dir != "" {
		if err := os.MkdirAll(dir, 0o700); err != nil {
			return err
		}
	}
	// 0600: the file holds password hashes, and nobody else on the machine needs them.
	file, err := os.OpenFile(path, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0o600)
	if err != nil {
		return err
	}
	defer file.Close()

	if _, err := fmt.Fprintf(file, "%s:%s\n", name, hash); err != nil {
		return err
	}
	fmt.Fprintf(os.Stderr, "\naccount %q added to %s\n", name, path)
	return nil
}

// readPassword takes one line, refusing an empty one.
func readPassword(in io.Reader) (string, error) {
	scanner := bufio.NewScanner(in)
	if !scanner.Scan() {
		if err := scanner.Err(); err != nil {
			return "", err
		}
		return "", errors.New("no password on standard input")
	}
	password := strings.TrimRight(scanner.Text(), "\r\n")
	if password == "" {
		return "", errors.New("the password is empty")
	}
	return password, nil
}
