import crypto from "node:crypto";
import { env } from "../../config/env.js";
import { AppError } from "../../utils/errors.js";

export async function mp<T>(
  method: "GET" | "POST" | "PUT",
  path: string,
  body?: unknown,
): Promise<T> {
  if (!env.MP_ACCESS_TOKEN)
    throw new AppError(503, "Pagamentos não configurados", "MP_NOT_CONFIGURED");
  const res = await fetch(`https://api.mercadopago.com${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${env.MP_ACCESS_TOKEN}`,
      "Content-Type": "application/json",
      ...(method === "POST"
        ? { "X-Idempotency-Key": crypto.randomUUID() }
        : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(10_000),
  });
  if (res.status === 404)
    throw new AppError(
      404,
      "Recurso não encontrado no Mercado Pago",
      "MP_NOT_FOUND",
    );
  if (!res.ok) {
    console.error(
      "Mercado Pago respondeu",
      res.status,
      method,
      path.split("?")[0],
    );
    throw new AppError(
      502,
      "Falha ao comunicar com o Mercado Pago",
      "MP_ERROR",
    );
  }
  return (await res.json()) as T;
}

/** Só aceita IDs com formato seguro antes de montar caminhos da API. */
export const safeId = (v: unknown): string => {
  if (typeof v !== "string" || !/^[A-Za-z0-9_-]{1,64}$/.test(v))
    throw new AppError(400, "ID inválido", "BAD_ID");
  return v;
};
