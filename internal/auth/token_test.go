package auth

import "testing"

func TestAProducerTokenMatchesOnlyItself(t *testing.T) {
	if !TokenMatches("s3cret", "s3cret") {
		t.Error("the configured token did not match itself")
	}
	if TokenMatches("s3cret", "autre") {
		t.Error("a different token matched")
	}
}

// The one that matters: an unconfigured token must refuse everything rather than accept
// everything. A missing secret is the most likely way this gets deployed wrong.
func TestAnUnconfiguredTokenMatchesNothing(t *testing.T) {
	if TokenMatches("", "") {
		t.Error("an empty configured token accepted an empty presented token")
	}
	if TokenMatches("", "n'importe quoi") {
		t.Error("an empty configured token accepted anything")
	}
}

func TestAnAbsentTokenNeverMatches(t *testing.T) {
	if TokenMatches("s3cret", "") {
		t.Error("presenting no token was accepted")
	}
}
