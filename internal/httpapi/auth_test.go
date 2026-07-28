package httpapi

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/yoann/kern-ui/internal/auth"
)

const (
	producerToken = "un-secret-de-producteur"
	operatorName  = "yoann"
	operatorPass  = "le mot de passe"
)

// guarded builds a router with authentication switched on, as a deployed one would be.
func guarded(t *testing.T) http.Handler {
	t.Helper()
	hash, err := auth.HashPassword(operatorPass)
	if err != nil {
		t.Fatal(err)
	}
	accounts, err := auth.LoadAccountsFromLines([]string{operatorName + ":" + hash})
	if err != nil {
		t.Fatal(err)
	}
	return NewRouter(Config{
		ProducerToken: producerToken,
		Accounts:      accounts,
	})
}

func login(t *testing.T, h http.Handler) *http.Cookie {
	t.Helper()
	rec := httptest.NewRecorder()
	body := `{"name":"` + operatorName + `","password":"` + operatorPass + `"}`
	h.ServeHTTP(rec, httptest.NewRequest(http.MethodPost, "/api/v1/login", strings.NewReader(body)))
	if rec.Code != http.StatusOK {
		t.Fatalf("login: status = %d, want 200: %s", rec.Code, rec.Body)
	}
	for _, c := range rec.Result().Cookies() {
		if c.Name == sessionCookie {
			return c
		}
	}
	t.Fatal("login returned no session cookie")
	return nil
}

// The hole this closes: an unauthenticated caller could read every run and inject fake ones.
func TestEveryDataEndpointRefusesAnAnonymousCaller(t *testing.T) {
	h := guarded(t)

	cases := []struct{ method, path string }{
		{http.MethodGet, "/api/v1/runs"},
		{http.MethodGet, "/api/v1/runs/whatever"},
		{http.MethodGet, "/api/v1/registry"},
		{http.MethodGet, "/api/v1/stream"},
		{http.MethodPost, "/api/v1/steps"},
		{http.MethodPost, "/api/v1/registry"},
		{http.MethodPost, "/api/v1/activity"},
	}

	for _, c := range cases {
		t.Run(c.method+" "+c.path, func(t *testing.T) {
			rec := httptest.NewRecorder()
			h.ServeHTTP(rec, httptest.NewRequest(c.method, c.path, strings.NewReader("{}")))

			if rec.Code != http.StatusUnauthorized {
				t.Errorf("status = %d, want 401", rec.Code)
			}
		})
	}
}

// Liveness has to answer without a credential or nothing can watch the process.
func TestHealthzStaysOpen(t *testing.T) {
	rec := httptest.NewRecorder()
	guarded(t).ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/healthz", nil))

	if rec.Code != http.StatusOK {
		t.Errorf("status = %d, want 200 — a probe carries no credential", rec.Code)
	}
}

func TestAProducerIsAcceptedOnItsToken(t *testing.T) {
	h := guarded(t)

	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/api/v1/steps", bytes.NewReader(readFixture(t)))
	req.Header.Set("Authorization", "Bearer "+producerToken)
	h.ServeHTTP(rec, req)

	if rec.Code != http.StatusAccepted {
		t.Fatalf("status = %d, want 202: %s", rec.Code, rec.Body)
	}
}

func TestAProducerWithTheWrongTokenIsRefused(t *testing.T) {
	h := guarded(t)

	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/api/v1/steps", bytes.NewReader(readFixture(t)))
	req.Header.Set("Authorization", "Bearer pas-le-bon")
	h.ServeHTTP(rec, req)

	if rec.Code != http.StatusUnauthorized {
		t.Errorf("status = %d, want 401", rec.Code)
	}
}

// A producer token is for machines posting events, not for reading the whole system.
func TestAProducerTokenDoesNotOpenTheReadEndpoints(t *testing.T) {
	h := guarded(t)

	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/api/v1/runs", nil)
	req.Header.Set("Authorization", "Bearer "+producerToken)
	h.ServeHTTP(rec, req)

	if rec.Code != http.StatusUnauthorized {
		t.Errorf("status = %d, want 401 — posting is not reading", rec.Code)
	}
}

func TestAnOperatorReadsWithASession(t *testing.T) {
	h := guarded(t)
	cookie := login(t, h)

	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/api/v1/runs", nil)
	req.AddCookie(cookie)
	h.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Errorf("status = %d, want 200: %s", rec.Code, rec.Body)
	}
}

// A session is for a person reading, not for a machine writing.
func TestASessionDoesNotOpenTheIngestionEndpoints(t *testing.T) {
	h := guarded(t)
	cookie := login(t, h)

	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/api/v1/steps", bytes.NewReader(readFixture(t)))
	req.AddCookie(cookie)
	h.ServeHTTP(rec, req)

	if rec.Code != http.StatusUnauthorized {
		t.Errorf("status = %d, want 401 — reading is not posting", rec.Code)
	}
}

func TestLoginRefusesTheWrongPassword(t *testing.T) {
	h := guarded(t)

	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, httptest.NewRequest(http.MethodPost, "/api/v1/login",
		strings.NewReader(`{"name":"`+operatorName+`","password":"faux"}`)))

	if rec.Code != http.StatusUnauthorized {
		t.Errorf("status = %d, want 401", rec.Code)
	}
	if len(rec.Result().Cookies()) != 0 {
		t.Error("a failed login handed out a cookie")
	}
}

// The refusal must not say which of the two was wrong, or it answers "does this person work
// here?" for anyone who asks.
func TestAFailedLoginDoesNotSayWhichPartWasWrong(t *testing.T) {
	h := guarded(t)

	body := func(name, password string) string {
		rec := httptest.NewRecorder()
		h.ServeHTTP(rec, httptest.NewRequest(http.MethodPost, "/api/v1/login",
			strings.NewReader(`{"name":"`+name+`","password":"`+password+`"}`)))
		return rec.Body.String()
	}

	if body(operatorName, "faux") != body("personne", "faux") {
		t.Error("the answer differs between a wrong password and an unknown account")
	}
}

// The cookie must not be readable by scripts, nor sent on cross-site requests: those two
// flags are what stop a stolen page from stealing the session with it.
func TestTheSessionCookieIsProtected(t *testing.T) {
	cookie := login(t, guarded(t))

	if !cookie.HttpOnly {
		t.Error("the session cookie is readable by JavaScript")
	}
	if cookie.SameSite != http.SameSiteStrictMode {
		t.Errorf("SameSite = %v, want Strict", cookie.SameSite)
	}
	if cookie.Path != "/" {
		t.Errorf("Path = %q, want /", cookie.Path)
	}
}

func TestLoggingOutEndsTheSession(t *testing.T) {
	h := guarded(t)
	cookie := login(t, h)

	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/api/v1/logout", nil)
	req.AddCookie(cookie)
	h.ServeHTTP(rec, req)
	if rec.Code != http.StatusNoContent {
		t.Fatalf("logout: status = %d, want 204", rec.Code)
	}

	rec = httptest.NewRecorder()
	req = httptest.NewRequest(http.MethodGet, "/api/v1/runs", nil)
	req.AddCookie(cookie)
	h.ServeHTTP(rec, req)

	if rec.Code != http.StatusUnauthorized {
		t.Error("the session still worked after logging out")
	}
}

// The browser needs to know whether to show the login screen without guessing from a 401.
func TestTheSessionEndpointReportsWhoIsLoggedIn(t *testing.T) {
	h := guarded(t)

	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/api/v1/session", nil))
	if rec.Code != http.StatusUnauthorized {
		t.Errorf("anonymous: status = %d, want 401", rec.Code)
	}

	rec = httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/api/v1/session", nil)
	req.AddCookie(login(t, h))
	h.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("logged in: status = %d, want 200", rec.Code)
	}
	var who struct {
		Name string `json:"name"`
	}
	_ = json.NewDecoder(rec.Body).Decode(&who)
	if who.Name != operatorName {
		t.Errorf("name = %q, want %q", who.Name, operatorName)
	}
}

// Every existing test builds a router with no credentials configured, and they must keep
// working: that is the local development case, where the server binds to loopback only.
// The refusal to run open on a public address lives at startup, not here.
func TestAnUnconfiguredRouterStaysOpen(t *testing.T) {
	h := NewRouter(Config{})

	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/api/v1/runs", nil))

	if rec.Code != http.StatusOK {
		t.Errorf("status = %d, want 200 with no credentials configured", rec.Code)
	}
}
