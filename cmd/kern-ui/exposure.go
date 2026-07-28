package main

import (
	"fmt"
	"net"
	"strings"
)

// checkExposure refuses to serve a public address without credentials.
//
// This is the one check that closes the hole rather than describing it. A warning in a log
// scrolls past on the first busy day, and an open API does not announce itself — the only
// failure nobody can miss is the process not starting. Local development keeps its
// frictionless path, because nothing off the machine can reach a loopback address anyway.
func checkExposure(addr, producerToken string, accounts int) error {
	if !isPublic(addr) {
		return nil
	}

	var missing []string
	if producerToken == "" {
		missing = append(missing, "KERN_UI_TOKEN (the secret a producer presents)")
	}
	if accounts == 0 {
		missing = append(missing, "KERN_UI_ACCOUNTS (a file with at least one account — see `kern-ui useradd`)")
	}
	if len(missing) == 0 {
		return nil
	}

	return fmt.Errorf(
		"refusing to listen on %s with no protection: set %s.\n"+
			"Anyone who can reach this address would read every mission and be able to inject false ones.\n"+
			"To run locally instead, leave KERN_UI_ADDR at 127.0.0.1:7777",
		addr, strings.Join(missing, " and "))
}

// exposureWarning returns what an operator should know but which does not justify refusing
// to start. TLS is a deployment decision — a reverse proxy usually terminates it — so this
// says its piece and gets out of the way. It must never be silent.
func exposureWarning(addr string) string {
	if !isPublic(addr) {
		return ""
	}
	return "serving a public address over plain http: passwords and sessions travel in clear. " +
		"Put TLS in front of this before anyone logs in over a network."
}

// isPublic reports whether addr can be reached from another machine.
//
// An empty host is the trap: `:7777` reads as innocent and binds every interface.
func isPublic(addr string) bool {
	host, _, err := net.SplitHostPort(addr)
	if err != nil {
		host = addr
	}
	host = strings.Trim(host, "[]")

	switch host {
	case "":
		return true // every interface
	case "localhost":
		return false
	}
	if ip := net.ParseIP(host); ip != nil {
		return !ip.IsLoopback()
	}
	// A hostname we cannot judge: assume it resolves somewhere reachable.
	return true
}
