// configura conexões com o PostgreSQL e oferece uma função para executar operações dentro de uma transação.

import pg from "pg"; // é a biblioteca usada para conectar e consultar o PostgreSQL.
import { env } from "../config/env.js"; // contém as configurações do ambiente, como a URL do banco e o modo de execução.

export const pool = new pg.Pool({
  connectionString: env.DATABASE_URL,
  max: 10,
  ssl: env.NODE_ENV === "production" ? { rejectUnauthorized: true } : undefined,
});

export async function tx<T>(fn: (c: pg.PoolClient) => Promise<T>): Promise<T> {
  const c = await pool.connect();
  try {
    await c.query("BEGIN");
    const r = await fn(c);
    await c.query("COMMIT");
    return r;
  } catch (e) {
    await c.query("ROLLBACK");
    throw e;
  } finally {
    c.release();
  }
}
