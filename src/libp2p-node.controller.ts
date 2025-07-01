import { Router } from "express";
import { Libp2pNodeService } from "./libp2p-node.service.js";

export class Libp2pNodeController {
  public router: Router;

  constructor(public nodeService: Libp2pNodeService) {
    this.router = Router();
    this.router.post("/send", async (req, res) => {
      try {
        const tunnelMsg = req.body;
        const libp2pMsg = {
          to: tunnelMsg.to,
          payload: tunnelMsg,
        };
        const result = await this.nodeService.handleOutcomeMessage(libp2pMsg);
        res.json({ status: "ok", result });
      } catch (e: any) {
        res
          .status(500)
          .json({ status: "error", message: e?.message || "Internal Error" });
      }
    });
  }
}
