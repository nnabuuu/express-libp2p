package main

import (
	"bytes"
	"encoding/json"
	"io"
	"log"
	"net/http"
)

const topic = "sight-message"

// Message mirrors the structure used in the TypeScript implementation.
type Message struct {
	To      string      `json:"to"`
	Payload interface{} `json:"payload"`
}

// NodeService provides high level operations similar to the TS version.
type NodeService struct {
	node      *Node
	did       string
	tunnelAPI string
}

func NewNodeService(did, tunnelAPI string) *NodeService {
	svc := &NodeService{
		node:      NewNode(),
		did:       did,
		tunnelAPI: tunnelAPI,
	}

	// subscribe to incoming messages
	svc.node.Subscribe(topic, svc.handleIncoming)
	return svc
}

func (s *NodeService) handleIncoming(data []byte) {
	var msg Message
	if err := json.Unmarshal(data, &msg); err != nil {
		log.Printf("invalid message: %v", err)
		return
	}
	if msg.To != s.did {
		return
	}

	body, err := json.Marshal(msg.Payload)
	if err != nil {
		log.Printf("failed to marshal payload: %v", err)
		return
	}

	req, err := http.NewRequest(http.MethodPost, s.tunnelAPI, bytes.NewReader(body))
	if err != nil {
		log.Printf("failed to create POST request: %v", err)
		return
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		log.Printf("tunnel POST error: %v", err)
		return
	}
	defer resp.Body.Close()
	io.ReadAll(resp.Body) // drain
	log.Printf("forwarded message to tunnel, status: %s", resp.Status)
}

// Send publishes an outgoing message to the stub network.
func (s *NodeService) Send(to string, payload interface{}) {
	msg := Message{To: to, Payload: payload}
	data, err := json.Marshal(msg)
	if err != nil {
		log.Printf("failed to encode message: %v", err)
		return
	}
	s.node.Publish(topic, data)
}

func (s *NodeService) Close() {
	s.node.Close()
}
