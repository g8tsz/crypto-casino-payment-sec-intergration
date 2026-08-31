# Crypto Casino Payment & Credit Integration

Per-user credit system for a crypto casino: fund credits via wallet, track bets, wins, losses, deposits, and withdrawals.

## Features

- **Per-user credits** – Each user has a balance (e.g. USDC) stored as decimal strings for precision.
- **Wallet-based identity** – Users are identified by `walletAddress`; first use creates the user and balance.
- **Deposits** – Add credits (e.g. after verifying an on-chain deposit); optional `txHash` and `metadata`.
- **Withdrawals** – Deduct credits (e.g. before sending payout); optional `txHash` and `metadata`.
- **Bets** – Place a bet (stake deducted, bet record created with `PENDING`); later settle as WIN or LOSS.
- **Full audit trail** – All movements stored as transactions with `balanceAfter`; bet history and stats available.

## Data model

- **User** – `id`, `walletAddress` (unique)
- **CreditBalance** – `userId`, `credits`, `currency` (e.g. USDC)
- **Transaction** – `userId`, `type` (DEPOSIT | WITHDRAW | BET | WIN | LOSS | ADJUSTMENT), `amount`, `balanceAfter`, `txHash`, `refId`, `metadata`
- **Bet** – `userId`, `amount`, `outcome` (PENDING | WIN | LOSS), `payout`, `gameRef`

## Setup

```bash
cp .env.example .env
# Edit .env if needed (DATABASE_URL, PORT)

npm install
npm run db:generate
npm run db:push
```

## Run

```bash
npm run dev
# or
npm run build && npm start
```

API base: `http://localhost:3000`

## API

### Users

- `GET /api/users/by-wallet/:walletAddress` – Get or create user by wallet; returns `userId`, `walletAddress`, `credits`, `currency`.
- `GET /api/users/:userId/balance` – Get current credits.
- `GET /api/users/:userId/stats` – Get aggregates: `totalBets`, `totalWins`, `totalLosses`, `totalDeposits`, `totalWithdrawals`, `betCount`, `winCount`, `lossCount`.

### Credits & transactions

- `POST /api/credits/deposit` – Body: `{ "walletAddress", "amount", "txHash?", "metadata?" }`. Adds credits and records a DEPOSIT.
- `POST /api/credits/withdraw` – Body: `{ "walletAddress", "amount", "txHash?", "metadata?" }`. Deducts credits and records a WITHDRAW (fails if insufficient balance).
- `POST /api/credits/bet` – Body: `{ "walletAddress", "amount", "gameRef?" }`. Deducts stake, creates a PENDING bet, records a BET tx. Returns `betId`, `balanceAfter`.
- `POST /api/credits/bet/:betId/settle` – Body: `{ "outcome": "WIN" | "LOSS", "payout": "..." }`. Sets bet outcome, adds payout for WIN (or records LOSS), and creates WIN/LOSS transaction.
- `GET /api/credits/transactions/:userId` – Query: `limit`, `offset`. List transactions for the user.
- `GET /api/credits/bets/:userId` – Query: `limit`, `offset`. List bets for the user.

### Health

- `GET /health` – Returns `{ "status": "ok" }`.

## Pushing to GitHub

Repo: [g8tsz/crypto-casino-payment-sec-intergration](https://github.com/g8tsz/crypto-casino-payment-sec-intergration)

```bash
git init
git add .
git commit -m "Crypto casino payment and credit system with wallet, bets, deposits, withdrawals"
git remote add origin https://github.com/g8tsz/crypto-casino-payment-sec-intergration.git
git branch -M main
git push -u origin main
```

## Security notes

- In production, add authentication (e.g. wallet signature verification) and authorize actions by verified wallet.
- Validate on-chain deposits before crediting; record `txHash` for deposits/withdrawals.
- Use HTTPS and secure secrets; consider rate limiting and idempotency for deposit/withdraw.
