package httpapi

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/yoann/kern-ui/internal/memory"
)

func TestUpsertMarketingItemWithNoSourceConfiguredIs404(t *testing.T) {
	h := NewRouter(Config{})
	rec := httptest.NewRecorder()
	body, _ := json.Marshal(map[string]string{"run_id": "r1", "text": "x"})
	h.ServeHTTP(rec, httptest.NewRequest(http.MethodPost, "/api/v1/marketing/items", bytes.NewReader(body)))

	if rec.Code != http.StatusNotFound {
		t.Errorf("status = %d, want 404", rec.Code)
	}
}

func TestUpsertMarketingItemProxiesToKernMemoryTaggedMarketing(t *testing.T) {
	var gotBody map[string]any
	km := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_ = json.NewDecoder(r.Body).Decode(&gotBody)
		_ = json.NewEncoder(w).Encode(memory.Memory{ID: "r1", Kind: "okf", Text: "contenu"})
	}))
	defer km.Close()

	h := NewRouter(Config{Memory: &memory.Client{BaseURL: km.URL}})
	rec := httptest.NewRecorder()
	body, _ := json.Marshal(map[string]string{
		"run_id": "r1", "title": "Post LinkedIn", "platform": "LinkedIn",
		"status": "publie", "date": "2026-08-10", "text": "contenu du post",
	})
	h.ServeHTTP(rec, httptest.NewRequest(http.MethodPost, "/api/v1/marketing/items", bytes.NewReader(body)))

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200: %s", rec.Code, rec.Body)
	}
	if gotBody["id"] != "r1" || gotBody["kind"] != "okf" {
		t.Errorf("proxied body = %+v", gotBody)
	}
	tags, _ := gotBody["tags"].([]any)
	found := false
	for _, tag := range tags {
		if tag == "marketing" {
			found = true
		}
	}
	if !found {
		t.Errorf("tags = %v, want \"marketing\" among them", tags)
	}
}

func TestListMarketingItemsWithNoSourceConfiguredIs404(t *testing.T) {
	h := NewRouter(Config{})
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/api/v1/marketing/items", nil))

	if rec.Code != http.StatusNotFound {
		t.Errorf("status = %d, want 404", rec.Code)
	}
}

func TestListMarketingItemsQueriesKernMemoryByTag(t *testing.T) {
	var gotBody map[string]any
	km := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_ = json.NewDecoder(r.Body).Decode(&gotBody)
		_ = json.NewEncoder(w).Encode([]memory.Recall{
			{Memory: memory.Memory{
				ID: "r1", Kind: "okf", Text: "contenu",
				Tags:     []string{"marketing"},
				Metadata: map[string]string{"title": "Post LinkedIn", "platform": "LinkedIn", "status": "publie", "date": "2026-08-10"},
			}, Similarity: 1},
		})
	}))
	defer km.Close()

	h := NewRouter(Config{Memory: &memory.Client{BaseURL: km.URL}})
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/api/v1/marketing/items", nil))

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200: %s", rec.Code, rec.Body)
	}
	tags, _ := gotBody["tags"].([]any)
	if len(tags) != 1 || tags[0] != "marketing" {
		t.Errorf("query tags = %v, want [marketing]", tags)
	}

	var out []MarketingItemDTO
	_ = json.NewDecoder(rec.Body).Decode(&out)
	if len(out) != 1 || out[0].RunID != "r1" || out[0].Title != "Post LinkedIn" {
		t.Errorf("got %+v", out)
	}
}
