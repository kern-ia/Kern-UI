package httpapi

import (
	"bytes"
	"encoding/json"
	"io"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/yoann/kern-ui/internal/steer"
)

func multipartUploadRequest(t *testing.T, filename string, content []byte) *http.Request {
	t.Helper()
	var buf bytes.Buffer
	w := multipart.NewWriter(&buf)
	part, err := w.CreateFormFile("file", filename)
	if err != nil {
		t.Fatalf("CreateFormFile: %v", err)
	}
	if _, err := part.Write(content); err != nil {
		t.Fatalf("write part: %v", err)
	}
	if err := w.Close(); err != nil {
		t.Fatalf("close writer: %v", err)
	}
	req := httptest.NewRequest(http.MethodPost, "/api/v1/uploads", &buf)
	req.Header.Set("Content-Type", w.FormDataContentType())
	return req
}

func TestUploadingWithNoSourceConfiguredIs404(t *testing.T) {
	h := NewRouter(Config{})
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, multipartUploadRequest(t, "dossier.pdf", []byte("x")))

	if rec.Code != http.StatusNotFound {
		t.Errorf("status = %d, want 404", rec.Code)
	}
}

func TestUploadingProxiesToKernOrchAndReturnsThePath(t *testing.T) {
	var gotFilename string
	var gotContent []byte
	orch := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if err := r.ParseMultipartForm(1 << 20); err != nil {
			t.Fatalf("orch ParseMultipartForm: %v", err)
		}
		file, header, err := r.FormFile("file")
		if err != nil {
			t.Fatalf("orch FormFile: %v", err)
		}
		defer file.Close()
		gotFilename = header.Filename
		gotContent, _ = io.ReadAll(file)
		_ = json.NewEncoder(w).Encode(map[string]string{"path": "/inbox/1_dossier.pdf"})
	}))
	defer orch.Close()

	h := NewRouter(Config{Steer: &steer.Client{BaseURL: orch.URL}})
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, multipartUploadRequest(t, "dossier.pdf", []byte("contenu réel")))

	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200: %s", rec.Code, rec.Body)
	}
	var out struct {
		Path string `json:"path"`
	}
	_ = json.NewDecoder(rec.Body).Decode(&out)
	if out.Path != "/inbox/1_dossier.pdf" {
		t.Errorf("path = %q", out.Path)
	}
	if gotFilename != "dossier.pdf" || string(gotContent) != "contenu réel" {
		t.Errorf("filename=%q content=%q", gotFilename, gotContent)
	}
}

func TestUploadingSurfacesAnUpstreamFailure(t *testing.T) {
	orch := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
	}))
	defer orch.Close()

	h := NewRouter(Config{Steer: &steer.Client{BaseURL: orch.URL}})
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, multipartUploadRequest(t, "dossier.pdf", []byte("x")))

	if rec.Code != http.StatusBadGateway {
		t.Errorf("status = %d, want 502", rec.Code)
	}
}
