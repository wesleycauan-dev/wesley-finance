import { Router } from "express";
import { z } from "zod";
import { pool } from "../../../db/pool.js";
import { AppError } from "../../../utils/errors.js";
import { cents, h, idParam, isoDate, uid } from "../../../utils/http.js";

const body = z.object({
  type: z.enum(["income", "expense"]),
  categoryId: z.string().uuid(),
  description: z.string().trim().min(1).max(160),
  amountCents: cents,
  occurredOn: isoDate,
  notes: z.string().trim().max(500).optional(),
});
const listQuery = z.object({
  type: z.enum(["income", "expense"]).optional(),
  categoryId: z.string().uuid().optional(),
  from: isoDate.optional(),
  to: isoDate.optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
const COLS = `t.id, t.type, t.category_id AS "categoryId", c.name AS "categoryName", c.color AS "categoryColor",
  t.description, t.amount_cents::float8 AS "amountCents", to_char(t.occurred_on,'YYYY-MM-DD') AS "occurredOn", t.notes`;
const FROM =
  "FROM transactions t JOIN categories c ON c.id=t.category_id AND c.user_id=t.user_id";

async function assertCategory(
  userId: string,
  categoryId: string,
  type: string,
) {
  const { rowCount } = await pool.query(
    "SELECT 1 FROM categories WHERE id=$1 AND user_id=$2 AND type=$3",
    [categoryId, userId, type],
  );
  if (!rowCount)
    throw new AppError(
      422,
      "Categoria inválida para este tipo de lançamento",
      "INVALID_CATEGORY",
    );
}

export const transactionsRouter = Router();

transactionsRouter.get(
  "/",
  h(async (req, res) => {
    const q = listQuery.parse(req.query);
    const where = ["t.user_id=$1", "t.deleted_at IS NULL"];
    const p: unknown[] = [uid(req)];
    const add = (sql: string, v: unknown) => {
      p.push(v);
      where.push(sql.replace("?", `$${p.length}`));
    };
    if (q.type) add("t.type=?", q.type);
    if (q.categoryId) add("t.category_id=?", q.categoryId);
    if (q.from) add("t.occurred_on>=?", q.from);
    if (q.to) add("t.occurred_on<=?", q.to);
    const w = where.join(" AND ");
    const [list, total] = await Promise.all([
      pool.query(
        `SELECT ${COLS} ${FROM} WHERE ${w} ORDER BY t.occurred_on DESC, t.created_at DESC LIMIT ${q.limit} OFFSET ${(q.page - 1) * q.limit}`,
        p,
      ),
      pool.query(`SELECT count(*)::int AS n ${FROM} WHERE ${w}`, p),
    ]);
    res.json({
      data: list.rows,
      page: q.page,
      limit: q.limit,
      total: total.rows[0].n,
    });
  }),
);

transactionsRouter.get(
  "/:id",
  h(async (req, res) => {
    const { id } = idParam.parse(req.params);
    const { rows } = await pool.query(
      `SELECT ${COLS} ${FROM} WHERE t.id=$1 AND t.user_id=$2 AND t.deleted_at IS NULL`,
      [id, uid(req)],
    );
    if (!rows[0])
      throw new AppError(404, "Lançamento não encontrado", "NOT_FOUND");
    res.json(rows[0]);
  }),
);

transactionsRouter.post(
  "/",
  h(async (req, res) => {
    const b = body.parse(req.body);
    await assertCategory(uid(req), b.categoryId, b.type);
    const { rows } = await pool.query(
      `INSERT INTO transactions(user_id,category_id,type,description,amount_cents,occurred_on,notes)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
      [
        uid(req),
        b.categoryId,
        b.type,
        b.description,
        b.amountCents,
        b.occurredOn,
        b.notes ?? null,
      ],
    );
    const t = await pool.query(`SELECT ${COLS} ${FROM} WHERE t.id=$1`, [
      rows[0].id,
    ]);
    res.status(201).json(t.rows[0]);
  }),
);

transactionsRouter.put(
  "/:id",
  h(async (req, res) => {
    const { id } = idParam.parse(req.params);
    const b = body.parse(req.body);
    await assertCategory(uid(req), b.categoryId, b.type);
    const r = await pool.query(
      `UPDATE transactions SET category_id=$3,type=$4,description=$5,amount_cents=$6,occurred_on=$7,notes=$8,updated_at=now()
     WHERE id=$1 AND user_id=$2 AND deleted_at IS NULL`,
      [
        id,
        uid(req),
        b.categoryId,
        b.type,
        b.description,
        b.amountCents,
        b.occurredOn,
        b.notes ?? null,
      ],
    );
    if (!r.rowCount)
      throw new AppError(404, "Lançamento não encontrado", "NOT_FOUND");
    const t = await pool.query(`SELECT ${COLS} ${FROM} WHERE t.id=$1`, [id]);
    res.json(t.rows[0]);
  }),
);

transactionsRouter.delete(
  "/:id",
  h(async (req, res) => {
    const { id } = idParam.parse(req.params);
    const r = await pool.query(
      "UPDATE transactions SET deleted_at=now() WHERE id=$1 AND user_id=$2 AND deleted_at IS NULL",
      [id, uid(req)],
    );
    if (!r.rowCount)
      throw new AppError(404, "Lançamento não encontrado", "NOT_FOUND");
    res.status(204).end();
  }),
);
