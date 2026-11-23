import { Router } from "express";
import { z } from "zod";
import { env } from "../../config/env.js";
import { pool } from "../../db/pool.js";
import { requireAuth, requireOwner } from "../../middleware/auth.js";
import { AppError } from "../../utils/errors.js";
import { h, idParam, uid } from "../../utils/http.js";

/** Painel exclusivo do proprietário. Por privacidade, o admin NÃO enxerga lançamentos, categorias ou metas dos usuários. */
export const adminRouter = Router();
adminRouter.use(requireAuth, requireOwner);

const paging = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

adminRouter.get(
  "/overview",
  h(async (_req, res) => {
    const [u, s, p] = await Promise.all([
      pool.query(`SELECT count(*)::int AS users, count(*) FILTER (WHERE created_at > now() - interval '30 days')::int AS "newUsers30"
                FROM users WHERE role='user' AND deleted_at IS NULL`),
      pool.query(`SELECT count(*) FILTER (WHERE s.status='active')::int AS active, count(*) FILTER (WHERE s.status='pending')::int AS pending,
                count(*) FILTER (WHERE s.status='past_due')::int AS "pastDue", count(*) FILTER (WHERE s.status='cancelled')::int AS cancelled
                FROM subscriptions s JOIN users u ON u.id=s.user_id WHERE u.role='user' AND u.deleted_at IS NULL`),
      pool.query(`SELECT COALESCE(SUM(amount_cents) FILTER (WHERE status='approved' AND paid_at > now() - interval '30 days'),0)::float8 AS "revenue30Cents",
                COALESCE(SUM(amount_cents) FILTER (WHERE status='approved'),0)::float8 AS "revenueTotalCents" FROM payments`),
    ]);
    res.json({
      ...u.rows[0],
      ...s.rows[0],
      ...p.rows[0],
      mrrCents: s.rows[0].active * env.SUBSCRIPTION_PRICE_CENTS,
    });
  }),
);

adminRouter.get(
  "/users",
  h(async (req, res) => {
    const q = paging
      .extend({
        search: z.string().trim().max(100).optional(),
        status: z
          .enum(["none", "pending", "active", "past_due", "cancelled"])
          .optional(),
      })
      .parse(req.query);
    const where = ["u.deleted_at IS NULL"];
    const p: unknown[] = [];
    if (q.search) {
      p.push(q.search.replace(/[\\%_]/g, "\\$&"));
      where.push(
        `(u.email ILIKE '%'||$${p.length}||'%' OR u.name ILIKE '%'||$${p.length}||'%')`,
      );
    }
    if (q.status) {
      p.push(q.status);
      where.push(`s.status=$${p.length}::subscription_status`);
    }
    const from = `FROM users u JOIN subscriptions s ON s.user_id=u.id WHERE ${where.join(" AND ")}`;
    const [list, total] = await Promise.all([
      pool.query(
        `SELECT u.id, u.name, u.email, u.role, u.is_active AS "isActive", u.created_at AS "createdAt", s.status, s.current_period_end AS "currentPeriodEnd"
                ${from} ORDER BY u.created_at DESC LIMIT ${q.limit} OFFSET ${(q.page - 1) * q.limit}`,
        p,
      ),
      pool.query(`SELECT count(*)::int AS n ${from}`, p),
    ]);
    res.json({
      data: list.rows,
      page: q.page,
      limit: q.limit,
      total: total.rows[0].n,
    });
  }),
);

adminRouter.patch(
  "/users/:id/active",
  h(async (req, res) => {
    const { id } = idParam.parse(req.params);
    const { isActive } = z.object({ isActive: z.boolean() }).parse(req.body);
    const r = await pool.query(
      `UPDATE users SET is_active=$2, updated_at=now() WHERE id=$1 AND role='user' AND deleted_at IS NULL`,
      [id, isActive],
    );
    if (!r.rowCount)
      throw new AppError(404, "Usuário não encontrado", "NOT_FOUND");
    if (!isActive)
      await pool.query(
        "UPDATE refresh_tokens SET revoked_at=now() WHERE user_id=$1 AND revoked_at IS NULL",
        [id],
      );
    await pool.query(
      "INSERT INTO audit_logs(user_id,action,metadata) VALUES ($1,$2,$3)",
      [
        id,
        isActive ? "admin.user_unblocked" : "admin.user_blocked",
        { actorId: uid(req) },
      ],
    );
    res.status(204).end();
  }),
);

adminRouter.get(
  "/payments",
  h(async (req, res) => {
    const { page, limit } = paging.parse(req.query);
    const { rows } = await pool.query(
      `SELECT p.id, u.email, p.amount_cents::float8 AS "amountCents", p.status, p.paid_at AS "paidAt", p.created_at AS "createdAt"
     FROM payments p JOIN users u ON u.id=p.user_id ORDER BY p.created_at DESC LIMIT $1 OFFSET $2`,
      [limit, (page - 1) * limit],
    );
    res.json({ data: rows, page, limit });
  }),
);
