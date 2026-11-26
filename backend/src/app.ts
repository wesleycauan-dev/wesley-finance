import express from "express";
import helmet from "helmet";
import { env } from "./config/env.js";
import {
  billingRouter,
  mpWebhookRouter,
} from "./modules/billing/billing.routes.js";
import {
  errorHandler,
  requireActiveAccess,
  requireAuth,
} from "./middleware/auth.js";
import { authRouter } from "./modules/auth/auth.routes.js";
import { adminRouter } from "./modules/admin/admin.routes.js";
import { privacyRouter } from "./modules/privacy/privacy.routes.js";
import { categoriesRouter } from "./modules/auth/categories/categories.routes.js";
import { dashboardRouter } from "./modules/auth/dashboard/dashboard.routes.js";
import { goalsRouter } from "./modules/auth/goals/goals.routes.js";
import { transactionsRouter } from "./modules/auth/transactions/transactions.routes.js";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const app = express();
app.get("/api/health", (_req, res) => res.json({ status: "ok" }));
app.use("/api/auth", authRouter);
app.use("/api/admin", adminRouter);
app.use("/api/privacy", privacyRouter);
app.use("/api/billing", billingRouter);
app.use("/api/webhooks/mercadopago", mpWebhookRouter);

// Rotas financeiras: autenticado + (proprietário ou assinatura ativa)
const guard = [requireAuth, requireActiveAccess];
app.use("/api/categories", ...guard, categoriesRouter);
app.use("/api/transactions", ...guard, transactionsRouter);
app.use("/api/goals", ...guard, goalsRouter);
app.use("/api/dashboard", ...guard, dashboardRouter);
const webDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../frontend/dist",
);
if (existsSync(webDir)) {
  app.use(express.static(webDir, { index: false }));
  app.get(/^\/(?!api(\/|$)).*/, (_req, res) =>
    res.sendFile(path.join(webDir, "index.html")),
  );
}

app.use(errorHandler);
