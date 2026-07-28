// Package auth holds what kern-ui needs to know who is calling: password hashing, producer
// tokens, and browser sessions.
//
// It uses nothing but the standard library, which is the reason PBKDF2 appears here rather
// than argon2id or bcrypt. Those resist purpose-built cracking hardware better and would be
// the better choice on their own merits; each costs kern-ui its first dependency, and this
// binary being pure-stdlib is what makes one `GOOS`/`GOARCH` command produce five targets.
// PBKDF2-HMAC-SHA256 at the iteration count below is a option OWASP still recommends, so the
// trade is defensible — but it is a trade. Revisit it the day a hash database could leak.
package auth

import (
	"crypto/pbkdf2"
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/base64"
	"errors"
	"fmt"
	"strconv"
	"strings"
)

const (
	algorithm = "pbkdf2-sha256"
	// iterations is what OWASP recommends for PBKDF2-HMAC-SHA256. Raising it later is safe:
	// every hash records the count it was made with, so old accounts keep verifying.
	iterations = 600_000
	saltLength = 16
	keyLength  = 32
)

// ErrEmptyPassword reports a password that cannot be a credential.
var ErrEmptyPassword = errors.New("auth: the password is empty")

// HashPassword returns the encoded form to store: algorithm, cost, salt and digest, so a
// stored hash stays verifiable after the cost is raised.
func HashPassword(password string) (string, error) {
	if password == "" {
		return "", ErrEmptyPassword
	}

	salt := make([]byte, saltLength)
	if _, err := rand.Read(salt); err != nil {
		return "", fmt.Errorf("auth: read random salt: %w", err)
	}

	digest, err := pbkdf2.Key(sha256.New, password, salt, iterations, keyLength)
	if err != nil {
		return "", fmt.Errorf("auth: derive key: %w", err)
	}

	return strings.Join([]string{
		algorithm,
		strconv.Itoa(iterations),
		base64.RawStdEncoding.EncodeToString(salt),
		base64.RawStdEncoding.EncodeToString(digest),
	}, "$"), nil
}

// VerifyPassword reports whether password matches the encoded hash.
//
// It fails closed on anything it cannot parse. A corrupted or truncated accounts file must
// lock everyone out, never let everyone in.
func VerifyPassword(encoded, password string) bool {
	parts := strings.Split(encoded, "$")
	if len(parts) != 4 || parts[0] != algorithm {
		return false
	}

	count, err := strconv.Atoi(parts[1])
	if err != nil || count <= 0 {
		return false
	}
	salt, err := base64.RawStdEncoding.DecodeString(parts[2])
	if err != nil || len(salt) == 0 {
		return false
	}
	want, err := base64.RawStdEncoding.DecodeString(parts[3])
	if err != nil || len(want) == 0 {
		return false
	}

	got, err := pbkdf2.Key(sha256.New, password, salt, count, len(want))
	if err != nil {
		return false
	}
	// Constant time: a comparison that returns early leaks how much of the digest matched.
	return subtle.ConstantTimeCompare(got, want) == 1
}
