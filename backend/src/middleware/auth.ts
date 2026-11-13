import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { pool } from '../db/pool.js';
import { AppError } from '../utils/errors.js';
import { verifyAccess } from '../utils/security.js';

export const requireAuth: RequestHandler = (req, _res, next) => {
  const h = req.headers.authorization;
  if (!h?.startsWith('Bearer ')) return next(new AppError(401, 'Não autenticado', 'UNAUTHENTICATED'));
  try {
    const p = verifyAccess(h.slice(7));
    req.user = { id: p.sub, role: p.role };
    next();
  } catch {
    next(new AppError(401, 'Token inválido ou expirado', 'TOKEN_INVALID'));
  }
};

export const requireOwner: RequestHandler = (req, _res, next) =>
  req.user?.role === 'owner' ? next() : next(new AppError(403, 'Acesso restrito ao administrador', 'FORBIDDEN'));

/** Libera dados financeiros apenas para o proprietário ou assinatura ativa (confirmada por webhook). */
export const requireActiveAccess: RequestHandler = async (req, _res, next) => {
  try {
    if (req.user?.role === 'owner') return next();
    const { rows } = await pool.query(
      `SELECT 1 FROM subscriptions WHERE user_id=$1 AND status='active'
       AND (current_period_end IS NULL OR current_period_end > now())`, [req.user!.id]);
    if (!rows.length) throw new AppError(402, 'Assinatura inativa', 'SUBSCRIPTION_REQUIRED');
    next();
  } catch (e) { next(e); }
};

export const errorHandler = (err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof AppError) return res.status(err.status).json({ error: { code: err.code, message: err.message } });
  if ((err as { name?: string })?.name === 'ZodError')
    return res.status(400).json({ error: { code: 'VALIDATION', message: 'Dados inválidos', details: (err as any).flatten?.().fieldErrors } });
  console.error(err);
  res.status(500).json({ error: { code: 'INTERNAL', message: 'Erro interno' } });
};
