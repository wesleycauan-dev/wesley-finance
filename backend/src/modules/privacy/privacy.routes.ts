import crypto from "node:crypto";
import { Router } from "express";
import { z } from "zod";
import { pool, tx } from "../../db/pool.js";
import { requireAuth } from "../../middleware/auth.js";
import { AppError } from "../../utils/errors.js";
import { h, uid } from "../../utils/http.js";
import { hashPassword, verifyPassword } from "../../utils/security.js";
import { cancel } from "../billing/billing.service.js";

/** Direitos do titular (LGPD art. 18): portabilidade/acesso e eliminação. */
export const privacyRouter = Router();
privacyRouter.use(requireAuth);

privacyRouter.get(
  "/export",
  h(async (req, res) => {
    const id = uid(req);
    const q = (sql: string) => pool.query(sql, [id]).then((r) => r.rows);
    const [
      profile,
      preferences,
      subscription,
      consents,
      categories,
      transactions,
      goals,
      payments,
    ] = await Promise.all([
      q("SELECT id, name, email, role, created_at FROM users WHERE id=$1"),
      q(
        "SELECT theme, primary_color, background_color FROM user_preferences WHERE user_id=$1",
      ),
      q(
        "SELECT status, current_period_end FROM subscriptions WHERE user_id=$1",
      ),
      q(
        "SELECT type, version, accepted_at FROM consents WHERE user_id=$1 ORDER BY accepted_at",
      ),
      q(
        "SELECT name, type, color FROM categories WHERE user_id=$1 ORDER BY name",
      ),
      q(`SELECT t.type, c.name AS category, t.description, t.amount_cents, to_char(t.occurred_on,'YYYY-MM-DD') AS occurred_on, t.notes, t.created_at
       FROM transactions t JOIN categories c ON c.id=t.category_id WHERE t.user_id=$1 AND t.deleted_at IS NULL ORDER BY t.occurred_on`),
      q(
        `SELECT name, target_cents, current_cents, to_char(deadline,'YYYY-MM-DD') AS deadline, status FROM goals WHERE user_id=$1`,
      ),
      q(
        "SELECT amount_cents, status, paid_at, created_at FROM payments WHERE user_id=$1 ORDER BY created_at",
      ),
    ]);
    await pool.query(
      `INSERT INTO audit_logs(user_id,action,ip) VALUES ($1,'privacy.export',$2)`,
      [id, req.ip],
    );
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="wesley-finance-meus-dados.json"',
    );
    res.json({
      exportedAt: new Date().toISOString(),
      profile: profile[0],
      preferences: preferences[0],
      subscription: subscription[0],
      consents,
      categories,
      transactions,
      goals,
      payments,
    });
  }),
);

/**
 * Exclusão da conta: apaga lançamentos, categorias, metas, preferências e sessões; anonimiza o cadastro.
 * Mantém apenas pagamentos, consentimentos e auditoria (obrigação fiscal/legal e prova de consentimento), sem identificação direta.
 */
privacyRouter.delete(
  "/account",
  h(async (req, res) => {
    const { password } = z
      .object({ password: z.string().min(1).max(128) })
      .parse(req.body);
    const id = uid(req);
    const { rows } = await pool.query(
      `SELECT u.password_hash, u.role, s.status FROM users u JOIN subscriptions s ON s.user_id=u.id WHERE u.id=$1`,
      [id],
    );
    if (rows[0].role === "owner")
      throw new AppError(
        409,
        "A conta do proprietário não pode ser excluída por aqui",
        "OWNER_PROTECTED",
      );
    if (!(await verifyPassword(rows[0].password_hash, password)))
      throw new AppError(401, "Senha incorreta", "INVALID_CREDENTIALS");
    // Se houver cobrança recorrente, ela precisa ser cancelada ANTES de apagar (se falhar, aborta e o usuário tenta de novo).
    if (["active", "pending", "past_due"].includes(rows[0].status))
      await cancel(id);
    const anon = await hashPassword(crypto.randomBytes(32).toString("hex"));
    await tx(async (c) => {
      await c.query("DELETE FROM transactions WHERE user_id=$1", [id]);
      await c.query("DELETE FROM categories WHERE user_id=$1", [id]);
      await c.query("DELETE FROM goals WHERE user_id=$1", [id]);
      await c.query("DELETE FROM refresh_tokens WHERE user_id=$1", [id]);
      await c.query("DELETE FROM user_preferences WHERE user_id=$1", [id]);
      await c.query(
        `UPDATE subscriptions SET status='cancelled', updated_at=now() WHERE user_id=$1`,
        [id],
      );
      await c.query(
        `UPDATE users SET name='Conta excluída', email=$2, password_hash=$3, is_active=false, deleted_at=now(), updated_at=now() WHERE id=$1`,
        [id, `excluido+${id}@invalid.local`, anon],
      );
      await c.query(
        `INSERT INTO audit_logs(user_id,action,ip) VALUES ($1,'privacy.account_deleted',$2)`,
        [id, req.ip],
      );
    });
    res.clearCookie("wf_refresh", { path: "/api/auth" }).status(204).end();
  }),
);
