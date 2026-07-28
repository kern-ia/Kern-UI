package auth

import (
	"testing"
	"time"
)

func TestASessionIdentifiesItsUserUntilItExpires(t *testing.T) {
	s := NewSessions(time.Hour)

	token, err := s.Issue("yoann")
	if err != nil {
		t.Fatalf("Issue: %v", err)
	}

	user, ok := s.User(token)
	if !ok || user != "yoann" {
		t.Errorf("User = %q, %v; want yoann, true", user, ok)
	}
}

func TestAnUnknownTokenIdentifiesNobody(t *testing.T) {
	s := NewSessions(time.Hour)
	_, _ = s.Issue("yoann")

	if _, ok := s.User("inventé"); ok {
		t.Error("an invented token was accepted")
	}
	if _, ok := s.User(""); ok {
		t.Error("an empty token was accepted")
	}
}

// Two sessions must never collide, and a token must not be guessable from another.
func TestEveryTokenIsDistinct(t *testing.T) {
	s := NewSessions(time.Hour)

	seen := make(map[string]bool)
	for i := 0; i < 200; i++ {
		token, err := s.Issue("yoann")
		if err != nil {
			t.Fatalf("Issue: %v", err)
		}
		if seen[token] {
			t.Fatal("the same token was issued twice")
		}
		if len(token) < 32 {
			t.Fatalf("token = %q, too short to resist guessing", token)
		}
		seen[token] = true
	}
}

func TestAnExpiredSessionIdentifiesNobody(t *testing.T) {
	s := NewSessions(time.Hour)
	token, _ := s.Issue("yoann")

	// Rather than sleeping: move the session's own clock past its expiry.
	s.now = func() time.Time { return time.Now().Add(2 * time.Hour) }

	if _, ok := s.User(token); ok {
		t.Error("an expired session still identified its user")
	}
}

// Logging out has to actually end the session, not merely drop the cookie: a token copied
// from the wire would otherwise keep working.
func TestRevokingASessionEndsIt(t *testing.T) {
	s := NewSessions(time.Hour)
	token, _ := s.Issue("yoann")

	s.Revoke(token)

	if _, ok := s.User(token); ok {
		t.Error("a revoked session still identified its user")
	}
}

// Sessions live in memory and die with the process, which is honest for a brick that holds
// nothing durable — but a long-lived one must not accumulate expired entries for ever.
func TestExpiredSessionsAreForgotten(t *testing.T) {
	s := NewSessions(time.Hour)
	for i := 0; i < 10; i++ {
		_, _ = s.Issue("yoann")
	}
	s.now = func() time.Time { return time.Now().Add(2 * time.Hour) }

	_, _ = s.Issue("yoann") // any use is an opportunity to sweep

	if got := s.count(); got != 1 {
		t.Errorf("the store holds %d sessions, want only the live one", got)
	}
}
