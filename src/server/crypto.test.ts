import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { randomBytes } from "node:crypto";
import { decrypt, encrypt } from "./crypto";

beforeEach(() => vi.stubEnv("ENCRYPTION_KEY", randomBytes(32).toString("base64")));
afterEach(() => vi.unstubAllEnvs());

test("cifra y descifra (iv aleatorio)", () => {
  const a = encrypt('{"refresh_token":"abc"}');
  expect(a).not.toContain("refresh_token");
  expect(encrypt('{"refresh_token":"abc"}')).not.toBe(a);
  expect(decrypt(a)).toBe('{"refresh_token":"abc"}');
});

test("detecta manipulación y clave incorrecta", () => {
  const a = encrypt("secreto");
  const [iv, tag, enc] = a.split(".");
  const bad = Buffer.from(enc, "base64");
  bad[0] ^= 1;
  expect(() => decrypt([iv, tag, bad.toString("base64")].join("."))).toThrow();
  vi.stubEnv("ENCRYPTION_KEY", randomBytes(32).toString("base64"));
  expect(() => decrypt(a)).toThrow();
});

test("exige clave de 32 bytes", () => {
  vi.stubEnv("ENCRYPTION_KEY", "corta");
  expect(() => encrypt("x")).toThrow();
});
