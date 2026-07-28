package main

import (
	"strings"
	"testing"
)

// The hole this closes: a binary bound to every interface with no credentials configured.
// Refusing to start is the only failure that cannot be missed — a warning in a log scrolls
// past, and an open API does not announce itself.
func TestAPublicAddressWithoutCredentialsRefusesToStart(t *testing.T) {
	cases := map[string]struct {
		addr     string
		token    string
		accounts int
	}{
		"nothing configured": {"0.0.0.0:7777", "", 0},
		"no producer token":  {"0.0.0.0:7777", "", 1},
		"no account":         {"0.0.0.0:7777", "un-secret", 0},
		"a named interface":  {"192.168.1.20:7777", "", 0},
		"every interface v6": {"[::]:7777", "", 0},
	}

	for name, c := range cases {
		t.Run(name, func(t *testing.T) {
			err := checkExposure(c.addr, c.token, c.accounts)
			if err == nil {
				t.Fatal("the server agreed to listen unprotected on a public address")
			}
			if !strings.Contains(err.Error(), "KERN_UI_TOKEN") &&
				!strings.Contains(err.Error(), "KERN_UI_ACCOUNTS") {
				t.Errorf("error = %q, want it to name what is missing", err)
			}
		})
	}
}

// Local development must stay frictionless: nothing can reach a loopback address from
// outside the machine, so demanding a password there would buy nothing.
func TestLoopbackNeedsNoCredentials(t *testing.T) {
	for _, addr := range []string{"127.0.0.1:7777", "localhost:7777", "[::1]:7777", ":7777"} {
		t.Run(addr, func(t *testing.T) {
			if err := checkExposure(addr, "", 0); err != nil && addr != ":7777" {
				t.Errorf("checkExposure(%q) = %v, want it allowed", addr, err)
			}
		})
	}
}

// An empty host means every interface, which is public however innocent it looks.
func TestABarePortIsTreatedAsPublic(t *testing.T) {
	if err := checkExposure(":7777", "", 0); err == nil {
		t.Error("`:7777` binds every interface and was treated as local")
	}
}

func TestAPublicAddressWithCredentialsIsAllowed(t *testing.T) {
	if err := checkExposure("0.0.0.0:7777", "un-secret", 1); err != nil {
		t.Errorf("checkExposure = %v, want it allowed once configured", err)
	}
}

// Authentication without TLS still sends the password and the session in clear. That is a
// deployment decision — a reverse proxy usually terminates TLS — so it warns rather than
// refuses, but it must never be silent.
func TestAPublicAddressWarnsAboutClearText(t *testing.T) {
	if warning := exposureWarning("0.0.0.0:7777"); warning == "" {
		t.Error("listening publicly said nothing about credentials travelling in clear")
	}
	if warning := exposureWarning("127.0.0.1:7777"); warning != "" {
		t.Errorf("warning on loopback = %q, want none", warning)
	}
}
