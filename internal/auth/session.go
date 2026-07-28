package auth

import (
	"crypto/rand"
	"encoding/base64"
	"fmt"
	"sync"
	"time"
)

// tokenBytes is the entropy behind a session token. 256 bits is not guessable.
const tokenBytes = 32

// Sessions holds the browser sessions currently open.
//
// In memory, and gone when the process stops. That is the honest storage for a brick that
// keeps nothing durable: losing them costs everyone a login, which is the same price as any
// other restart here. It also means a session cannot outlive a deployment, which is a
// property rather than a limitation.
type Sessions struct {
	ttl time.Duration

	mu     sync.Mutex
	open   map[string]session
	now    func() time.Time
	issued int
}

type session struct {
	user    string
	expires time.Time
}

// NewSessions returns a store whose sessions last ttl.
func NewSessions(ttl time.Duration) *Sessions {
	return &Sessions{
		ttl:  ttl,
		open: make(map[string]session),
		now:  time.Now,
	}
}

// Issue opens a session for user and returns its token.
func (s *Sessions) Issue(user string) (string, error) {
	raw := make([]byte, tokenBytes)
	if _, err := rand.Read(raw); err != nil {
		return "", fmt.Errorf("auth: read random token: %w", err)
	}
	token := base64.RawURLEncoding.EncodeToString(raw)

	s.mu.Lock()
	defer s.mu.Unlock()

	// Any use is an opportunity to sweep: no goroutine, no timer, nothing to stop.
	s.forgetExpired()
	s.open[token] = session{user: user, expires: s.now().Add(s.ttl)}
	return token, nil
}

// User returns whose session this is, and whether it is still open.
func (s *Sessions) User(token string) (string, bool) {
	if token == "" {
		return "", false
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	open, ok := s.open[token]
	if !ok || !s.now().Before(open.expires) {
		return "", false
	}
	return open.user, true
}

// Revoke ends a session. Logging out must end it here, not merely drop the cookie: a token
// copied off the wire would otherwise keep working until it expired.
func (s *Sessions) Revoke(token string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	delete(s.open, token)
}

// forgetExpired drops sessions past their expiry. Called under the lock.
func (s *Sessions) forgetExpired() {
	now := s.now()
	for token, open := range s.open {
		if !now.Before(open.expires) {
			delete(s.open, token)
		}
	}
}

// count is for tests: how many sessions the store is holding.
func (s *Sessions) count() int {
	s.mu.Lock()
	defer s.mu.Unlock()
	return len(s.open)
}
