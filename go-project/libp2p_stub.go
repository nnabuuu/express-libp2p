package main

import (
	"sync"
)

// Node is a minimal in-memory pub/sub implementation used to mimic
// libp2p functionality in this environment. It is NOT a real libp2p
// node and should be replaced with go-libp2p when network access
// allows fetching dependencies.
type Node struct {
	mu          sync.RWMutex
	subscribers map[string][]chan []byte
}

func NewNode() *Node {
	return &Node{subscribers: make(map[string][]chan []byte)}
}

// Publish sends a message to all subscribers of the given topic.
func (n *Node) Publish(topic string, data []byte) {
	n.mu.RLock()
	subs := n.subscribers[topic]
	n.mu.RUnlock()
	for _, ch := range subs {
		// Non-blocking send
		select {
		case ch <- data:
		default:
		}
	}
}

// Subscribe registers a handler for messages on the given topic.
func (n *Node) Subscribe(topic string, handler func([]byte)) {
	ch := make(chan []byte, 16)
	n.mu.Lock()
	n.subscribers[topic] = append(n.subscribers[topic], ch)
	n.mu.Unlock()

	go func() {
		for msg := range ch {
			handler(msg)
		}
	}()
}

// Close shuts down the node and all subscriber channels.
func (n *Node) Close() {
	n.mu.Lock()
	defer n.mu.Unlock()
	for _, subs := range n.subscribers {
		for _, ch := range subs {
			close(ch)
		}
	}
	n.subscribers = make(map[string][]chan []byte)
}
