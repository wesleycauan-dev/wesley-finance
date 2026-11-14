import type { Request, RequestHandler, Response } from "express";
import { z } from "zod";

/** Encaminha erros de handlers async para o errorHandler. */
export const h =
  (fn: (req: Request, res: Response) => Promise<unknown>): RequestHandler =>
  (req, res, next) => {
    fn(req, res).catch(next);
  };

export const idParam = z.object({ id: z.string().uuid() });
export const uid = (req: Request) => req.user!.id; // SEMPRE o id do token, nunca do cliente
export const pgCode = (e: unknown) => (e as { code?: string }).code;
export const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(
    (s) => new Date(`${s}T00:00:00Z`).toISOString().startsWith(s),
    "Data inválida",
  );
export const cents = z.number().int().positive().max(100_000_000_000);
