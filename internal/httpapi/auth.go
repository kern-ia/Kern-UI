package httpapi

import (
	"encoding/json"
	"net/http"
	"strings"

	"github.com/yoann/kern-ui/internal/auth"
)

// sessionCookie is where a browser keeps its session token.
const sessionCookie = "kern_session"

// maxLoginBody caps a login payload: two short strings.
const maxLoginBody = 4 << 10

// Two credentials, because there are two kinds of caller and they want opposite things.
//
// A producer is a machine with one configured URL and no human behind it; a bearer token is
// the whole of what it can offer. An operator is a person in a browser; a session cookie is
// what survives a page reload without JavaScript being able to read it.
//
// Neither opens the other's doors. A producer token cannot read the system — kern-orch has
// no business enumerating runs — and a session cannot post events, because a browser is not
// a producer. Collapsing them into one credential would mean the token configured on every
// machine also reads everything.

// requireProducer guards the ingestion endpoints.
func (s *server) requireProducer(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if s.cfg.ProducerToken == "" {
			next(w, r) // nothing configured: see Config.ProducerToken
			return
		}
		if !auth.TokenMatches(s.cfg.ProducerToken, bearerToken(r)) {
			unauthorized(w)
			return
		}
		next(w, r)
	}
}

// requireSession guards everything a person reads.
func (s *server) requireSession(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if s.cfg.Accounts == nil || s.cfg.Accounts.Len() == 0 {
			next(w, r) // nobody could log in: see Config.Accounts
			return
		}
		if _, ok := s.currentUser(r); !ok {
			unauthorized(w)
			return
		}
		next(w, r)
	}
}

func (s *server) currentUser(r *http.Request) (string, bool) {
	cookie, err := r.Cookie(sessionCookie)
	if err != nil {
		return "", false
	}
	return s.cfg.Sessions.User(cookie.Value)
}

// bearerToken reads `Authorization: Bearer <token>`, or "" when absent.
func bearerToken(r *http.Request) string {
	header := r.Header.Get("Authorization")
	token, found := strings.CutPrefix(header, "Bearer ")
	if !found {
		return ""
	}
	return strings.TrimSpace(token)
}

// unauthorized answers every refusal identically. What was wrong — no credential, the wrong
// one, an expired session — is not the caller's business to learn by probing.
func unauthorized(w http.ResponseWriter) {
	writeError(w, http.StatusUnauthorized, "authentication required")
}

func (s *server) handleLogin(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Name     string `json:"name"`
		Password string `json:"password"`
	}
	dec := json.NewDecoder(http.MaxBytesReader(w, r.Body, maxLoginBody))
	if err := dec.Decode(&body); err != nil {
		// Same answer as a wrong password: a malformed payload is not worth a hint either.
		unauthorized(w)
		return
	}

	if s.cfg.Accounts == nil || !s.cfg.Accounts.Authenticate(body.Name, body.Password) {
		// One answer for a wrong password and for an account that does not exist. Telling
		// them apart would answer "does this person work here?" for anyone who asks.
		unauthorized(w)
		return
	}

	token, err := s.cfg.Sessions.Issue(body.Name)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "could not open a session")
		return
	}

	http.SetCookie(w, &http.Cookie{
		Name:  sessionCookie,
		Value: token,
		Path:  "/",
		// Unreadable by scripts, and never sent from another site: the two flags that stop a
		// stolen page from taking the session with it.
		HttpOnly: true,
		SameSite: http.SameSiteStrictMode,
		// Secure is set only behind TLS: forcing it on plain http would make the cookie
		// silently vanish on a loopback development server.
		Secure: r.TLS != nil,
	})
	writeJSON(w, http.StatusOK, map[string]string{"name": body.Name})
}

// handleLogout ends the session server-side, not merely in the browser: a token copied off
// the wire would otherwise keep working until it expired.
func (s *server) handleLogout(w http.ResponseWriter, r *http.Request) {
	if cookie, err := r.Cookie(sessionCookie); err == nil {
		s.cfg.Sessions.Revoke(cookie.Value)
	}
	http.SetCookie(w, &http.Cookie{
		Name: sessionCookie, Value: "", Path: "/", MaxAge: -1,
		HttpOnly: true, SameSite: http.SameSiteStrictMode,
	})
	w.WriteHeader(http.StatusNoContent)
}

// handleSession lets the interface know whether to draw the login screen, without having to
// infer it from a 401 on some other request.
func (s *server) handleSession(w http.ResponseWriter, r *http.Request) {
	name, ok := s.currentUser(r)
	if !ok {
		if s.cfg.Accounts == nil || s.cfg.Accounts.Len() == 0 {
			// Nobody could log in, so nobody is being kept out.
			writeJSON(w, http.StatusOK, map[string]string{"name": ""})
			return
		}
		unauthorized(w)
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"name": name})
}
