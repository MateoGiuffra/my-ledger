import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

function key(): Buffer {
  const b64 = process.env.ENCRYPTION_KEY;
  if (!b64) throw new Error("Falta ENCRYPTION_KEY (32 bytes en base64: openssl rand -base64 32)");
  const k = Buffer.from(b64, "base64");
  if (k.length !== 32) throw new Error("ENCRYPTION_KEY debe tener 32 bytes en base64");
  return k;
}

/** AES-256-GCM → "iv.tag.ciphertext" (base64). */
export function encrypt(plain: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key(), iv);
  const enc = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return [iv, c.getAuthTag(), enc].map((b) => b.toString("base64")).join(".");
}

export function decrypt(payload: string): string {
  const [iv, tag, enc] = payload.split(".").map((s) => Buffer.from(s, "base64"));
  if (!iv || !tag || !enc) throw new Error("Payload cifrado inválido");
  const d = createDecipheriv("aes-256-gcm", key(), iv);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(enc), d.final()]).toString("utf8");
}
