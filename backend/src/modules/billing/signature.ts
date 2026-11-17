import crypto from "node:crypto";

/**
 * Valida o header x-signature do Mercado Pago:
 * manifest = "id:<data.id>;request-id:<x-request-id>;ts:<ts>;" → HMAC-SHA256 hex com a chave secreta do webhook.
 * Pares ausentes são omitidos do manifest. Comparação em tempo constante.
 */
export function verifyMpSignature(a: {
  xSignature?: string;
  xRequestId?: string;
  dataId?: string;
  secret: string;
}): boolean {
  if (!a.xSignature) return false;
  let ts: string | undefined, v1: string | undefined;
  for (const part of a.xSignature.split(",")) {
    const [k, ...rest] = part.split("=");
    const v = rest.join("=").trim();
    if (k?.trim() === "ts") ts = v;
    else if (k?.trim() === "v1") v1 = v;
  }
  if (!ts || !v1) return false;
  let manifest = "";
  if (a.dataId) manifest += `id:${a.dataId};`;
  if (a.xRequestId) manifest += `request-id:${a.xRequestId};`;
  manifest += `ts:${ts};`;
  const expected = crypto
    .createHmac("sha256", a.secret)
    .update(manifest)
    .digest("hex");
  const x = Buffer.from(expected),
    y = Buffer.from(v1);
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}
