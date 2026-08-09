package auth

import (
	"bufio"
	"fmt"
	"os"
	"sort"
	"strings"
	"sync"
)

// Accounts holds who may log in, read from a file of `name:hash` lines.
//
// A file rather than a database, because it is the only durable thing kern-ui owns and a
// dependency for six lines of storage would be a poor trade. Hashes are written by
// `kern-ui useradd`, never by hand: getting a password hash right is exactly the kind of
// thing nobody should do in a text editor.
type Accounts struct {
	byName map[string]string

	// verifiedDecoy records that an unknown name still cost a verification. Test-only.
	mu            sync.Mutex
	verifiedDecoy bool
}

// decoyHash is verified against when the name is unknown, so an unknown account costs the
// same time as a wrong password. Without it, login latency is a directory of employees.
var decoyHash, _ = HashPassword("un mot de passe qui n'est celui de personne")

// LoadAccounts reads the accounts file. A missing file yields an empty store: that is a
// server nobody can log into yet, which the startup checks turn into a refusal to listen on
// a public address.
func LoadAccounts(path string) (*Accounts, error) {
	store := &Accounts{byName: make(map[string]string)}

	file, err := os.Open(path)
	if os.IsNotExist(err) {
		return store, nil
	}
	if err != nil {
		return nil, fmt.Errorf("auth: open %q: %w", path, err)
	}
	defer file.Close()

	var lines []string
	scanner := bufio.NewScanner(file)
	for scanner.Scan() {
		lines = append(lines, scanner.Text())
	}
	if err := scanner.Err(); err != nil {
		return nil, fmt.Errorf("auth: read %q: %w", path, err)
	}
	return parseAccounts(lines, path)
}

// parseAccounts turns `name:hash` lines into a store.
func parseAccounts(lines []string, source string) (*Accounts, error) {
	store := &Accounts{byName: make(map[string]string)}

	for i, raw := range lines {
		line := i + 1
		text := strings.TrimSpace(raw)
		if text == "" || strings.HasPrefix(text, "#") {
			continue
		}

		name, hash, found := strings.Cut(text, ":")
		name, hash = strings.TrimSpace(name), strings.TrimSpace(hash)
		// Refused rather than skipped: skipping would quietly remove somebody's access and
		// leave a half-loaded file looking healthy.
		if !found || name == "" || hash == "" {
			return nil, fmt.Errorf("auth: %s line %d: want `name:hash`", source, line)
		}
		if _, exists := store.byName[name]; exists {
			return nil, fmt.Errorf("auth: %s line %d: %q appears twice", source, line, name)
		}
		store.byName[name] = hash
	}
	return store, nil
}

// Authenticate reports whether name and password identify an account.
//
// An unknown name is verified against a decoy hash rather than returned early, so the
// response takes the same time either way. A login page that answers faster for names that
// do not exist is a way to enumerate who works here.
func (a *Accounts) Authenticate(name, password string) bool {
	hash, known := a.byName[name]
	if !known {
		a.mu.Lock()
		a.verifiedDecoy = true
		a.mu.Unlock()

		VerifyPassword(decoyHash, password)
		return false
	}
	return VerifyPassword(hash, password)
}

// Len returns how many accounts exist.
func (a *Accounts) Len() int { return len(a.byName) }

// Names lists every account, sorted — never a hash, never anything Authenticate needs.
// For a roster view (who is on the team), not for anything security-sensitive.
func (a *Accounts) Names() []string {
	names := make([]string, 0, len(a.byName))
	for name := range a.byName {
		names = append(names, name)
	}
	sort.Strings(names)
	return names
}

// LoadAccountsFromLines parses accounts already in memory. Same rules as LoadAccounts,
// which delegates to it — a file is just where the lines usually come from.
func LoadAccountsFromLines(lines []string) (*Accounts, error) {
	return parseAccounts(lines, "accounts")
}

// Has reports whether an account exists, without saying anything about its password.
func (a *Accounts) Has(name string) bool {
	_, ok := a.byName[name]
	return ok
}
