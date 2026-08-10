package main

import (
	"errors"
	"fmt"
	"net"
	"strings"
)

// exposure is everything that decides whether this server may listen where it was told to.
type exposure struct {
	addr          string
	producerToken string
	accounts      int
	// tls is true when this process serves TLS itself.
	tls bool
	// trustProxy is true when something in front terminates TLS and we were told so. It has
	// to be told: any client can forge the header that would otherwise reveal it.
	trustProxy bool
}

// checkExposure refuses to serve a public address unprotected.
//
// This is the one check that closes a hole rather than describing it. A warning in a log
// scrolls past on the first busy day, and an open API does not announce itself — the only
// failure nobody can miss is the process not starting. Local development keeps its
// frictionless path, because nothing off the machine can reach a loopback address anyway.
//
// Two things are checked, and the second is the one that arrived late: credentials, and
// whether they travel in clear. Asking for a password over plain http protects against a
// bystander and not against a network, which is the more dangerous of the two illusions.
func checkExposure(e exposure) error {
	if !isPublic(e.addr) {
		return nil
	}

	var missing []string
	if e.producerToken == "" {
		missing = append(missing, "KERN_UI_TOKEN (the secret a producer presents)")
	}
	if e.accounts == 0 {
		missing = append(missing, "KERN_UI_ACCOUNTS (a file with at least one account — see `kern-ui useradd`)")
	}
	if len(missing) > 0 {
		return fmt.Errorf(
			"refusing to listen on %s with no protection: set %s.\n"+
				"Anyone who can reach this address would read every mission and be able to inject false ones.\n"+
				"To run locally instead, leave KERN_UI_ADDR at 127.0.0.1:7777",
			e.addr, strings.Join(missing, " and "))
	}

	if !e.tls && !e.trustProxy {
		return fmt.Errorf(
			"refusing to serve %s over plain http: the password and the session would travel in clear,\n"+
				"so authenticating would protect against a bystander and not against a network.\n"+
				"Three ways forward:\n"+
				"  · serve TLS here — set KERN_UI_TLS_CERT and KERN_UI_TLS_KEY\n"+
				"  · put a reverse proxy in front that terminates TLS — then set KERN_UI_TRUST_PROXY=1\n"+
				"  · stay local — leave KERN_UI_ADDR at 127.0.0.1:7777",
			e.addr)
	}
	return nil
}

// checkTLSPair rejects half a certificate. Configuring one of the two is a mistake worth
// naming, rather than a plain-http deployment worth starting.
func checkTLSPair(certFile, keyFile string) error {
	switch {
	case certFile == "" && keyFile == "":
		return nil
	case certFile == "":
		return errors.New("KERN_UI_TLS_KEY is set without KERN_UI_TLS_CERT")
	case keyFile == "":
		return errors.New("KERN_UI_TLS_CERT is set without KERN_UI_TLS_KEY")
	}
	return nil
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
