import { createLibp2p, Libp2p } from "libp2p";
import { gossipsub } from "@chainsafe/libp2p-gossipsub";
import { tcp } from "@libp2p/tcp";
import { noise } from "@chainsafe/libp2p-noise";
import { yamux } from "@chainsafe/libp2p-yamux";
import { identify } from "@libp2p/identify";
import { bootstrap } from "@libp2p/bootstrap";
import { PrivateKey } from "@libp2p/interface";
import { autoNAT } from "@libp2p/autonat";
import {
  circuitRelayServer,
  circuitRelayTransport,
} from "@libp2p/circuit-relay-v2";

const TOPIC = "sight-message";

export async function createNode(
    privateKey: PrivateKey,
    port: number,
    onMessage: (msg: any, from: string) => void,
    bootstrapList?: string[]
): Promise<Libp2p> {
  const libp2pConfig = {
    privateKey,
    addresses: {
      listen: [`/ip4/0.0.0.0/tcp/${port}`],
    },
    transports: [tcp(), circuitRelayTransport()],
    connectionEncrypters: [noise()],
    streamMuxers: [yamux()],
    services: {
      pubsub: gossipsub({
        emitSelf: false,
        // @ts-ignore
        allowPublishToZeroPeers: true,
        fallbackToFloodsub: false,
      }),
      identify: identify(),
      autonat: autoNAT(),
      relay: circuitRelayServer({}),
    },
    peerDiscovery: bootstrapList?.length
        ? [
          bootstrap({
            list: bootstrapList,
          }),
        ]
        : [],
  };

  const node = await createLibp2p(libp2pConfig);
  await node.start();

  console.log(`[libp2p] Node started with PeerId: ${node.peerId.toString()}`);
  const addrs = node.getMultiaddrs().map((a) => a.toString());
  console.log(`[libp2p] Listening on: ${addrs.join(", ")}`);

  await (node.services.pubsub as any).subscribe(TOPIC);
  console.log(`[libp2p] Subscribed to topic: ${TOPIC}`);

  (node.services.pubsub as any).addEventListener("message", async (evt: any) => {
    try {
      const msg = new TextDecoder().decode(evt.detail.data);
      const parsed = JSON.parse(msg);
      const from = (evt.detail as any).from;
      await onMessage(parsed, from);
    } catch (err) {
      console.error("[libp2p] Received malformed message:", err);
    }
  });

  return node;
}
