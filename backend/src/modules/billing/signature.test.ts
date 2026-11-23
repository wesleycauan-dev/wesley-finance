import crypto from "node:crypto";
import { describe, expect, it } from "vitest";
import { verifyMpSignature } from "./signature.js";

const secret = "s3cret";
const sign = (id: string, req: string, ts: string) =>
  crypto
    .createHmac("sha256", secret)
    .update(`id:${id};request-id:${req};ts:${ts};`)
    .digest("hex");

describe("verifyMpSignature", () => {
  const base = { dataId: "123", xRequestId: "req-1", secret };
  it("aceita assinatura válida", () => {
    expect(
      verifyMpSignature({
        ...base,
        xSignature: `ts=1700000000,v1=${sign("123", "req-1", "1700000000")}`,
      }),
    ).toBe(true);
  });
  it("rejeita data.id diferente", () => {
    expect(
      verifyMpSignature({
        ...base,
        dataId: "999",
        xSignature: `ts=1700000000,v1=${sign("123", "req-1", "1700000000")}`,
      }),
    ).toBe(false);
  });
  it("rejeita hash adulterado", () => {
    expect(
      verifyMpSignature({
        ...base,
        xSignature: `ts=1700000000,v1=${"0".repeat(64)}`,
      }),
    ).toBe(false);
  });
  it("rejeita segredo errado", () => {
    expect(
      verifyMpSignature({
        ...base,
        secret: "outro",
        xSignature: `ts=1700000000,v1=${sign("123", "req-1", "1700000000")}`,
      }),
    ).toBe(false);
  });
  it("rejeita header ausente ou malformado", () => {
    expect(verifyMpSignature({ ...base, xSignature: undefined })).toBe(false);
    expect(verifyMpSignature({ ...base, xSignature: "lixo" })).toBe(false);
  });
});
