package httpapi

import "net/http"

// handleListAccounts answers Équipe: who has an account, never how their password hashes
// out. Reachable by any signed-in account (requireSession) — reading a colleague's name is
// not privileged, and gating it further would need a role model this repo doesn't have.
func (s *server) handleListAccounts(w http.ResponseWriter, r *http.Request) {
	if s.cfg.Accounts == nil {
		writeJSON(w, http.StatusOK, []string{})
		return
	}
	writeJSON(w, http.StatusOK, s.cfg.Accounts.Names())
}
