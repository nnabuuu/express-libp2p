import { createNode } from "./libp2p-node.js";
import { setTimeout } from "timers/promises";
import type { Libp2p } from "libp2p";
import * as dotenv from "dotenv";
import * as nacl from "tweetnacl";
import { keys } from "@libp2p/crypto";
import { PrivateKey, PublicKey } from "@libp2p/interface";

dotenv.config();

describe("libp2p node mesh & with bootstrap discovery", async () => {
  const bootstrap: string[] = [];
  const seeds = [
    Uint8Array.from([100, ...Array(31).fill(0)]),
    Uint8Array.from([102, ...Array(31).fill(0)]),
    Uint8Array.from([103, ...Array(31).fill(0)]),
    Uint8Array.from([104, ...Array(31).fill(0)]),
  ];
  const keyPairs = [];
  const privateKeys: PrivateKey[] = [];
  const publicKeys: PublicKey[] = [];


  for (let i = 0; i < seeds.length; i++) {
    const keyPair = nacl.sign.keyPair.fromSeed(seeds[i]);
    const privateKey = await keys.privateKeyFromRaw(keyPair.secretKey);
    const publicKey = await keys.publicKeyFromRaw(keyPair.publicKey);
    keyPairs.push(keyPair);
    privateKeys.push(privateKey);
    publicKeys.push(publicKey);
  }

  it("should mesh and gossip", async () => {
    const N = 3;
    const nodes: Libp2p<any>[] = [];
    const ports = [16000, 16001, 16002];
    const topic = "sight-message";
    const received: string[][] = [[], [], []];

    // 1. 启动 N 个节点
    for (let i = 0; i < N; i++) {
      nodes.push(
        await createNode(privateKeys[i], ports[i], (msg, from) => {
          // console.log("[libp2p] Received message from", from);
          received[i].push(JSON.stringify({ msg, from }));
          // console.log(msg);
        })
      );
    }

    // 2. 让每个节点 dial 其它节点
    for (let i = 0; i < N; i++) {
      for (let j = 0; j < N; j++) {
        if (i !== j) {
          await nodes[i].dial(nodes[j].getMultiaddrs()[0]);
        }
      }
    }

    // 3. 让第一个节点发布一条消息
    const payload = { text: `Hello from node0 @${Date.now()}` };
    await nodes[0].services.pubsub.publish(
      topic,
      new TextEncoder().encode(JSON.stringify(payload))
    );

    // 4. 等待所有节点收到消息（用 Promise.race + sleep）
    await setTimeout(1000); // 等 1 秒，让消息传播

    // 5. 检查每个节点都收到消息
    for (let i = 0; i < N; i++) {
      expect(received[i].length).toBeGreaterThan(0);
      // 可以 console.log(received[i]) 看每个节点收到的内容
    }

    for (let i = 0; i < N; i++) {
      bootstrap.push(nodes[i].getMultiaddrs()[0].toString());
    }

    // 6. 关闭节点
    await Promise.all(nodes.map((n) => n.stop()));
    await setTimeout(100);
  }, 10000); // 设置 10s 超时时间

  it("should mesh and gossip using bootstrap discovery", async () => {
    const N = 3;
    const nodes: Libp2p<any>[] = [];
    const ports = [16003, 16004, 16005];
    const topic = "sight-message";
    const received2: string[][] = [[], [], []];
    const BOOTSTRAP_ADDRS: string[] = (process.env.BOOTSTRAP_ADDRS ?? "")
      .split(",")
      .map((addr) => addr.trim())
      .filter(Boolean);

    // 1. 启动第一个节点（用0作为bootstrap）
    nodes.push(
      await createNode(
        privateKeys[0],
        ports[0],
        (msg, from) => {
          received2[0].push(JSON.stringify({ msg, from }));
        },
        // [BOOTSTRAP_ADDRS[0]]
        BOOTSTRAP_ADDRS.slice(0,4)
      )
    );

    const bootstrapAddr = nodes[0].getMultiaddrs()[0].toString();

    console.log("bootstrapAddr: ", bootstrapAddr);

    // 2. 启动其他节点，bootstrapList 一次为列表的1和2
    for (let i = 1; i < N; i++) {
      nodes.push(
        await createNode(
          privateKeys[i],
          ports[i],
          (msg, from) => {
            console.log(
              "[libp2p] Bootstrap Discovery Received message from",
              from
            );
            received2[i].push(JSON.stringify({ msg, from }));
            console.log(msg);
          },
          // [BOOTSTRAP_ADDRS[i]]
          BOOTSTRAP_ADDRS.slice(i+3,i+5)
        )
      );
    }

    await setTimeout(10000);
    for (let i = 0; i < nodes.length; i++) {
      console.log(`=== 节点${i}实际已连接 peer ===`);
      console.log(nodes[i].getPeers());

      console.log(`=== 节点${i} peerStore 里所有已知 peers ===`);
      const peerIds = await nodes[i].peerStore.all();
      for (const peer of peerIds) {
        const id = peer.id.toString();
        const addrs = peer.addresses.map((a) => a.multiaddr.toString());
        console.log(`peerId: ${id}, addrs: ${addrs.join(", ")}`);
      }
    }

    const payload = { text: `Hello again from node0 @${Date.now()}` };
    await nodes[0].services.pubsub.publish(
      topic,
      new TextEncoder().encode(JSON.stringify(payload))
    );

    await setTimeout(5000);

    // 7. 检查每个节点都收到消息
    for (let i = 0; i < N; i++) {
      expect(received2[i].length).toBeGreaterThan(0);
    }

    // 8. 关闭节点
    await Promise.all(nodes.map((n) => n.stop()));
    await setTimeout(100);
  }, 180000); // 设置 15s 超时时间（bootstrap discovery 需要更多时间）

});
