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
			err := checkExposure(exposure{addr: c.addr, producerToken: c.token, accounts: c.accounts, trustProxy: true})
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
			if err := checkExposure(exposure{addr: addr}); err != nil && addr != ":7777" {
				t.Errorf("checkExposure(%q) = %v, want it allowed", addr, err)
			}
		})
	}
}

// An empty host means every interface, which is public however innocent it looks.
func TestABarePortIsTreatedAsPublic(t *testing.T) {
	if err := checkExposure(exposure{addr: ":7777"}); err == nil {
		t.Error("`:7777` binds every interface and was treated as local")
	}
}

func TestAPublicAddressWithCredentialsIsAllowed(t *testing.T) {
	if err := checkExposure(exposure{addr: "0.0.0.0:7777", producerToken: "un-secret", accounts: 1, trustProxy: true}); err != nil {
		t.Errorf("checkExposure = %v, want it allowed once configured", err)
	}
}

// Authentication without TLS protects against a bystander, not against a network: the
// password and the session go out in clear. Same reasoning as the credentials themselves —
// a warning scrolls past, so this refuses.
func TestAPublicAddressInPlainTextRefusesToStart(t *testing.T) {
	err := checkExposure(exposure{
		addr: "0.0.0.0:7777", producerToken: "un-secret", accounts: 1,
	})
	if err == nil {
		t.Fatal("the server agreed to serve credentials in clear on a public address")
	}
	// It must say all three ways out, or it is a wall rather than a guardrail.
	for _, way := range []string{"KERN_UI_TLS_CERT", "KERN_UI_TRUST_PROXY", "127.0.0.1"} {
		if !strings.Contains(err.Error(), way) {
			t.Errorf("error does not mention %s:\n%s", way, err)
		}
	}
}

func TestServingTLSDirectlyIsAllowed(t *testing.T) {
	err := checkExposure(exposure{
		addr: "0.0.0.0:7777", producerToken: "un-secret", accounts: 1, tls: true,
	})
	if err != nil {
		t.Errorf("checkExposure = %v, want it allowed when serving TLS", err)
	}
}

// A reverse proxy terminating TLS is a legitimate deployment, and the only way we can know
// is being told. Telling us is therefore an explicit, deliberate act.
func TestATrustedProxyIsAllowed(t *testing.T) {
	err := checkExposure(exposure{
		addr: "0.0.0.0:7777", producerToken: "un-secret", accounts: 1, trustProxy: true,
	})
	if err != nil {
		t.Errorf("checkExposure = %v, want it allowed behind a trusted proxy", err)
	}
}

// Local development keeps needing nothing at all.
func TestLoopbackNeedsNoTLS(t *testing.T) {
	if err := checkExposure(exposure{addr: "127.0.0.1:7777"}); err != nil {
		t.Errorf("checkExposure = %v, want loopback allowed bare", err)
	}
}

// Half a certificate is a configuration mistake, not a plain-http deployment: saying so
// beats starting up unencrypted and leaving somebody to wonder why.
func TestHalfACertificateIsRefused(t *testing.T) {
	if err := checkTLSPair("cert.pem", ""); err == nil {
		t.Error("a certificate without its key was accepted")
	}
	if err := checkTLSPair("", "key.pem"); err == nil {
		t.Error("a key without its certificate was accepted")
	}
	if err := checkTLSPair("", ""); err != nil {
		t.Errorf("neither configured = %v, want no error", err)
	}
	if err := checkTLSPair("cert.pem", "key.pem"); err != nil {
		t.Errorf("both configured = %v, want no error", err)
	}
}
