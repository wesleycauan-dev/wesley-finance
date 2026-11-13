import { pool, tx } from '../../db/pool.js';
import { env } from '../../config/env.js';
import { AppError } from '../../utils/errors.js';
import { DUMMY_HASH, hashPassword, newRefreshToken, sha256, signAccess, verifyPassword } from '../../utils/security.js';

const MAX_ATTEMPTS = 5;
const LOCK_MINUTES = 15;
export const TERMS_VERSION = '2026-11';

interface Ctx { ip?: string; userAgent?: string }

async function issueTokens(userId: string, role: 'owner' | 'user', ctx: Ctx, familyId?: string) {
  const refresh = newRefreshToken();
  await pool.query(
    `INSERT INTO refresh_tokens(user_id,family_id,token_hash,expires_at,user_agent,ip)
     VALUES ($1, COALESCE($2::uuid, gen_random_uuid()), $3, now() + ($4 || ' days')::interval, $5, $6)`,
    [userId, familyId ?? null, sha256(refresh), String(env.REFRESH_TOKEN_TTL_DAYS), ctx.userAgent?.slice(0, 300), ctx.ip]);
  return { accessToken: signAccess({ sub: userId, role }), refreshToken: refresh };
}

const audit = (userId: string | null, action: string, ip?: string, metadata: object = {}) =>
  pool.query('INSERT INTO audit_logs(user_id,action,ip,metadata) VALUES ($1,$2,$3,$4)', [userId, action, ip, metadata]);

export async function register(i: { name: string; email: string; password: string }, ctx: Ctx) {
  if (i.email.toLowerCase() === env.OWNER_EMAIL.toLowerCase()) throw new AppError(409, 'E-mail indisponível', 'EMAIL_TAKEN');
  const hash = await hashPassword(i.password);
  const user = await tx(async (c) => {
    const r = await c.query(
      `INSERT INTO users(name,email,password_hash) VALUES ($1,$2,$3)
       ON CONFLICT (email) DO NOTHING RETURNING id, role`, [i.name, i.email, hash]);
    if (!r.rows[0]) throw new AppError(409, 'E-mail indisponível', 'EMAIL_TAKEN');
    const id = r.rows[0].id as string;
    await c.query('INSERT INTO user_preferences(user_id) VALUES ($1)', [id]);
    await c.query('INSERT INTO subscriptions(user_id) VALUES ($1)', [id]);
    await c.query(`INSERT INTO consents(user_id,type,version,ip) VALUES ($1,'terms_and_privacy',$2,$3)`, [id, TERMS_VERSION, ctx.ip]);
    return r.rows[0] as { id: string; role: 'user' };
  });
  await audit(user.id, 'auth.register', ctx.ip);
  return issueTokens(user.id, user.role, ctx);
}

export async function login(email: string, password: string, ctx: Ctx) {
  const { rows } = await pool.query(
    `SELECT id, role, password_hash, is_active, failed_login_attempts, locked_until
     FROM users WHERE email=$1 AND deleted_at IS NULL`, [email]);
  const u = rows[0];
  const ok = await verifyPassword(u?.password_hash ?? DUMMY_HASH, password);
  const invalid = new AppError(401, 'E-mail ou senha inválidos', 'INVALID_CREDENTIALS');
  if (!u) throw invalid;
  if (u.locked_until && new Date(u.locked_until) > new Date())
    throw new AppError(429, 'Conta temporariamente bloqueada. Tente mais tarde.', 'LOCKED');
  if (!ok || !u.is_active) {
    const attempts = u.failed_login_attempts + 1;
    const lock = attempts >= MAX_ATTEMPTS;
    await pool.query(
      `UPDATE users SET failed_login_attempts=$2,
       locked_until = CASE WHEN $3::boolean THEN now() + ($4 || ' minutes')::interval END WHERE id=$1`,
      [u.id, lock ? 0 : attempts, lock, String(LOCK_MINUTES)]);
    await audit(u.id, 'auth.login_failed', ctx.ip);
    throw invalid;
  }
  await pool.query('UPDATE users SET failed_login_attempts=0, locked_until=NULL WHERE id=$1', [u.id]);
  await audit(u.id, 'auth.login', ctx.ip);
  return issueTokens(u.id, u.role, ctx);
}

/** Rotação de refresh token com detecção de reuso (revoga a família inteira). */
export async function refresh(token: string, ctx: Ctx) {
  const { rows } = await pool.query(
    `SELECT t.id, t.family_id, t.user_id, t.revoked_at, t.expires_at, u.role, u.is_active
     FROM refresh_tokens t JOIN users u ON u.id=t.user_id WHERE t.token_hash=$1 AND u.deleted_at IS NULL`,
    [sha256(token)]);
  const t = rows[0];
  if (!t) throw new AppError(401, 'Sessão inválida', 'SESSION_INVALID');
  if (t.revoked_at) {
    await pool.query('UPDATE refresh_tokens SET revoked_at=now() WHERE family_id=$1 AND revoked_at IS NULL', [t.family_id]);
    await audit(t.user_id, 'auth.refresh_reuse_detected', ctx.ip);
    throw new AppError(401, 'Sessão inválida', 'SESSION_INVALID');
  }
  if (new Date(t.expires_at) < new Date() || !t.is_active) throw new AppError(401, 'Sessão expirada', 'SESSION_EXPIRED');
  await pool.query('UPDATE refresh_tokens SET revoked_at=now() WHERE id=$1', [t.id]);
  return issueTokens(t.user_id, t.role, ctx, t.family_id);
}

export async function logout(token?: string) {
  if (token) await pool.query('UPDATE refresh_tokens SET revoked_at=now() WHERE token_hash=$1 AND revoked_at IS NULL', [sha256(token)]);
}

export async function me(userId: string) {
  const { rows } = await pool.query(
    `SELECT u.id, u.name, u.email, u.role, s.status AS subscription_status, s.current_period_end,
            p.theme, p.primary_color, p.background_color
     FROM users u JOIN user_preferences p ON p.user_id=u.id JOIN subscriptions s ON s.user_id=u.id
     WHERE u.id=$1 AND u.deleted_at IS NULL`, [userId]);
  if (!rows[0]) throw new AppError(404, 'Usuário não encontrado', 'NOT_FOUND');
  const r = rows[0];
  return {
    id: r.id, name: r.name, email: r.email, role: r.role,
    hasAccess: r.role === 'owner' || r.subscription_status === 'active',
    subscription: { status: r.subscription_status, currentPeriodEnd: r.current_period_end },
    preferences: { theme: r.theme, primaryColor: r.primary_color, backgroundColor: r.background_color },
  };
}
