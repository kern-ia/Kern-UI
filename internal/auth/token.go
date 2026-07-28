package auth

import "crypto/subtle"

// TokenMatches reports whether a producer presented the configured secret.
//
// An unconfigured secret matches **nothing**, including an empty presented token. That is
// the case worth being deliberate about: forgetting to set the secret is the most likely way
// this gets deployed wrong, and the failure has to be "nobody can post" rather than "anybody
// can". The server refuses to start in that situation anyway; this is the second lock.
//
// The comparison is constant time, so a caller cannot learn the secret one character at a
// time from how long a rejection takes.
func TokenMatches(configured, presented string) bool {
	if configured == "" || presented == "" {
		return false
	}
	return subtle.ConstantTimeCompare([]byte(configured), []byte(presented)) == 1
}
