.PHONY: help dev test test-go test-web build build-web lint clean dist

BIN     := bin/kern-ui
WEB_DIR := internal/httpapi/dist
TARGETS := darwin/arm64 darwin/amd64 linux/amd64 linux/arm64 windows/amd64

help: ## List available targets
	@grep -hE '^[a-z-]+:.*##' $(MAKEFILE_LIST) | sed 's/:.*##/\t/' | expand -t24

dev: ## Run the Go server; run `npm run dev` in web/ alongside it
	KERN_UI_WEB_DIR=$(WEB_DIR) go run ./cmd/kern-ui

test: test-go test-web ## Run every test suite

test-go: ## Run Go tests with the race detector
	go test -race ./...

test-web: ## Run front-end tests
	cd web && npm test

lint: ## Vet Go and lint the front-end
	go vet ./...
	cd web && npm run lint

build-web: ## Build the SPA into the Go server's static directory
	cd web && npm run build

build: build-web ## Build the binary for the host platform
	CGO_ENABLED=0 go build -o $(BIN) ./cmd/kern-ui

dist: build-web ## Cross-compile every supported target into bin/
	@for t in $(TARGETS); do \
		os=$${t%/*}; arch=$${t#*/}; ext=""; \
		[ "$$os" = "windows" ] && ext=".exe"; \
		echo "building $$os/$$arch"; \
		CGO_ENABLED=0 GOOS=$$os GOARCH=$$arch \
			go build -o bin/kern-ui-$$os-$$arch$$ext ./cmd/kern-ui || exit 1; \
	done

clean: ## Remove build output
	rm -rf bin $(WEB_DIR)
