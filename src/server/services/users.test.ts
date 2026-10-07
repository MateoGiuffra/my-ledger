import { afterAll, beforeAll, beforeEach, expect, test, vi } from "vitest";
import { clearTestDb, startTestDb, stopTestDb } from "../test-db";

vi.mock("../db", () => ({ connectDb: async () => {} }));

import { Account } from "../models/account";
import { Category } from "../models/category";
import { changePassword, registerUser, registrationOpen, verifyCredentials } from "./users";

beforeAll(startTestDb);
afterAll(stopTestDb);
beforeEach(clearTestDb);

test("registro crea usuario con cuentas y categorías por defecto", async () => {
  const u = await registerUser("Mateo", "supersecreta1");
  expect(u.username).toBe("mateo");
  const accs = await Account.find({ userId: u.id }).lean();
  expect(accs.map((a) => a.name)).toEqual(
    expect.arrayContaining(["Mercado Pago", "Efectivo", "Tarjeta", "Cocos ARS", "Cocos USD", "SUBE"]),
  );
  const cats = await Category.find({ userId: u.id }).lean();
  expect(cats.map((c) => c.name)).toEqual(expect.arrayContaining(["Comida", "Transporte", "Servicios", "Salud", "Ocio", "Hogar", "Tarjeta", "Préstamos", "Ahorro", "Otros"]));
});

test("el registro se cierra con un usuario existente", async () => {
  expect(await registrationOpen()).toBe(true);
  await registerUser("mateo", "supersecreta1");
  expect(await registrationOpen()).toBe(false);
  await expect(registerUser("otro", "supersecreta1")).rejects.toThrow();
});

test("ALLOW_REGISTER=false deshabilita el registro", async () => {
  vi.stubEnv("ALLOW_REGISTER", "false");
  expect(await registrationOpen()).toBe(false);
  vi.unstubAllEnvs();
});

test("login y cambio de contraseña", async () => {
  const u = await registerUser("mateo", "supersecreta1");
  expect(await verifyCredentials("MATEO", "supersecreta1")).toMatchObject({ username: "mateo" });
  expect(await verifyCredentials("mateo", "mala")).toBeNull();
  expect(await verifyCredentials("nadie", "supersecreta1")).toBeNull();
  await expect(changePassword(u.id, "incorrecta", "nuevaclave123")).rejects.toThrow();
  await changePassword(u.id, "supersecreta1", "nuevaclave123");
  expect(await verifyCredentials("mateo", "supersecreta1")).toBeNull();
  expect(await verifyCredentials("mateo", "nuevaclave123")).not.toBeNull();
});
