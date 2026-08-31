import { Router } from "express";
import { z } from "zod";
import {
  getOrCreateUserByWallet,
  deposit,
  withdraw,
  placeBet,
  settleBet,
  getTransactionHistory,
  getBetHistory,
} from "../services/creditService.js";

export const creditsRouter = Router();

const settleSchema = z.object({
  outcome: z.enum(["WIN", "LOSS"]),
  payout: z.string().refine((s) => !isNaN(parseFloat(s)) && parseFloat(s) >= 0),
});

creditsRouter.post("/deposit", async (req, res) => {
  const body = z
    .object({
      walletAddress: z.string().min(1),
      amount: z.string().refine((s) => !isNaN(parseFloat(s)) && parseFloat(s) > 0),
      txHash: z.string().optional(),
      metadata: z.record(z.unknown()).optional(),
    })
    .safeParse(req.body);
  if (!body.success) {
    return res.status(400).json({ error: "Invalid body", details: body.error.flatten() });
  }
  try {
    const user = await getOrCreateUserByWallet(body.data.walletAddress);
    const result = await deposit(
      user.id,
      body.data.amount,
      body.data.txHash,
      body.data.metadata
    );
    return res.json({ balanceAfter: result.balanceAfter, userId: user.id });
  } catch (e) {
    return res.status(400).json({ error: (e as Error).message });
  }
});

creditsRouter.post("/withdraw", async (req, res) => {
  const body = z
    .object({
      walletAddress: z.string().min(1),
      amount: z.string().refine((s) => !isNaN(parseFloat(s)) && parseFloat(s) > 0),
      txHash: z.string().optional(),
      metadata: z.record(z.unknown()).optional(),
    })
    .safeParse(req.body);
  if (!body.success) {
    return res.status(400).json({ error: "Invalid body", details: body.error.flatten() });
  }
  try {
    const user = await getOrCreateUserByWallet(body.data.walletAddress);
    const result = await withdraw(
      user.id,
      body.data.amount,
      body.data.txHash,
      body.data.metadata
    );
    return res.json({ balanceAfter: result.balanceAfter, userId: user.id });
  } catch (e) {
    return res.status(400).json({ error: (e as Error).message });
  }
});

creditsRouter.post("/bet", async (req, res) => {
  const body = z
    .object({
      walletAddress: z.string().min(1),
      amount: z.string().refine((s) => !isNaN(parseFloat(s)) && parseFloat(s) > 0),
      gameRef: z.string().optional(),
    })
    .safeParse(req.body);
  if (!body.success) {
    return res.status(400).json({ error: "Invalid body", details: body.error.flatten() });
  }
  try {
    const user = await getOrCreateUserByWallet(body.data.walletAddress);
    const result = await placeBet(user.id, body.data.amount, body.data.gameRef);
    return res.json(result);
  } catch (e) {
    return res.status(400).json({ error: (e as Error).message });
  }
});

creditsRouter.post("/bet/:betId/settle", async (req, res) => {
  const settle = settleSchema.safeParse(req.body);
  if (!settle.success) {
    return res.status(400).json({ error: "Invalid body", details: settle.error.flatten() });
  }
  try {
    const result = await settleBet(
      req.params.betId,
      settle.data.outcome,
      settle.data.payout
    );
    return res.json(result);
  } catch (e) {
    return res.status(400).json({ error: (e as Error).message });
  }
});

creditsRouter.get("/transactions/:userId", async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 50, 100);
  const offset = Number(req.query.offset) || 0;
  try {
    const list = await getTransactionHistory(req.params.userId, limit, offset);
    return res.json({ transactions: list });
  } catch (e) {
    return res.status(500).json({ error: (e as Error).message });
  }
});

creditsRouter.get("/bets/:userId", async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 50, 100);
  const offset = Number(req.query.offset) || 0;
  try {
    const list = await getBetHistory(req.params.userId, limit, offset);
    return res.json({ bets: list });
  } catch (e) {
    return res.status(500).json({ error: (e as Error).message });
  }
});
