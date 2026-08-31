export type TransactionType =
  | "DEPOSIT"
  | "WITHDRAW"
  | "BET"
  | "WIN"
  | "LOSS"
  | "ADJUSTMENT";

export type BetOutcome = "WIN" | "LOSS" | "PENDING";

export interface CreditMovement {
  amount: string;
  type: TransactionType;
  refId?: string;
  txHash?: string;
  metadata?: Record<string, unknown>;
}
