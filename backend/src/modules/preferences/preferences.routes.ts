import { Router } from "express";
import { z } from "zod";
import { pool } from "../../db/pool.js";
import { requireAuth } from "../../middleware/auth.js";
import { h, uid } from "../../utils/http.js";

const hex = z.string().regex(/^#[0-9A-Fa-f]{6}$/);
const schema = z.object({
  theme: z.enum(["dark", "light", "system"]),
  primaryColor: hex,
  backgroundColor: hex,
});

export const preferencesRouter = Router();
preferencesRouter.put(
  "/",
  requireAuth,
  h(async (req, res) => {
    const b = schema.parse(req.body);
    await pool.query(
      `UPDATE user_preferences SET theme=$2, primary_color=$3, background_color=$4, updated_at=now() WHERE user_id=$1`,
      [
        uid(req),
        b.theme,
        b.primaryColor.toUpperCase(),
        b.backgroundColor.toUpperCase(),
      ],
    );
    res.status(204).end();
  }),
);
