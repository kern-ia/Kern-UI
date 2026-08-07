package httpapi

import "net/http"

// maxUploadBody mirrors kern-orch's own cap (internal/daemon/upload.go) — no point
// accepting more here than the daemon downstream will accept anyway.
const maxUploadBody = 25 << 20

// handleUpload proxies a browser's file to kern-orch's real upload endpoint (C6's write
// path, same "text IS the document path" convention as handleDispatch) and hands back the
// local path a subsequent dispatch uses.
func (s *server) handleUpload(w http.ResponseWriter, r *http.Request) {
	if !s.cfg.Steer.Enabled() {
		writeError(w, http.StatusNotFound, "no steering source configured")
		return
	}
	r.Body = http.MaxBytesReader(w, r.Body, maxUploadBody)
	if err := r.ParseMultipartForm(maxUploadBody); err != nil {
		writeError(w, http.StatusBadRequest, "malformed upload: "+err.Error())
		return
	}
	file, header, err := r.FormFile("file")
	if err != nil {
		writeError(w, http.StatusBadRequest, "missing \"file\" field")
		return
	}
	defer file.Close()

	path, err := s.cfg.Steer.Upload(r.Context(), header.Filename, file)
	if err != nil {
		writeError(w, http.StatusBadGateway, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"path": path})
}
