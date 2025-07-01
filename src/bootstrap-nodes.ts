import { createLibp2p } from "libp2p";
import { gossipsub } from "@chainsafe/libp2p-gossipsub";
import { tcp } from "@libp2p/tcp";
import { noise } from "@chainsafe/libp2p-noise";
import { yamux } from "@chainsafe/libp2p-yamux";
import { identify } from "@libp2p/identify";
import nacl from "tweetnacl";

import { keys } from "@libp2p/crypto";
import { peerIdFromPublicKey } from "@libp2p/peer-id";

const TOPIC = "sight-message";

const seeds = [
  Uint8Array.from([1, ...Array(31).fill(0)]),
  Uint8Array.from([2, ...Array(31).fill(0)]),
  Uint8Array.from([3, ...Array(31).fill(0)]),
  Uint8Array.from([4, ...Array(31).fill(0)]),
  Uint8Array.from([5, ...Array(31).fill(0)]),
  Uint8Array.from([6, ...Array(31).fill(0)]),
  Uint8Array.from([7, ...Array(31).fill(0)]),
  Uint8Array.from([8, ...Array(31).fill(0)]),
  Uint8Array.from([9, ...Array(31).fill(0)]),
//   Uint8Array.from([11, ...Array(31).fill(0)]),
//   Uint8Array.from([12, ...Array(31).fill(0)]),
//   Uint8Array.from([13, ...Array(31).fill(0)]),
//   Uint8Array.from([14, ...Array(31).fill(0)]),
//   Uint8Array.from([15, ...Array(31).fill(0)]),
//   Uint8Array.from([16, ...Array(31).fill(0)]),
//   Uint8Array.from([17, ...Array(31).fill(0)]),
//   Uint8Array.from([18, ...Array(31).fill(0)]),
//   Uint8Array.from([19, ...Array(31).fill(0)]),
];
const ports = [
  15001, 15002, 15003, 15004, 15005, 15006, 15007, 15008, 15009, 15011, 15012,
  15013, 15014, 15015, 15016, 15017, 15018, 15019,
];

// 批量创建节点
async function createNode(seed: Uint8Array, port: number) {
  const keyPair = nacl.sign.keyPair.fromSeed(seed);
  const privateKey = await keys.privateKeyFromRaw(keyPair.secretKey);
  const publicKey = await keys.publicKeyFromRaw(keyPair.publicKey);
  const peerId = await peerIdFromPublicKey(publicKey);
  //   const peerId = await peerIdFromPublicKey(keyPair.publicKey);

  const node = await createLibp2p({
    privateKey,
    addresses: { listen: [`/ip4/0.0.0.0/tcp/${port}`] },
    transports: [tcp()],
    // transports: [tcp(), circuitRelayTransport()],
    connectionEncrypters: [noise()],
    streamMuxers: [yamux()],
    services: {
      pubsub: gossipsub({ emitSelf: true, fallbackToFloodsub: true }),
      identify: identify(),
    },
  });

  console.log(`node@${port}'s peerId: ${peerId}`);

  await node.start();

  return node;
}

export async function createAndStartBootstrapNodes(): Promise<any[]> {
  const addrs: string[] = [];

  // 1. 启动所有节点
  const nodes = await Promise.all(
    seeds.map(async (seed, i) => {
      const node = await createNode(seed, ports[i]);

      const addr = node.getMultiaddrs().map((a) => a.toString());
      console.log(`[libp2p] Listening on: ${addr.join(", ")}`);

      node.services.pubsub.subscribe(TOPIC);

      node.services.pubsub.addEventListener("message", (evt: any) => {
        const msg = new TextDecoder().decode(evt.detail.data);
        const from = (evt.detail as any).from?.toString();
        console.log(`[Node@${ports[i]}] received:`, msg, "from", from);
      });

      addrs.push(node.getMultiaddrs().toString());
      return node;
    })
  );

  function randomNeighbors(
    nodeIndex: number,
    total: number,
    min = 4,
    max = 5
  ): number[] {
    const all = [...Array(total).keys()].filter((i) => i !== nodeIndex);
    const count = Math.floor(Math.random() * (max - min + 1)) + min;
    // Fisher-Yates 洗牌
    for (let i = all.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [all[i], all[j]] = [all[j], all[i]];
    }
    return all.slice(0, count);
  }

  // 假定 nodes.length === 9
  for (let i = 0; i < nodes.length; i++) {
    const neighbors = randomNeighbors(i, nodes.length, 4, 5);
    for (const j of neighbors) {
      await new Promise((res) => setTimeout(res, 70));
      await nodes[i].dial(nodes[j].getMultiaddrs()[0]);
      await new Promise((res) => setTimeout(res, 70));
    }
  }

  //   await nodes[3].dial(nodes[0].getMultiaddrs()[0]);

  const payload = { text: `Hello from node0 @${Date.now()}` };
  await nodes[0].services.pubsub.publish(
    TOPIC,
    new TextEncoder().encode(JSON.stringify(payload))
  );

  process.on("SIGINT", async () => {
    console.log("\nCaught SIGINT, shutting down libp2p nodes...");
    for (const node of nodes) {
      await node.stop();
      console.log(`Node ${node.peerId.toString()} stopped.`);
    }
    process.exit(0);
  });

  process.stdin.resume();

  return nodes;
}
createAndStartBootstrapNodes();

