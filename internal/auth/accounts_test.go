package auth

import (
	"os"
	"path/filepath"
	"testing"
)

func accountsFile(t *testing.T, lines string) string {
	t.Helper()
	path := filepath.Join(t.TempDir(), "accounts")
	if err := os.WriteFile(path, []byte(lines), 0o600); err != nil {
		t.Fatal(err)
	}
	return path
}

func TestAnAccountAuthenticatesWithItsPassword(t *testing.T) {
	hash, _ := HashPassword("le bon mot de passe")
	store, err := LoadAccounts(accountsFile(t, "yoann:"+hash+"\n"))
	if err != nil {
		t.Fatalf("LoadAccounts: %v", err)
	}

	if !store.Authenticate("yoann", "le bon mot de passe") {
		t.Error("the right password was refused")
	}
	if store.Authenticate("yoann", "le mauvais") {
		t.Error("the wrong password was accepted")
	}
	if store.Authenticate("quelquun", "le bon mot de passe") {
		t.Error("an unknown account was accepted")
	}
}

// A missing file is not an error: it is a server nobody can log into yet, which the startup
// checks turn into a refusal to listen on a public address. Treating it as a crash would
// make first setup harder for no gain in safety.
func TestAMissingFileYieldsAnEmptyStore(t *testing.T) {
	store, err := LoadAccounts(filepath.Join(t.TempDir(), "absent"))
	if err != nil {
		t.Fatalf("LoadAccounts: %v", err)
	}
	if store.Len() != 0 {
		t.Errorf("Len = %d, want 0", store.Len())
	}
	if store.Authenticate("qui", "que") {
		t.Error("an empty store authenticated somebody")
	}
}

func TestCommentsAndBlankLinesAreIgnored(t *testing.T) {
	hash, _ := HashPassword("x")
	store, err := LoadAccounts(accountsFile(t,
		"# des comptes\n\nyoann:"+hash+"\n\n   \n"))
	if err != nil {
		t.Fatalf("LoadAccounts: %v", err)
	}
	if store.Len() != 1 {
		t.Errorf("Len = %d, want 1", store.Len())
	}
}

// A line the parser cannot read must stop the server, not be skipped. Skipping it would
// silently remove somebody's access, or worse, leave a half-loaded file looking healthy.
func TestAMalformedLineIsAnError(t *testing.T) {
	cases := map[string]string{
		"no separator": "yoannpasdehash\n",
		"no name":      ":unhash\n",
		"no hash":      "yoann:\n",
	}
	for name, line := range cases {
		t.Run(name, func(t *testing.T) {
			if _, err := LoadAccounts(accountsFile(t, line)); err == nil {
				t.Error("a malformed line was accepted")
			}
		})
	}
}

func TestADuplicateAccountIsAnError(t *testing.T) {
	hash, _ := HashPassword("x")
	_, err := LoadAccounts(accountsFile(t, "yoann:"+hash+"\nyoann:"+hash+"\n"))
	if err == nil {
		t.Error("the same name twice was accepted; which one wins would be a guess")
	}
}

// Timing must not reveal which accounts exist: an unknown name has to cost what a wrong
// password costs, or the login page becomes a list of employees.
func TestAnUnknownAccountStillCostsAVerification(t *testing.T) {
	hash, _ := HashPassword("x")
	store, _ := LoadAccounts(accountsFile(t, "yoann:"+hash+"\n"))

	if store.Authenticate("inconnu", "x") {
		t.Fatal("an unknown account authenticated")
	}
	if !store.verifiedDecoy {
		t.Error("an unknown name returned without hashing; the response time reveals it exists")
	}
}
