import express from "express";
import helmet from "helmet";
import { env } from "./config/env.js";
import {
  errorHandler,
  requireActiveAccess,
  requireAuth,
} from "./middleware/auth.js";
import { authRouter } from "./modules/auth/auth.routes.js";
import { categoriesRouter } from "./modules/auth/categories/categories.routes.js";
import { dashboardRouter } from "./modules/auth/dashboard/dashboard.routes.js";
import { goalsRouter } from "./modules/auth/goals/goals.routes.js";
import { transactionsRouter } from "./modules/auth/transactions/transactions.routes.js";

export const app = express();
app.get("/api/health", (_req, res) => res.json({ status: "ok" }));
app.use("/api/auth", authRouter);

// Rotas financeiras: autenticado + (proprietário ou assinatura ativa)
const guard = [requireAuth, requireActiveAccess];
app.use("/api/categories", ...guard, categoriesRouter);
app.use("/api/transactions", ...guard, transactionsRouter);
app.use("/api/goals", ...guard, goalsRouter);
app.use("/api/dashboard", ...guard, dashboardRouter);

app.use(errorHandler);
