import { Router } from "express";
import { z } from "zod";
import { pool } from "../../../db/pool.js";
import { AppError } from "../../../utils/errors.js";
import { h, idParam, pgCode, uid } from "../../../utils/http.js";

const color = z.string().regex(/^#[0-9A-Fa-f]{6}$/);
const createSchema = z.object({
  name: z.string().trim().min(1).max(60),
  type: z.enum(["income", "expense"]),
  color: color.default("#1E90FF"),
});
const updateSchema = z.object({
  name: z.string().trim().min(1).max(60),
  color,
});
const COLS = "id, name, type, color";

export const categoriesRouter = Router();

categoriesRouter.get(
  "/",
  h(async (req, res) => {
    const { type } = z
      .object({ type: z.enum(["income", "expense"]).optional() })
      .parse(req.query);
    const { rows } = await pool.query(
      `SELECT ${COLS} FROM categories WHERE user_id=$1 AND ($2::transaction_type IS NULL OR type=$2) ORDER BY type, name`,
      [uid(req), type ?? null],
    );
    res.json({ data: rows });
  }),
);

categoriesRouter.post(
  "/",
  h(async (req, res) => {
    const b = createSchema.parse(req.body);
    try {
      const { rows } = await pool.query(
        `INSERT INTO categories(user_id,name,type,color) VALUES ($1,$2,$3,$4) RETURNING ${COLS}`,
        [uid(req), b.name, b.type, b.color],
      );
      res.status(201).json(rows[0]);
    } catch (e) {
      if (pgCode(e) === "23505")
        throw new AppError(
          409,
          "Já existe uma categoria com esse nome",
          "DUPLICATE",
        );
      throw e;
    }
  }),
);

categoriesRouter.put(
  "/:id",
  h(async (req, res) => {
    const { id } = idParam.parse(req.params);
    const b = updateSchema.parse(req.body);
    try {
      const { rows } = await pool.query(
        `UPDATE categories SET name=$3, color=$4 WHERE id=$1 AND user_id=$2 RETURNING ${COLS}`,
        [id, uid(req), b.name, b.color],
      );
      if (!rows[0])
        throw new AppError(404, "Categoria não encontrada", "NOT_FOUND");
      res.json(rows[0]);
    } catch (e) {
      if (pgCode(e) === "23505")
        throw new AppError(
          409,
          "Já existe uma categoria com esse nome",
          "DUPLICATE",
        );
      throw e;
    }
  }),
);

categoriesRouter.delete(
  "/:id",
  h(async (req, res) => {
    const { id } = idParam.parse(req.params);
    try {
      const r = await pool.query(
        "DELETE FROM categories WHERE id=$1 AND user_id=$2",
        [id, uid(req)],
      );
      if (!r.rowCount)
        throw new AppError(404, "Categoria não encontrada", "NOT_FOUND");
      res.status(204).end();
    } catch (e) {
      if (pgCode(e) === "23503")
        throw new AppError(409, "Categoria em uso por lançamentos", "IN_USE");
      throw e;
    }
  }),
);
