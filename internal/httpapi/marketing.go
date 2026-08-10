package httpapi

import (
	"encoding/json"
	"net/http"

	"github.com/yoann/kern-ui/internal/memory"
)

// marketingTag is the kern-memory tag every marketing calendar item carries, so
// handleListMarketingItems can recall exactly this set without touching any other memory
// a caller (or a future feature) might store in the same .okf layer.
const marketingTag = "marketing"

// MarketingItemDTO is the wire shape the front-end's marketing calendar reads/writes —
// distinct from memory.Memory (kern-memory's generic contract): the calendar's own
// fields (platform/status/date/title) live in kern-memory's free-form Metadata, folded
// out here so the front-end never has to know that encoding.
type MarketingItemDTO struct {
	RunID    string `json:"run_id"`
	Title    string `json:"title"`
	Platform string `json:"platform"`
	Status   string `json:"status"`
	Date     string `json:"date"`
	Text     string `json:"text"`
}

func marketingItemToMemory(item MarketingItemDTO) memory.Memory {
	return memory.Memory{
		ID:   item.RunID,
		Kind: "okf",
		Text: item.Text,
		Tags: []string{marketingTag},
		Metadata: map[string]string{
			"title":    item.Title,
			"platform": item.Platform,
			"status":   item.Status,
			"date":     item.Date,
		},
	}
}

func memoryToMarketingItem(m memory.Memory) MarketingItemDTO {
	return MarketingItemDTO{
		RunID:    m.ID,
		Title:    m.Metadata["title"],
		Platform: m.Metadata["platform"],
		Status:   m.Metadata["status"],
		Date:     m.Metadata["date"],
		Text:     m.Text,
	}
}

// handleUpsertMarketingItem persists (or overwrites, kern-memory's .okf layer upserts by
// id) one calendar item, keyed by the community-management-agency run id it came from —
// what survives a kern-ui restart is this persisted copy, not the in-memory run
// projection (internal/projection), which stays exactly as ephemeral as it already was
// for every other view.
func (s *server) handleUpsertMarketingItem(w http.ResponseWriter, r *http.Request) {
	if !s.cfg.Memory.Enabled() {
		writeError(w, http.StatusNotFound, "no memory source configured")
		return
	}
	var item MarketingItemDTO
	if err := json.NewDecoder(r.Body).Decode(&item); err != nil {
		writeError(w, http.StatusBadRequest, "malformed body")
		return
	}
	if item.RunID == "" {
		writeError(w, http.StatusBadRequest, "run_id is required")
		return
	}

	out, err := s.cfg.Memory.WriteMemory(r.Context(), marketingItemToMemory(item))
	if err != nil {
		writeError(w, http.StatusBadGateway, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, memoryToMarketingItem(out))
}

// handleListMarketingItems returns every persisted calendar item — the front-end merges
// this with whatever it can also derive live from currently-known runs.
func (s *server) handleListMarketingItems(w http.ResponseWriter, r *http.Request) {
	if !s.cfg.Memory.Enabled() {
		writeError(w, http.StatusNotFound, "no memory source configured")
		return
	}
	recalls, err := s.cfg.Memory.QueryMemory(r.Context(), memory.MemoryQuery{Kind: "okf", Tags: []string{marketingTag}})
	if err != nil {
		writeError(w, http.StatusBadGateway, err.Error())
		return
	}
	out := make([]MarketingItemDTO, len(recalls))
	for i, rec := range recalls {
		out[i] = memoryToMarketingItem(rec.Memory)
	}
	writeJSON(w, http.StatusOK, out)
}
