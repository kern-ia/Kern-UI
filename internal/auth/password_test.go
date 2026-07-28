package auth

import (
	"strings"
	"testing"
)

func TestAPasswordVerifiesAgainstItsOwnHash(t *testing.T) {
	hash, err := HashPassword("un mot de passe correct")
	if err != nil {
		t.Fatalf("HashPassword: %v", err)
	}

	if !VerifyPassword(hash, "un mot de passe correct") {
		t.Error("the password does not verify against its own hash")
	}
	if VerifyPassword(hash, "un autre mot de passe") {
		t.Error("a different password verified")
	}
}

// Two accounts with the same password must not share a hash, or one leaked hash would
// reveal every account that chose that password.
func TestTheSamePasswordHashesDifferentlyEveryTime(t *testing.T) {
	first, _ := HashPassword("identique")
	second, _ := HashPassword("identique")

	if first == second {
		t.Error("the same password produced the same hash — the salt is missing or fixed")
	}
	if !VerifyPassword(first, "identique") || !VerifyPassword(second, "identique") {
		t.Error("both hashes must still verify")
	}
}

// The encoded form has to say how it was produced, or raising the cost later would
// invalidate every existing account.
func TestTheHashCarriesItsParameters(t *testing.T) {
	hash, _ := HashPassword("peu importe")

	parts := strings.Split(hash, "$")
	if len(parts) != 4 {
		t.Fatalf("hash = %q, want algorithm$iterations$salt$digest", hash)
	}
	if parts[0] != "pbkdf2-sha256" {
		t.Errorf("algorithm = %q, want it named in the hash", parts[0])
	}
	if parts[1] == "" {
		t.Error("the iteration count is not recorded")
	}
}

// A malformed or truncated hash must fail closed. Returning true on something unparseable
// would turn a corrupted accounts file into an open door.
func TestAnUnusableHashNeverVerifies(t *testing.T) {
	cases := map[string]string{
		"empty":              "",
		"not encoded":        "motdepasse",
		"missing fields":     "pbkdf2-sha256$600000",
		"unknown algorithm":  "md5$1$c2VsCg==$aGFzaAo=",
		"bad base64":         "pbkdf2-sha256$600000$!!!$!!!",
		"zero iterations":    "pbkdf2-sha256$0$c2VsCg==$aGFzaAo=",
		"negative iteration": "pbkdf2-sha256$-1$c2VsCg==$aGFzaAo=",
	}

	for name, hash := range cases {
		t.Run(name, func(t *testing.T) {
			if VerifyPassword(hash, "n'importe quoi") {
				t.Error("verified against an unusable hash")
			}
			if VerifyPassword(hash, "") {
				t.Error("verified against an unusable hash with an empty password")
			}
		})
	}
}

// An empty password is a configuration accident, never a credential.
func TestAnEmptyPasswordIsRefused(t *testing.T) {
	if _, err := HashPassword(""); err == nil {
		t.Error("hashing an empty password was accepted")
	}
}

// The cost is the whole point of a password hash: a fast one is a broken one.
func TestTheIterationCountIsNotLowered(t *testing.T) {
	if iterations < 600_000 {
		t.Errorf("iterations = %d, below the 600000 OWASP recommends for PBKDF2-HMAC-SHA256",
			iterations)
	}
}
