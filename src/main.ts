import express from "express";
import bodyParser from "body-parser";
import "dotenv/config";
import nacl from "tweetnacl";

import { Libp2pNodeService } from "./libp2p-node.service.js";
import { Libp2pNodeController } from "./libp2p-node.controller";
import { loadOrGenerateKeyPair, parseBootstrapList } from "./libp2p-utils.js";

type StartLibP2PServerArgs = {
  expressPort: number;
  keyPair: nacl.SignKeyPair;
  nodePort: number;
  tunnelAPI: string;
  isGateway: boolean;
  bootstrapList: string[];
};

export async function startLibP2PServer({
                                          expressPort,
                                          keyPair,
                                          nodePort,
                                          tunnelAPI,
                                          isGateway,
                                          bootstrapList,
                                        }: StartLibP2PServerArgs) {
  const nodeService = new Libp2pNodeService(keyPair, nodePort, tunnelAPI, isGateway, bootstrapList);
  await nodeService.initNode();

  const controller = new Libp2pNodeController(nodeService);

  const app = express();
  app.use(bodyParser.json());
  app.use("/libp2p", controller.router);

  const server = app.listen(expressPort, () => {
    console.log(`Libp2p app started at http://localhost:${expressPort}`);
  });

  const shutdown = async () => {
    console.log("Shutting down server and libp2p node...");
    await nodeService.getNode()?.stop?.();
    server.close(() => {
      console.log("Libp2p server closed.");
      process.exit(0);
    });
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  return app;
}

(async () => {
  const IS_GATEWAY = process.env.IS_GATEWAY === "1";
  const LIBP2P_PORT = Number(process.env.LIBP2P_PORT) || 4010;
  const NODE_PORT = Number(process.env.NODE_PORT) || 15050;
  const API_PORT = Number(process.env.API_PORT) || 8716;
  const BOOTSTRAP_ADDRS = process.env.BOOTSTRAP_ADDRS || "";

  const tunnelAPI = `http://localhost:${API_PORT}/libp2p/message`;
  const bootstrapList = parseBootstrapList(BOOTSTRAP_ADDRS);
  const keyPair = await loadOrGenerateKeyPair();

  await startLibP2PServer({
    expressPort: LIBP2P_PORT,
    nodePort: NODE_PORT,
    keyPair,
    tunnelAPI,
    isGateway: IS_GATEWAY,
    bootstrapList,
  });
})();

process.on("uncaughtException", (err) => {
  console.error("❌ Uncaught Exception:", err);
});
process.on("unhandledRejection", (reason) => {
  console.error("❌ Unhandled Rejection:", reason);
});