import { Router } from "express";
import { z } from "zod";
import { getOrCreateUserByWallet, getCredits, getStats } from "../services/creditService.js";

export const usersRouter = Router();

const walletSchema = z.object({
  walletAddress: z.string().min(1).max(256),
});

usersRouter.get("/by-wallet/:walletAddress", async (req, res) => {
  const parsed = walletSchema.safeParse({ walletAddress: req.params.walletAddress });
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid wallet address" });
  }
  try {
    const user = await getOrCreateUserByWallet(parsed.data.walletAddress);
    const credits = user.balance?.credits ?? "0";
    return res.json({
      userId: user.id,
      walletAddress: user.walletAddress,
      credits,
      currency: user.balance?.currency ?? "USDC",
    });
  } catch (e) {
    return res.status(500).json({ error: (e as Error).message });
  }
});

usersRouter.get("/:userId/balance", async (req, res) => {
  try {
    const credits = await getCredits(req.params.userId);
    return res.json({ credits, currency: "USDC" });
  } catch (e) {
    return res.status(500).json({ error: (e as Error).message });
  }
});

usersRouter.get("/:userId/stats", async (req, res) => {
  try {
    const stats = await getStats(req.params.userId);
    return res.json(stats);
  } catch (e) {
    return res.status(500).json({ error: (e as Error).message });
  }
});
