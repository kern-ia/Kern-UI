package stream

import (
	"sync"
	"testing"
	"time"
)

const settle = 100 * time.Millisecond

func TestPublishReachesEverySubscriber(t *testing.T) {
	h := NewHub[int](4)
	a, closeA := h.Subscribe()
	defer closeA()
	b, closeB := h.Subscribe()
	defer closeB()

	h.Publish(42)

	for name, ch := range map[string]<-chan int{"a": a, "b": b} {
		select {
		case got := <-ch:
			if got != 42 {
				t.Errorf("%s received %d, want 42", name, got)
			}
		case <-time.After(settle):
			t.Errorf("%s received nothing", name)
		}
	}
}

func TestSubscriberCount(t *testing.T) {
	h := NewHub[int](1)
	if got := h.Subscribers(); got != 0 {
		t.Fatalf("Subscribers() = %d, want 0", got)
	}

	_, unsubscribe := h.Subscribe()
	if got := h.Subscribers(); got != 1 {
		t.Errorf("Subscribers() = %d, want 1", got)
	}

	unsubscribe()
	if got := h.Subscribers(); got != 0 {
		t.Errorf("Subscribers() after unsubscribe = %d, want 0", got)
	}
}

func TestUnsubscribeClosesTheChannel(t *testing.T) {
	h := NewHub[int](1)
	ch, unsubscribe := h.Subscribe()

	unsubscribe()

	select {
	case _, open := <-ch:
		if open {
			t.Error("channel still open after unsubscribe")
		}
	case <-time.After(settle):
		t.Error("channel neither closed nor delivering")
	}
}

func TestUnsubscribeIsIdempotent(t *testing.T) {
	h := NewHub[int](1)
	_, unsubscribe := h.Subscribe()

	unsubscribe()
	unsubscribe() // must not panic on a double close

	if got := h.Subscribers(); got != 0 {
		t.Errorf("Subscribers() = %d, want 0", got)
	}
}

func TestPublishWithoutSubscribersIsANoop(t *testing.T) {
	NewHub[int](1).Publish(1) // must not block nor panic
}

func TestSlowSubscriberDoesNotBlockThePublisher(t *testing.T) {
	h := NewHub[int](2)
	_, unsubscribe := h.Subscribe() // never drained
	defer unsubscribe()

	done := make(chan struct{})
	go func() {
		defer close(done)
		for i := range 100 {
			h.Publish(i)
		}
	}()

	select {
	case <-done:
	case <-time.After(2 * time.Second):
		t.Fatal("Publish blocked on a subscriber that never reads")
	}

	if h.Dropped() == 0 {
		t.Error("Dropped() = 0, want the overflow to be counted")
	}
}

func TestPublishAfterUnsubscribeDoesNotPanic(t *testing.T) {
	h := NewHub[int](1)
	_, unsubscribe := h.Subscribe()
	unsubscribe()

	h.Publish(1) // must not send on a closed channel
}

func TestConcurrentSubscribeUnsubscribeAndPublish(t *testing.T) {
	h := NewHub[int](8)
	var wg sync.WaitGroup

	for range 25 {
		wg.Add(2)
		go func() {
			defer wg.Done()
			ch, unsubscribe := h.Subscribe()
			go func() {
				for range ch {
				}
			}()
			time.Sleep(time.Millisecond)
			unsubscribe()
		}()
		go func() {
			defer wg.Done()
			h.Publish(1)
		}()
	}
	wg.Wait()

	if got := h.Subscribers(); got != 0 {
		t.Errorf("Subscribers() = %d, want 0", got)
	}
}
