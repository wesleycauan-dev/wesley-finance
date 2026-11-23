import type { Express } from "express";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// Teste de integração: exige um PostgreSQL de teste com as migrations aplicadas (veja README).
const enabled = !!process.env.TEST_DATABASE_URL;

describe.skipIf(!enabled)("autorização e isolamento entre usuários", () => {
  let app: Express;
  let pool: import("pg").Pool;
  const users: Record<string, { token: string; id: string }> = {};

  const mk = async (name: string, activate: boolean) => {
    const r = await request(app)
      .post("/api/auth/register")
      .send({
        name,
        email: `${name}-${Date.now()}@test.local`,
        password: "SenhaForte123",
        acceptTerms: true,
      });
    expect(r.status).toBe(201);
    const me = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${r.body.accessToken}`);
    if (activate)
      await pool.query(
        `UPDATE subscriptions SET status='active', current_period_end=now()+interval '30 days' WHERE user_id=$1`,
        [me.body.id],
      );
    return { token: r.body.accessToken as string, id: me.body.id as string };
  };
  const auth = (u: string) => ({ Authorization: `Bearer ${users[u]!.token}` });

  beforeAll(async () => {
    ({ app } = await import("../src/app.js"));
    ({ pool } = await import("../src/db/pool.js"));
    users.a = await mk("ana", true);
    users.b = await mk("bia", true);
    users.c = await mk("caio", false);
  });
  afterAll(async () => {
    await pool.end();
  });

  it("exige autenticação", async () => {
    expect((await request(app).get("/api/categories")).status).toBe(401);
  });
  it("bloqueia dados financeiros sem assinatura ativa (402)", async () => {
    expect(
      (await request(app).get("/api/categories").set(auth("c"))).status,
    ).toBe(402);
  });
  it("usuário comum não acessa o painel administrativo (403)", async () => {
    expect(
      (await request(app).get("/api/admin/overview").set(auth("a"))).status,
    ).toBe(403);
  });
  it("rejeita webhook com assinatura inválida (401)", async () => {
    const r = await request(app)
      .post("/api/webhooks/mercadopago?data.id=123")
      .set("x-signature", "ts=1,v1=abc")
      .set("x-request-id", "x")
      .send({ type: "subscription_preapproval" });
    expect(r.status).toBe(401);
  });
  it("isola lançamentos e categorias entre usuários", async () => {
    const cats = await request(app)
      .get("/api/categories?type=expense")
      .set(auth("a"));
    const catA = cats.body.data[0].id as string;
    const created = await request(app)
      .post("/api/transactions")
      .set(auth("a"))
      .send({
        type: "expense",
        categoryId: catA,
        description: "Mercado",
        amountCents: 5000,
        occurredOn: "2026-01-10",
      });
    expect(created.status).toBe(201);
    expect(
      (
        await request(app)
          .get(`/api/transactions/${created.body.id}`)
          .set(auth("b"))
      ).status,
    ).toBe(404);
    expect(
      (await request(app).get("/api/transactions").set(auth("b"))).body.total,
    ).toBe(0);
    expect(
      (
        await request(app)
          .delete(`/api/transactions/${created.body.id}`)
          .set(auth("b"))
      ).status,
    ).toBe(404);
    const stolen = await request(app)
      .post("/api/transactions")
      .set(auth("b"))
      .send({
        type: "expense",
        categoryId: catA,
        description: "X",
        amountCents: 100,
        occurredOn: "2026-01-10",
      });
    expect(stolen.status).toBe(422);
  });
  it("usuário bloqueado perde acesso imediatamente", async () => {
    await pool.query("UPDATE users SET is_active=false WHERE id=$1", [
      users.b!.id,
    ]);
    expect((await request(app).get("/api/auth/me").set(auth("b"))).status).toBe(
      401,
    );
  });
});
