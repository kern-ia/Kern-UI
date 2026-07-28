package httpapi

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/yoann/kern-ui/internal/registry"
)

// contractRegistry is the canonical kern.registry/v1 payload. The identical file lives in
// Kern-Orch/contracts/, where a mirror test asserts its publisher emits exactly this. The
// two bricks share no code by design, so this fixture is the whole agreement between them.
const contractRegistry = "../../contracts/kern.registry.v1.json"

func postRegistry(t *testing.T, h http.Handler, body []byte) *httptest.ResponseRecorder {
	t.Helper()
	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/api/v1/registry", bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")
	h.ServeHTTP(rec, req)
	return rec
}

func getRegistry(t *testing.T, h http.Handler) *httptest.ResponseRecorder {
	t.Helper()
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/api/v1/registry", nil))
	return rec
}

// The producer's payload must go through the real route untouched — including
// DisallowUnknownFields, which turns any field kern-orch adds without telling us into a 400.
func TestRegistryContractFixtureIsAccepted(t *testing.T) {
	h := NewRouter(Config{})

	rec := postRegistry(t, h, readFile(t, contractRegistry))

	if rec.Code != http.StatusAccepted {
		t.Fatalf("status = %d, want %d — the contract fixture was rejected: %s",
			rec.Code, http.StatusAccepted, rec.Body)
	}
}

func TestRegistryContractFixtureIsServedBack(t *testing.T) {
	h := NewRouter(Config{})
	postRegistry(t, h, readFile(t, contractRegistry))

	rec := getRegistry(t, h)
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d: %s", rec.Code, http.StatusOK, rec.Body)
	}

	var cat registry.Catalogue
	if err := json.NewDecoder(rec.Body).Decode(&cat); err != nil {
		t.Fatalf("decode: %v", err)
	}

	if cat.Source != "kern-orch" {
		t.Errorf("source = %q, want kern-orch", cat.Source)
	}
	if len(cat.Skills) != 2 {
		t.Fatalf("skills = %v, want the fixture's two", cat.Skills)
	}
	// Sorted by name: Analyse before Scribe.
	if cat.Skills[0].Name != "Analyse" || cat.Skills[0].Kind != registry.KindTool {
		t.Errorf("skills[0] = %+v, want the Analyse tool", cat.Skills[0])
	}
	if cat.Skills[1].Name != "Scribe" || cat.Skills[1].Kind != registry.KindAgent {
		t.Errorf("skills[1] = %+v, want the Scribe agent", cat.Skills[1])
	}
	if cat.Skills[0].Description == "" {
		t.Error("the description did not survive the round trip")
	}
}

// The fixture is the contract: it must itself satisfy the schema we publish.
func TestRegistryFixtureMatchesThePublishedSchema(t *testing.T) {
	var cat registry.Catalogue
	dec := json.NewDecoder(bytes.NewReader(readFile(t, contractRegistry)))
	dec.DisallowUnknownFields()
	if err := dec.Decode(&cat); err != nil {
		t.Fatalf("the fixture does not match registry.Catalogue: %v", err)
	}

	if err := cat.Validate(); err != nil {
		t.Errorf("the fixture fails our own validation: %v", err)
	}
}

// Until kern-orch publishes, the Grimoire must be able to tell "no producer yet" from "a
// producer with nothing". 404 is that signal; an empty 200 would be the wrong screen.
func TestRegistryIsNotFoundBeforeAnyPublication(t *testing.T) {
	h := NewRouter(Config{})

	if rec := getRegistry(t, h); rec.Code != http.StatusNotFound {
		t.Errorf("status = %d, want %d before a producer speaks", rec.Code, http.StatusNotFound)
	}
}

func TestRegistryServesAnEmptyCatalogue(t *testing.T) {
	h := NewRouter(Config{})
	postRegistry(t, h, []byte(`{"source":"kern-orch","at":"2026-07-27T12:00:00Z","skills":[]}`))

	rec := getRegistry(t, h)
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d — a producer with no skills has still spoken",
			rec.Code, http.StatusOK)
	}

	var cat registry.Catalogue
	_ = json.NewDecoder(rec.Body).Decode(&cat)
	if cat.Skills == nil {
		t.Error("skills serialised as null; the browser must receive a list")
	}
}

func TestRegistryRejectsAnInvalidCatalogue(t *testing.T) {
	cases := map[string]string{
		"unknown kind": `{"source":"kern-orch","at":"2026-07-27T12:00:00Z","skills":[{"name":"A","kind":"widget"}]}`,
		"no name":      `{"source":"kern-orch","at":"2026-07-27T12:00:00Z","skills":[{"kind":"tool"}]}`,
		"no source":    `{"at":"2026-07-27T12:00:00Z","skills":[]}`,
		"unknown field": `{"source":"kern-orch","at":"2026-07-27T12:00:00Z","skills":[],` +
			`"wired":true}`,
		"malformed": `{`,
	}

	for name, body := range cases {
		t.Run(name, func(t *testing.T) {
			rec := postRegistry(t, NewRouter(Config{}), []byte(body))
			if rec.Code != http.StatusBadRequest {
				t.Errorf("status = %d, want %d", rec.Code, http.StatusBadRequest)
			}
		})
	}
}

// A second publication supersedes the first, so a skill deleted upstream leaves the view.
func TestRegistryRepublicationSupersedes(t *testing.T) {
	h := NewRouter(Config{})
	postRegistry(t, h, readFile(t, contractRegistry))
	postRegistry(t, h, []byte(
		`{"source":"kern-orch","at":"2026-07-27T13:00:00Z","skills":[{"name":"Vigilance","kind":"tool"}]}`))

	var cat registry.Catalogue
	_ = json.NewDecoder(getRegistry(t, h).Body).Decode(&cat)

	if len(cat.Skills) != 1 || cat.Skills[0].Name != "Vigilance" {
		t.Errorf("skills = %v, want only the second publication", cat.Skills)
	}
}
