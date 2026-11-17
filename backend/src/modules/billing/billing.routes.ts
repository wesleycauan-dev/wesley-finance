import { Router } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { env } from "../../config/env.js";
import { pool } from "../../db/pool.js";
import { requireAuth } from "../../middleware/auth.js";
import { AppError } from "../../utils/errors.js";
import { h, uid } from "../../utils/http.js";
import * as svc from "./billing.service.js";
import { safeId } from "./mp.client.js";
import { verifyMpSignature } from "./signature.js";

export const billingRouter = Router();
billingRouter.use(requireAuth);

billingRouter.post(
  "/checkout",
  rateLimit({ windowMs: 60_000, limit: 5 }),
  h(async (req, res) => {
    res.status(201).json(await svc.createCheckout(req.user!));
  }),
);
billingRouter.post(
  "/cancel",
  h(async (req, res) => {
    await svc.cancel(uid(req));
    res.status(204).end();
  }),
);
billingRouter.get(
  "/status",
  h(async (req, res) => {
    const { rows } = await pool.query(
      `SELECT status, current_period_end AS "currentPeriodEnd" FROM subscriptions WHERE user_id=$1`,
      [uid(req)],
    );
    res.json({
      ...rows[0],
      priceCents: env.SUBSCRIPTION_PRICE_CENTS,
      isOwner: req.user!.role === "owner",
    });
  }),
);
billingRouter.get(
  "/payments",
  h(async (req, res) => {
    const { page, limit } = z
      .object({
        page: z.coerce.number().int().min(1).default(1),
        limit: z.coerce.number().int().min(1).max(50).default(20),
      })
      .parse(req.query);
    const { rows } = await pool.query(
      `SELECT id, amount_cents::float8 AS "amountCents", status, paid_at AS "paidAt", created_at AS "createdAt"
     FROM payments WHERE user_id=$1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
      [uid(req), limit, (page - 1) * limit],
    );
    res.json({ data: rows, page, limit });
  }),
);

/** Webhook: sem login; a autenticidade vem da assinatura HMAC. */
export const mpWebhookRouter = Router();
mpWebhookRouter.post(
  "/",
  rateLimit({ windowMs: 60_000, limit: 300 }),
  h(async (req, res) => {
    if (!env.MP_WEBHOOK_SECRET)
      throw new AppError(503, "Webhook não configurado", "MP_NOT_CONFIGURED");
    const dataId =
      typeof req.query["data.id"] === "string"
        ? req.query["data.id"]
        : undefined;
    const valid = verifyMpSignature({
      xSignature: req.get("x-signature"),
      xRequestId: req.get("x-request-id"),
      dataId,
      secret: env.MP_WEBHOOK_SECRET,
    });
    if (!valid) throw new AppError(401, "Assinatura inválida", "BAD_SIGNATURE");

    const topic = String(
      req.body?.type ?? req.query.type ?? req.query.topic ?? "",
    ).slice(0, 60);
    const ev = await pool.query(
      "INSERT INTO webhook_events(topic,resource_id,request_id) VALUES ($1,$2,$3) RETURNING id",
      [topic, dataId?.slice(0, 80), req.get("x-request-id")?.slice(0, 80)],
    );
    let outcome = "ignored_topic";
    try {
      const id = safeId(dataId);
      if (topic === "subscription_preapproval")
        outcome = await svc.syncPreapproval(id);
      else if (topic === "subscription_authorized_payment")
        outcome = await svc.syncAuthorizedPayment(id);
    } catch (e) {
      if (e instanceof AppError && ["MP_NOT_FOUND", "BAD_ID"].includes(e.code))
        outcome = e.code.toLowerCase(); // não adianta o MP reenviar
      else {
        await pool.query(
          `UPDATE webhook_events SET outcome='error' WHERE id=$1`,
          [ev.rows[0].id],
        );
        throw e;
      } // 5xx → MP reenvia
    }
    await pool.query("UPDATE webhook_events SET outcome=$2 WHERE id=$1", [
      ev.rows[0].id,
      outcome,
    ]);
    res.sendStatus(200);
  }),
);
