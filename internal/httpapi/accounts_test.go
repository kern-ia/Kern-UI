package httpapi

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestListingAccountsReturnsNamesOnly(t *testing.T) {
	h := guarded(t)
	cookie := login(t, h)

	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/api/v1/accounts", nil)
	req.AddCookie(cookie)
	h.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200: %s", rec.Code, rec.Body)
	}
	var names []string
	_ = json.NewDecoder(rec.Body).Decode(&names)
	// guarded(t) registers exactly one account, operatorName — never a hash alongside it.
	if len(names) != 1 || names[0] != operatorName {
		t.Errorf("got %v, want [%s]", names, operatorName)
	}
}

func TestListingAccountsWithNoneConfiguredIsAnEmptyList(t *testing.T) {
	h := NewRouter(Config{})
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/api/v1/accounts", nil))

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200: %s", rec.Code, rec.Body)
	}
	var names []string
	_ = json.NewDecoder(rec.Body).Decode(&names)
	if len(names) != 0 {
		t.Errorf("got %v, want empty", names)
	}
}
