import type { NextFunction, Request, RequestHandler, Response } from "express";
import { pool } from "../db/pool.js";
import { AppError } from "../utils/errors.js";
import { verifyAccess } from "../utils/security.js";

export const requireAuth: RequestHandler = async (req, _res, next) => {
  const h = req.headers.authorization;
  if (!h?.startsWith("Bearer "))
    return next(new AppError(401, "Não autenticado", "UNAUTHENTICATED"));
  let sub: string;
  try {
    sub = verifyAccess(h.slice(7)).sub;
  } catch {
    return next(
      new AppError(401, "Token inválido ou expirado", "TOKEN_INVALID"),
    );
  }
  try {
    // O papel vem do banco (não do token) e contas bloqueadas/excluídas perdem acesso imediatamente.
    const { rows } = await pool.query(
      "SELECT role FROM users WHERE id=$1 AND is_active AND deleted_at IS NULL",
      [sub],
    );
    if (!rows[0])
      return next(new AppError(401, "Conta indisponível", "ACCOUNT_DISABLED"));
    req.user = { id: sub, role: rows[0].role };
    next();
  } catch (e) {
    next(e);
  }
};

export const requireOwner: RequestHandler = (req, _res, next) =>
  req.user?.role === "owner"
    ? next()
    : next(new AppError(403, "Acesso restrito ao administrador", "FORBIDDEN"));

/** Libera dados financeiros apenas para o proprietário ou assinatura ativa (confirmada por webhook). */
export const requireActiveAccess: RequestHandler = async (req, _res, next) => {
  try {
    if (req.user?.role === "owner") return next();
    const { rows } = await pool.query(
      `SELECT 1 FROM subscriptions WHERE user_id=$1 AND status IN ('active','cancelled')
       AND current_period_end IS NOT NULL AND current_period_end + interval '3 days' > now()`,
      [req.user!.id],
    );
    if (!rows.length)
      throw new AppError(402, "Assinatura inativa", "SUBSCRIPTION_REQUIRED");
    next();
  } catch (e) {
    next(e);
  }
};

export const errorHandler = (
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
) => {
  if (err instanceof AppError)
    return res
      .status(err.status)
      .json({ error: { code: err.code, message: err.message } });
  if ((err as { name?: string })?.name === "ZodError")
    return res.status(400).json({
      error: {
        code: "VALIDATION",
        message: "Dados inválidos",
        details: (err as any).flatten?.().fieldErrors,
      },
    });
  console.error(err);
  res
    .status(500)
    .json({ error: { code: "INTERNAL", message: "Erro interno" } });
};
