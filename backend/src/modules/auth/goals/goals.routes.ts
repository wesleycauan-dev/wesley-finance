import { Router } from "express";
import { z } from "zod";
import { pool } from "../../../db/pool.js";
import { AppError } from "../../../utils/errors.js";
import { cents, h, idParam, isoDate, uid } from "../../../utils/http.js";

// reúne o código da funcionalidade de metas financeiras

const body = z.object({
  name: z.string().trim().min(1).max(120),
  targetCents: cents,
  deadline: isoDate.nullable().optional(),
});
const COLS = `id, name, target_cents::float8 AS "targetCents", current_cents::float8 AS "currentCents",
  to_char(deadline,'YYYY-MM-DD') AS deadline, status`;

export const goalsRouter = Router();

goalsRouter.get(
  "/",
  h(async (req, res) => {
    const { rows } = await pool.query(
      `SELECT ${COLS} FROM goals WHERE user_id=$1 ORDER BY status, created_at DESC`,
      [uid(req)],
    );
    res.json({ data: rows });
  }),
);

goalsRouter.post(
  "/",
  h(async (req, res) => {
    const b = body.parse(req.body);
    const { rows } = await pool.query(
      `INSERT INTO goals(user_id,name,target_cents,deadline) VALUES ($1,$2,$3,$4) RETURNING ${COLS}`,
      [uid(req), b.name, b.targetCents, b.deadline ?? null],
    );
    res.status(201).json(rows[0]);
  }),
);

goalsRouter.put(
  "/:id",
  h(async (req, res) => {
    const { id } = idParam.parse(req.params);
    const b = body.parse(req.body);
    const { rows } = await pool.query(
      `UPDATE goals SET name=$3,target_cents=$4,deadline=$5,updated_at=now(),
       status = CASE WHEN status='active' AND current_cents >= $4 THEN 'completed'::goal_status ELSE status END
     WHERE id=$1 AND user_id=$2 RETURNING ${COLS}`,
      [id, uid(req), b.name, b.targetCents, b.deadline ?? null],
    );
    if (!rows[0]) throw new AppError(404, "Meta não encontrada", "NOT_FOUND");
    res.json(rows[0]);
  }),
);

/** Aporte atômico: a atualização acontece em uma única instrução SQL (sem race condition). */
goalsRouter.post(
  "/:id/contributions",
  h(async (req, res) => {
    const { id } = idParam.parse(req.params);
    const { amountCents } = z.object({ amountCents: cents }).parse(req.body);
    const { rows } = await pool.query(
      `UPDATE goals SET current_cents = current_cents + $3, updated_at=now(),
       status = CASE WHEN current_cents + $3 >= target_cents THEN 'completed'::goal_status ELSE status END
     WHERE id=$1 AND user_id=$2 AND status='active' RETURNING ${COLS}`,
      [id, uid(req), amountCents],
    );
    if (!rows[0])
      throw new AppError(404, "Meta ativa não encontrada", "NOT_FOUND");
    res.json(rows[0]);
  }),
);

goalsRouter.delete(
  "/:id",
  h(async (req, res) => {
    const { id } = idParam.parse(req.params);
    const r = await pool.query("DELETE FROM goals WHERE id=$1 AND user_id=$2", [
      id,
      uid(req),
    ]);
    if (!r.rowCount)
      throw new AppError(404, "Meta não encontrada", "NOT_FOUND");
    res.status(204).end();
  }),
);
