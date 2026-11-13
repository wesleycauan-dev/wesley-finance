import argon2 from 'argon2';
import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

const ARGON = { type: argon2.argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1 } as const;

export const hashPassword = (p: string) => argon2.hash(p, ARGON);
export const verifyPassword = (hash: string, p: string) => argon2.verify(hash, p).catch(() => false);
// Hash falso para igualar o tempo de resposta quando o e-mail não existe
export const DUMMY_HASH = await argon2.hash(crypto.randomBytes(16).toString('hex'), ARGON);

export const sha256 = (v: string) => crypto.createHash('sha256').update(v).digest('hex');
export const newRefreshToken = () => crypto.randomBytes(48).toString('base64url');

export interface AccessPayload { sub: string; role: 'owner' | 'user' }
export const signAccess = (p: AccessPayload) =>
  jwt.sign(p, env.JWT_ACCESS_SECRET, { expiresIn: env.ACCESS_TOKEN_TTL as jwt.SignOptions['expiresIn'], algorithm: 'HS256' });
export const verifyAccess = (t: string) =>
  jwt.verify(t, env.JWT_ACCESS_SECRET, { algorithms: ['HS256'] }) as AccessPayload & jwt.JwtPayload;
