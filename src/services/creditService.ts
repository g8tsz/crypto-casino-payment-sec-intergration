import { prisma } from "../db/client.js";
import type { TransactionType } from "../types/index.js";

const ZERO = "0";

function add(a: string, b: string): string {
  return (parseFloat(a) + parseFloat(b)).toFixed(8);
}

function sub(a: string, b: string): string {
  return (parseFloat(a) - parseFloat(b)).toFixed(8);
}

function gte(a: string, b: string): boolean {
  return parseFloat(a) >= parseFloat(b);
}

export async function getOrCreateUserByWallet(walletAddress: string) {
  const normalized = walletAddress.trim().toLowerCase();
  let user = await prisma.user.findUnique({
    where: { walletAddress: normalized },
    include: { balance: true },
  });
  if (!user) {
    user = await prisma.user.create({
      data: {
        walletAddress: normalized,
        balance: {
          create: { credits: ZERO, currency: "USDC" },
        },
      },
      include: { balance: true },
    });
  }
  return user;
}

export async function getCredits(userId: string): Promise<string> {
  const balance = await prisma.creditBalance.findUnique({
    where: { userId },
  });
  return balance?.credits ?? ZERO;
}

export async function deposit(
  userId: string,
  amount: string,
  txHash?: string,
  metadata?: Record<string, unknown>
): Promise<{ balanceAfter: string }> {
  const amt = parseFloat(amount);
  if (isNaN(amt) || amt <= 0) throw new Error("Invalid deposit amount");

  const balance = await prisma.creditBalance.findUnique({ where: { userId } });
  if (!balance) throw new Error("User balance not found");

  const newCredits = add(balance.credits, amount);

  await prisma.$transaction([
    prisma.creditBalance.update({
      where: { userId },
      data: { credits: newCredits },
    }),
    prisma.transaction.create({
      data: {
        userId,
        type: "DEPOSIT",
        amount: `+${amount}`,
        balanceAfter: newCredits,
        txHash: txHash ?? null,
        metadata: metadata ? JSON.stringify(metadata) : null,
      },
    }),
  ]);

  return { balanceAfter: newCredits };
}

export async function withdraw(
  userId: string,
  amount: string,
  txHash?: string,
  metadata?: Record<string, unknown>
): Promise<{ balanceAfter: string }> {
  const amt = parseFloat(amount);
  if (isNaN(amt) || amt <= 0) throw new Error("Invalid withdraw amount");

  const balance = await prisma.creditBalance.findUnique({ where: { userId } });
  if (!balance) throw new Error("User balance not found");
  if (!gte(balance.credits, amount)) throw new Error("Insufficient credits");

  const newCredits = sub(balance.credits, amount);

  await prisma.$transaction([
    prisma.creditBalance.update({
      where: { userId },
      data: { credits: newCredits },
    }),
    prisma.transaction.create({
      data: {
        userId,
        type: "WITHDRAW",
        amount: `-${amount}`,
        balanceAfter: newCredits,
        txHash: txHash ?? null,
        metadata: metadata ? JSON.stringify(metadata) : null,
      },
    }),
  ]);

  return { balanceAfter: newCredits };
}

export async function placeBet(
  userId: string,
  amount: string,
  gameRef?: string
): Promise<{ betId: string; balanceAfter: string }> {
  const amt = parseFloat(amount);
  if (isNaN(amt) || amt <= 0) throw new Error("Invalid bet amount");

  const balance = await prisma.creditBalance.findUnique({ where: { userId } });
  if (!balance) throw new Error("User balance not found");
  if (!gte(balance.credits, amount)) throw new Error("Insufficient credits");

  const newCredits = sub(balance.credits, amount);

  const bet = await prisma.$transaction(async (tx) => {
    const b = await tx.bet.create({
      data: {
        userId,
        amount,
        outcome: "PENDING",
        gameRef: gameRef ?? null,
      },
    });
    await tx.creditBalance.update({
      where: { userId },
      data: { credits: newCredits },
    });
    await tx.transaction.create({
      data: {
        userId,
        type: "BET",
        amount: `-${amount}`,
        balanceAfter: newCredits,
        refId: b.id,
        metadata: gameRef ? JSON.stringify({ gameRef }) : null,
      },
    });
    return b;
  });

  return { betId: bet.id, balanceAfter: newCredits };
}

export async function settleBet(
  betId: string,
  outcome: "WIN" | "LOSS",
  payout: string
): Promise<{ balanceAfter: string }> {
  const bet = await prisma.bet.findUnique({
    where: { id: betId },
  });
  if (!bet) throw new Error("Bet not found");
  if (bet.outcome !== "PENDING") throw new Error("Bet already settled");

  const balance = await prisma.creditBalance.findUnique({
    where: { userId: bet.userId },
  });
  if (!balance) throw new Error("User balance not found");

  const payoutNum = parseFloat(payout);
  if (outcome === "WIN" && (isNaN(payoutNum) || payoutNum < 0)) {
    throw new Error("Invalid payout for WIN");
  }
  const creditDelta = outcome === "WIN" ? payout : ZERO;
  const newCredits = add(balance.credits, creditDelta);
  const txType: TransactionType = outcome === "WIN" ? "WIN" : "LOSS";
  const txAmount = outcome === "WIN" ? `+${payout}` : `-${bet.amount}`;

  await prisma.$transaction([
    prisma.bet.update({
      where: { id: betId },
      data: { outcome, payout: outcome === "WIN" ? payout : "0" },
    }),
    prisma.creditBalance.update({
      where: { userId: bet.userId },
      data: { credits: newCredits },
    }),
    prisma.transaction.create({
      data: {
        userId: bet.userId,
        type: txType,
        amount: txAmount,
        balanceAfter: newCredits,
        refId: betId,
      },
    }),
  ]);

  return { balanceAfter: newCredits };
}

export async function getTransactionHistory(
  userId: string,
  limit = 50,
  offset = 0
) {
  return prisma.transaction.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: limit,
    skip: offset,
  });
}

export async function getBetHistory(
  userId: string,
  limit = 50,
  offset = 0
) {
  return prisma.bet.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: limit,
    skip: offset,
  });
}

export async function getStats(userId: string) {
  const [bets, transactions] = await Promise.all([
    prisma.bet.findMany({ where: { userId } }),
    prisma.transaction.findMany({ where: { userId } }),
  ]);

  const totalBets = bets.reduce((s, b) => s + parseFloat(b.amount), 0);
  const wins = bets.filter((b) => b.outcome === "WIN");
  const losses = bets.filter((b) => b.outcome === "LOSS");
  const totalWins = wins.reduce((s, b) => s + parseFloat(b.payout ?? "0"), 0);
  const totalLosses = losses.reduce((s, b) => s + parseFloat(b.amount), 0);
  const deposits = transactions
    .filter((t) => t.type === "DEPOSIT")
    .reduce((s, t) => s + Math.abs(parseFloat(t.amount)), 0);
  const withdraws = transactions
    .filter((t) => t.type === "WITHDRAW")
    .reduce((s, t) => s + Math.abs(parseFloat(t.amount)), 0);

  return {
    totalBets,
    totalWins,
    totalLosses,
    totalDeposits: deposits,
    totalWithdrawals: withdraws,
    betCount: bets.length,
    winCount: wins.length,
    lossCount: losses.length,
  };
}
