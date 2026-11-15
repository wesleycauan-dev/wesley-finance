import { randomUUID } from "node:crypto";
import { pool, tx } from "../../db/pool.js";
import { env } from "../../config/env.js";
import { AppError } from "../../utils/errors.js";
import { seedDefaultCategories } from "./categories/categories.service.js";
import {
  DUMMY_HASH,
  hashPassword,
  newRefreshToken,
  sha256,
  signAccess,
  verifyPassword,
} from "../../utils/security.js";

type AuthContext = { ip?: string; userAgent?: string };

type RegisterInput = {
  name: string;
  email: string;
  password: string;
};

const refreshMs = env.REFRESH_TOKEN_TTL_DAYS * 86_400_000;

async function issueRefreshToken(userId: string, ctx: AuthContext) {
  const token = newRefreshToken();
  const expiresAt = new Date(Date.now() + refreshMs);
  const familyId = randomUUID();

  await pool.query(
    `INSERT INTO refresh_tokens(user_id, family_id, token_hash, expires_at, user_agent, ip)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [
      userId,
      familyId,
      sha256(token),
      expiresAt,
      ctx.userAgent ?? null,
      ctx.ip ?? null,
    ],
  );

  return token;
}

export async function register(input: RegisterInput, ctx: AuthContext) {
  const existing = await pool.query<{ id: string }>(
    "SELECT id FROM users WHERE email = $1 LIMIT 1",
    [input.email],
  );

  if (existing.rowCount) {
    throw new AppError(409, "E-mail já cadastrado", "EMAIL_EXISTS");
  }

  const passwordHash = await hashPassword(input.password);

  return await tx(async (c) => {
    const user = await c.query<{ id: string; role: "owner" | "user" }>(
      `INSERT INTO users(name, email, password_hash, role)
       VALUES ($1, $2, $3, 'user')
       RETURNING id, role`,
      [input.name, input.email, passwordHash],
    );

    const userRow = user.rows[0];
    if (!userRow) {
      throw new AppError(
        500,
        "Não foi possível criar o usuário",
        "USER_CREATE_FAILED",
      );
    }

    const id = userRow.id;
    await c.query(
      "INSERT INTO user_preferences(user_id) VALUES ($1) ON CONFLICT DO NOTHING",
      [id],
    );
    await c.query(
      "INSERT INTO subscriptions(user_id, status) VALUES ($1, $2) ON CONFLICT (user_id) DO UPDATE SET status = EXCLUDED.status",
      [id, "none"],
    );
    await seedDefaultCategories(c, id);

    const refreshToken = newRefreshToken();
    const expiresAt = new Date(Date.now() + refreshMs);
    const familyId = randomUUID();

    await c.query(
      `INSERT INTO refresh_tokens(user_id, family_id, token_hash, expires_at, user_agent, ip)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        id,
        familyId,
        sha256(refreshToken),
        expiresAt,
        ctx.userAgent ?? null,
        ctx.ip ?? null,
      ],
    );

    return {
      accessToken: signAccess({ sub: id, role: "user" }),
      refreshToken,
    };
  });
}

export async function login(email: string, password: string, ctx: AuthContext) {
  const user = await pool.query<{
    id: string;
    password_hash: string;
    role: "owner" | "user";
  }>(
    "SELECT id, password_hash, role FROM users WHERE email = $1 AND deleted_at IS NULL LIMIT 1",
    [email],
  );

  const row = user.rows[0];
  const ok = row
    ? await verifyPassword(row.password_hash, password)
    : await verifyPassword(DUMMY_HASH, password);

  if (!row || !ok) {
    throw new AppError(401, "Credenciais inválidas", "INVALID_CREDENTIALS");
  }

  const refreshToken = await issueRefreshToken(row.id, ctx);

  return {
    accessToken: signAccess({ sub: row.id, role: row.role }),
    refreshToken,
  };
}

export async function refresh(refreshToken: string, ctx: AuthContext) {
  if (!refreshToken) throw new AppError(401, "Sem sessão", "NO_SESSION");

  const tokenHash = sha256(refreshToken);
  const row = await pool.query<{
    id: string;
    user_id: string;
    family_id: string;
    expires_at: Date;
    user_role: "owner" | "user";
  }>(
    `SELECT rt.id, rt.user_id, rt.family_id, rt.expires_at, u.role AS user_role
     FROM refresh_tokens rt
     JOIN users u ON u.id = rt.user_id
     WHERE rt.token_hash = $1 AND rt.revoked_at IS NULL AND rt.expires_at > NOW() AND u.deleted_at IS NULL
     LIMIT 1`,
    [tokenHash],
  );

  const current = row.rows[0];
  if (!current) throw new AppError(401, "Sessão inválida", "INVALID_SESSION");

  const nextToken = newRefreshToken();
  const nextExpiresAt = new Date(Date.now() + refreshMs);
  const nextHash = sha256(nextToken);

  await tx(async (c) => {
    await c.query(
      "UPDATE refresh_tokens SET revoked_at = NOW() WHERE id = $1",
      [current.id],
    );
    await c.query(
      `INSERT INTO refresh_tokens(user_id, family_id, token_hash, expires_at, user_agent, ip)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        current.user_id,
        current.family_id,
        nextHash,
        nextExpiresAt,
        ctx.userAgent ?? null,
        ctx.ip ?? null,
      ],
    );
  });

  return {
    accessToken: signAccess({ sub: current.user_id, role: current.user_role }),
    refreshToken: nextToken,
  };
}

export async function logout(refreshToken?: string) {
  if (!refreshToken) return;
  await pool.query(
    "UPDATE refresh_tokens SET revoked_at = NOW() WHERE token_hash = $1",
    [sha256(refreshToken)],
  );
}

export async function me(userId: string) {
  const result = await pool.query<{
    id: string;
    name: string;
    email: string;
    role: "owner" | "user";
  }>(
    "SELECT id, name, email, role FROM users WHERE id = $1 AND deleted_at IS NULL LIMIT 1",
    [userId],
  );

  const user = result.rows[0];
  if (!user)
    throw new AppError(404, "Usuário não encontrado", "USER_NOT_FOUND");

  return user;
}
