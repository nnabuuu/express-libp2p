import { Libp2p } from "libp2p";
import { createNode } from "./libp2p-node.js";
import { keys } from "@libp2p/crypto";
import { multiaddr } from "@multiformats/multiaddr";
import axios from "axios";
import bs58 from "bs58";

const TOPIC = "sight-message";

function toSightDid(publicKey: Uint8Array): string {
  const multicodec = new Uint8Array([0xed, 0x01, ...publicKey]);
  return `did:sight:hoster:${bs58.encode(multicodec)}`;
}

export class Libp2pNodeService {
  private node!: Libp2p;
  private readonly did: string;

  constructor(
      private readonly keyPair: nacl.SignKeyPair,
      private readonly nodePort: number,
      private readonly tunnelAPI: string,
      private readonly isGateway: boolean = false,
      private readonly bootstrapList: string[]
  ) {
    this.did = this.isGateway ? "gateway" : toSightDid(this.keyPair.publicKey);
    console.log(`[Libp2pNodeService] DID: ${this.did}`);
  }

  async initNode(): Promise<void> {
    this.node = await createNode(
        keys.privateKeyFromRaw(this.keyPair.secretKey),
        this.nodePort,
        this.handleIncomeMessage.bind(this),
        this.bootstrapList
    );
  }

  async handleIncomeMessage(msg: any): Promise<void> {
    if (msg.to !== this.did) return;

    try {
      const res = await axios.post(this.tunnelAPI, msg.payload, {
        headers: { "Content-Type": "application/json" },
      });
      console.log("[Libp2pNodeService] Forwarded to tunnel:", res.data);
    } catch (err: any) {
      if (err.response) {
        console.error(
            "[Libp2pNodeService] Tunnel POST failed:",
            err.response.status,
            err.response.data
        );
      } else {
        console.error("[Libp2pNodeService] Tunnel POST error:", err.message);
      }
    }

    console.log("[Libp2pNodeService] Matched message processed:", msg);
  }

  async handleOutcomeMessage(msg: any): Promise<void> {
    await this.publish(msg);
    console.log(
        "[Libp2pNodeService] Message published:",
        JSON.stringify(msg, null, 2)
    );
  }

  getNode(): Libp2p {
    return this.node;
  }

  async dial(addr: string): Promise<void> {
    if (!this.node) {
      throw new Error("[Libp2pNodeService] Node not initialized");
    }

    try {
      const ma = multiaddr(addr);
      await this.node.dial(ma);
      console.log("[Libp2pNodeService] Dialed:", addr);
    } catch (err) {
      console.error("[Libp2pNodeService] Dial failed:", err);
      throw err;
    }
  }

  async publish(data: any): Promise<void> {
    const encoded = new TextEncoder().encode(JSON.stringify(data));
    await (this.node.services.pubsub as any).publish(TOPIC, encoded);
  }

  async subscribe(topic: string): Promise<void> {
    await (this.node.services.pubsub as any).subscribe(topic);
  }

  async unsubscribe(topic: string): Promise<void> {
    await (this.node.services.pubsub as any).unsubscribe(topic);
  }
}
