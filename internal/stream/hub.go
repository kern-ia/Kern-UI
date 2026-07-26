// Package stream fans a single flow of values out to every connected browser.
package stream

import "sync"

// Hub broadcasts values to every subscriber. It is safe for concurrent use.
//
// A subscriber that stops reading is never allowed to stall the publisher: once its buffer
// is full the value is dropped and counted. Callers must therefore treat the stream as a
// best-effort feed and reconcile from a snapshot on (re)connection, not as an event log.
type Hub[T any] struct {
	buffer int

	mu      sync.Mutex
	subs    map[int]chan T
	nextID  int
	dropped int
}

// NewHub returns a hub whose subscribers each buffer up to buffer values.
func NewHub[T any](buffer int) *Hub[T] {
	if buffer < 1 {
		buffer = 1
	}
	return &Hub[T]{buffer: buffer, subs: make(map[int]chan T)}
}

// Subscribe registers a subscriber and returns its channel plus the function that closes
// it. The returned function is idempotent and must be called to release the subscription.
func (h *Hub[T]) Subscribe() (<-chan T, func()) {
	h.mu.Lock()
	defer h.mu.Unlock()

	id := h.nextID
	h.nextID++
	ch := make(chan T, h.buffer)
	h.subs[id] = ch

	var once sync.Once
	return ch, func() {
		once.Do(func() {
			h.mu.Lock()
			defer h.mu.Unlock()
			// The lock is also held while publishing, so closing here can never race
			// with a send on this channel.
			if sub, ok := h.subs[id]; ok {
				delete(h.subs, id)
				close(sub)
			}
		})
	}
}

// Publish delivers v to every subscriber with room for it, dropping it for the others.
func (h *Hub[T]) Publish(v T) {
	h.mu.Lock()
	defer h.mu.Unlock()

	for _, ch := range h.subs {
		select {
		case ch <- v:
		default:
			h.dropped++
		}
	}
}

// Subscribers reports how many subscriptions are currently open.
func (h *Hub[T]) Subscribers() int {
	h.mu.Lock()
	defer h.mu.Unlock()

	return len(h.subs)
}

// Dropped reports how many deliveries were skipped because a subscriber was too slow.
// A non-zero value means some browser saw a gap and is relying on its snapshot.
func (h *Hub[T]) Dropped() int {
	h.mu.Lock()
	defer h.mu.Unlock()

	return h.dropped
}
