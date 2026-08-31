import "dotenv/config";
import express from "express";
import { usersRouter } from "./routes/users.js";
import { creditsRouter } from "./routes/credits.js";

const app = express();
const PORT = process.env.PORT ?? 3000;

app.use(express.json());

app.use("/api/users", usersRouter);
app.use("/api/credits", creditsRouter);

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.listen(PORT, () => {
  console.log(`Crypto casino payment API listening on http://localhost:${PORT}`);
});
