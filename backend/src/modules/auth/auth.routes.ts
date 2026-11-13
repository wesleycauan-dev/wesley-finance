import { Router, type Request } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { env } from '../../config/env.js';
import { requireAuth } from '../../middleware/auth.js';
import { AppError } from '../../utils/errors.js';
import * as svc from './auth.service.js';

const COOKIE = 'wf_refresh';
const cookieOpts = {
  httpOnly: true, secure: env.NODE_ENV === 'production', sameSite: 'strict' as const,
  path: '/api/auth', maxAge: env.REFRESH_TOKEN_TTL_DAYS * 86_400_000,
};
const limiter = rateLimit({ windowMs: 15 * 60_000, limit: 20, standardHeaders: true, legacyHeaders: false });

const password = z.string().min(10, 'Mínimo de 10 caracteres').max(128)
  .regex(/[a-z]/, 'Inclua minúscula').regex(/[A-Z]/, 'Inclua maiúscula').regex(/\d/, 'Inclua número');
const registerSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().toLowerCase().email().max(254),
  password,
  acceptTerms: z.literal(true, { errorMap: () => ({ message: 'É necessário aceitar os Termos e a Política de Privacidade' }) }),
});
const loginSchema = z.object({ email: z.string().trim().toLowerCase().email(), password: z.string().min(1).max(128) });

const ctx = (req: Request) => ({ ip: req.ip, userAgent: req.get('user-agent') });
export const authRouter = Router();

authRouter.post('/register', limiter, async (req, res, next) => {
  try {
    const { acceptTerms: _a, ...input } = registerSchema.parse(req.body);
    const t = await svc.register(input, ctx(req));
    res.cookie(COOKIE, t.refreshToken, cookieOpts).status(201).json({ accessToken: t.accessToken });
  } catch (e) { next(e); }
});

authRouter.post('/login', limiter, async (req, res, next) => {
  try {
    const { email, password: pw } = loginSchema.parse(req.body);
    const t = await svc.login(email, pw, ctx(req));
    res.cookie(COOKIE, t.refreshToken, cookieOpts).json({ accessToken: t.accessToken });
  } catch (e) { next(e); }
});

authRouter.post('/refresh', async (req, res, next) => {
  try {
    const token = req.cookies?.[COOKIE];
    if (!token) throw new AppError(401, 'Sem sessão', 'NO_SESSION');
    const t = await svc.refresh(token, ctx(req));
    res.cookie(COOKIE, t.refreshToken, cookieOpts).json({ accessToken: t.accessToken });
  } catch (e) { res.clearCookie(COOKIE, { path: cookieOpts.path }); next(e); }
});

authRouter.post('/logout', async (req, res, next) => {
  try {
    await svc.logout(req.cookies?.[COOKIE]);
    res.clearCookie(COOKIE, { path: cookieOpts.path }).status(204).end();
  } catch (e) { next(e); }
});

authRouter.get('/me', requireAuth, async (req, res, next) => {
  try { res.json(await svc.me(req.user!.id)); } catch (e) { next(e); }
});
