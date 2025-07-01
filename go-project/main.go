package main

import (
	"encoding/json"
	"log"
	"net/http"
	"os"
)

// This version provides a more complete example of how the libp2p server could
// look in Go without pulling the real go-libp2p dependency. It uses an in-memory
// pub/sub implementation located in libp2p_stub.go.
func main() {
	did := os.Getenv("NODE_DID")
	if did == "" {
		did = "gateway"
	}
	tunnelAPI := os.Getenv("TUNNEL_API")
	if tunnelAPI == "" {
		tunnelAPI = "http://localhost:8716/libp2p/message"
	}

	svc := NewNodeService(did, tunnelAPI)
	defer svc.Close()

	mux := http.NewServeMux()
	mux.HandleFunc("/libp2p/send", func(w http.ResponseWriter, r *http.Request) {
		var payload interface{}
		if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
			http.Error(w, "invalid json", http.StatusBadRequest)
			return
		}
		to := did // in this stub we only send to ourselves
		svc.Send(to, payload)
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("message published"))
	})

	port := ":8080"
	if fromEnv := os.Getenv("LIBP2P_PORT"); fromEnv != "" {
		port = ":" + fromEnv
	}

	log.Printf("Starting stub libp2p server on %s (did=%s)", port, did)
	if err := http.ListenAndServe(port, mux); err != nil {
		log.Fatal(err)
	}
}
