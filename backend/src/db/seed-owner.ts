import { env } from '../config/env.js';
import { pool, tx } from './pool.js';
import { hashPassword } from '../utils/security.js';

const hash = await hashPassword(env.OWNER_PASSWORD);
await tx(async (c) => {
  const r = await c.query(
    `INSERT INTO users(name,email,password_hash,role) VALUES ($1,$2,$3,'owner')
     ON CONFLICT (email) DO UPDATE SET role='owner', name=EXCLUDED.name RETURNING id`,
    [env.OWNER_NAME, env.OWNER_EMAIL, hash]);
  const id = r.rows[0].id;
  await c.query('INSERT INTO user_preferences(user_id) VALUES ($1) ON CONFLICT DO NOTHING', [id]);
  await c.query(`INSERT INTO subscriptions(user_id,status) VALUES ($1,'active') ON CONFLICT (user_id) DO UPDATE SET status='active', current_period_end=NULL`, [id]);
});
console.log('Proprietário criado/atualizado:', env.OWNER_EMAIL);
await pool.end();
