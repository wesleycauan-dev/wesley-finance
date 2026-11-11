import "dotenv/config";
import { z } from "zod";

const schema = z.object({
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  PORT: z.coerce.number().default(3333),
  FRONTEND_URL: z.string().url(),
  DATABASE_URL: z.string().min(1),
  JWT_ACCESS_SECRET: z
    .string()
    .min(32, "JWT_ACCESS_SECRET deve ter 32+ caracteres"),
  ACCESS_TOKEN_TTL: z.string().default("15m"),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().default(30),
  OWNER_NAME: z.string().default("Wesley Cauan"),
  OWNER_EMAIL: z.string().email(),
  OWNER_PASSWORD: z.string().min(12),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error(
    "Variáveis de ambiente inválidas:",
    parsed.error.flatten().fieldErrors,
  );
  process.exit(1);
}
export const env = parsed.data;
