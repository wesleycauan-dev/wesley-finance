import { pool } from "../../db/pool.js";
import { env } from "../../config/env.js";
import { AppError } from "../../utils/errors.js";
import { mp, safeId } from "./mp.client.js";

interface Preapproval {
  id: string;
  status: string;
  next_payment_date?: string;
  auto_recurring?: { transaction_amount?: number | string };
}
interface AuthorizedPayment {
  id: number | string;
  preapproval_id: string;
  status?: string;
  transaction_amount?: number | string;
  debit_date?: string;
  payment?: { id?: number | string; status?: string };
}

const STATUS_MAP: Record<string, string> = {
  authorized: "active",
  pending: "pending",
  paused: "past_due",
  cancelled: "cancelled",
};
const audit = (userId: string | null, action: string, metadata: object = {}) =>
  pool.query(
    "INSERT INTO audit_logs(user_id,action,metadata) VALUES ($1,$2,$3)",
    [userId, action, metadata],
  );

export async function createCheckout(user: { id: string; role: string }) {
  if (user.role === "owner")
    throw new AppError(
      409,
      "O proprietário não precisa de assinatura",
      "OWNER_FREE",
    );
  const { rows } = await pool.query(
    `SELECT u.email, s.status FROM users u JOIN subscriptions s ON s.user_id=u.id WHERE u.id=$1`,
    [user.id],
  );
  if (rows[0].status === "active")
    throw new AppError(
      409,
      "Você já possui assinatura ativa",
      "ALREADY_ACTIVE",
    );
  const pre = await mp<Preapproval & { init_point: string }>(
    "POST",
    "/preapproval",
    {
      reason: "Wesley Finance - assinatura mensal",
      external_reference: user.id,
      payer_email: rows[0].email,
      back_url: `${env.FRONTEND_URL}/assinatura/retorno`,
      auto_recurring: {
        frequency: 1,
        frequency_type: "months",
        transaction_amount: env.SUBSCRIPTION_PRICE_CENTS / 100,
        currency_id: "BRL",
      },
      status: "pending",
    },
  );
  // Importante: NÃO ativa nada aqui. A liberação só ocorre pelo webhook confirmado.
  await pool.query(
    `UPDATE subscriptions SET mp_preapproval_id=$2, status='pending', updated_at=now() WHERE user_id=$1`,
    [user.id, pre.id],
  );
  await audit(user.id, "billing.checkout_created");
  return { checkoutUrl: pre.init_point };
}

/** Fonte da verdade = API do Mercado Pago (nunca o corpo do webhook). */
export async function syncPreapproval(preapprovalId: string): Promise<string> {
  const p = await mp<Preapproval>(
    "GET",
    `/preapproval/${safeId(preapprovalId)}`,
  );
  const { rows } = await pool.query(
    "SELECT user_id FROM subscriptions WHERE mp_preapproval_id=$1",
    [p.id],
  );
  if (!rows[0]) return "ignored_unknown_subscription";
  if (
    Math.round(Number(p.auto_recurring?.transaction_amount) * 100) !==
    env.SUBSCRIPTION_PRICE_CENTS
  ) {
    await audit(rows[0].user_id, "billing.amount_mismatch");
    return "ignored_amount_mismatch";
  }
  const status = STATUS_MAP[p.status] ?? "pending";
  await pool.query(
    `UPDATE subscriptions SET status=$2::subscription_status,
       current_period_end = CASE WHEN $2='active' AND $3::timestamptz IS NOT NULL THEN $3::timestamptz ELSE current_period_end END,
       updated_at=now() WHERE user_id=$1`,
    [rows[0].user_id, status, p.next_payment_date ?? null],
  );
  await audit(rows[0].user_id, "billing.subscription_synced", { status });
  return `synced_${status}`;
}

export async function syncAuthorizedPayment(id: string): Promise<string> {
  const a = await mp<AuthorizedPayment>(
    "GET",
    `/authorized_payments/${safeId(id)}`,
  );
  const { rows } = await pool.query(
    "SELECT user_id FROM subscriptions WHERE mp_preapproval_id=$1",
    [a.preapproval_id],
  );
  if (!rows[0]) return "ignored_unknown_subscription";
  const ps = a.payment?.status;
  const status =
    ps === "approved"
      ? "approved"
      : ps === "refunded"
        ? "refunded"
        : ps === "cancelled"
          ? "cancelled"
          : ps === "rejected" || a.status === "cancelled"
            ? "rejected"
            : "pending";
  await pool.query(
    `INSERT INTO payments(user_id,mp_authorized_payment_id,mp_payment_id,amount_cents,status,paid_at)
     VALUES ($1,$2,$3,$4,$5,CASE WHEN $5='approved' THEN COALESCE($6::timestamptz, now()) END)
     ON CONFLICT (mp_authorized_payment_id) DO UPDATE
       SET status=EXCLUDED.status, mp_payment_id=EXCLUDED.mp_payment_id,
           paid_at=COALESCE(payments.paid_at, EXCLUDED.paid_at), updated_at=now()`,
    [
      rows[0].user_id,
      String(a.id),
      a.payment?.id ? String(a.payment.id) : null,
      Math.round(Number(a.transaction_amount ?? 0) * 100),
      status,
      a.debit_date ?? null,
    ],
  );
  await syncPreapproval(a.preapproval_id); // atualiza status/vencimento
  return `payment_${status}`;
}

export async function cancel(userId: string) {
  const { rows } = await pool.query(
    "SELECT mp_preapproval_id AS id, status FROM subscriptions WHERE user_id=$1",
    [userId],
  );
  if (
    !rows[0]?.id ||
    !["active", "pending", "past_due"].includes(rows[0].status)
  )
    throw new AppError(
      409,
      "Nenhuma assinatura para cancelar",
      "NOTHING_TO_CANCEL",
    );
  await mp("PUT", `/preapproval/${safeId(rows[0].id)}`, {
    status: "cancelled",
  });
  // Mantém o acesso até o fim do período já pago (ver requireActiveAccess)
  await pool.query(
    `UPDATE subscriptions SET status='cancelled', updated_at=now() WHERE user_id=$1`,
    [userId],
  );
  await audit(userId, "billing.cancelled");
}
