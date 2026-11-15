import { Router } from "express";
import { z } from "zod";
import { pool } from "../../../db/pool.js";
import { h, uid } from "../../../utils/http.js";

const q = z.object({
  month: z
    .string()
    .regex(/^\d{4}-(0[1-9]|1[0-2])$/)
    .optional(),
}); // YYYY-MM
export const dashboardRouter = Router();

dashboardRouter.get(
  "/summary",
  h(async (req, res) => {
    const { month } = q.parse(req.query);
    const start = month ? `${month}-01` : null;
    const base = `date_trunc('month', COALESCE($2::date, current_date))::date`;
    const [totals, byCat, series, goals] = await Promise.all([
      pool.query(
        `SELECT type, COALESCE(SUM(amount_cents),0)::float8 AS total FROM transactions
      WHERE user_id=$1 AND deleted_at IS NULL AND occurred_on >= ${base} AND occurred_on < ${base} + interval '1 month' GROUP BY type`,
        [uid(req), start],
      ),
      pool.query(
        `SELECT c.name, c.color, SUM(t.amount_cents)::float8 AS total FROM transactions t
      JOIN categories c ON c.id=t.category_id AND c.user_id=t.user_id
      WHERE t.user_id=$1 AND t.deleted_at IS NULL AND t.type='expense'
        AND t.occurred_on >= ${base} AND t.occurred_on < ${base} + interval '1 month'
      GROUP BY c.name, c.color ORDER BY total DESC`,
        [uid(req), start],
      ),
      pool.query(
        `SELECT to_char(date_trunc('month', occurred_on),'YYYY-MM') AS month,
        COALESCE(SUM(amount_cents) FILTER (WHERE type='income'),0)::float8 AS income,
        COALESCE(SUM(amount_cents) FILTER (WHERE type='expense'),0)::float8 AS expense
      FROM transactions WHERE user_id=$1 AND deleted_at IS NULL
        AND occurred_on >= ${base} - interval '5 months' AND occurred_on < ${base} + interval '1 month'
      GROUP BY 1 ORDER BY 1`,
        [uid(req), start],
      ),
      pool.query(
        `SELECT count(*) FILTER (WHERE status='active')::int AS active, count(*) FILTER (WHERE status='completed')::int AS completed
      FROM goals WHERE user_id=$1`,
        [uid(req)],
      ),
    ]);
    const get = (t: string) =>
      Number(totals.rows.find((r) => r.type === t)?.total ?? 0);
    const incomeCents = get("income"),
      expenseCents = get("expense");
    res.json({
      month: month ?? new Date().toISOString().slice(0, 7),
      incomeCents,
      expenseCents,
      balanceCents: incomeCents - expenseCents,
      expensesByCategory: byCat.rows,
      monthlySeries: series.rows,
      goals: goals.rows[0],
    });
  }),
);
