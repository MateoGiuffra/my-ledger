import { afterAll, beforeAll, beforeEach, expect, test } from "vitest";
import { Types } from "mongoose";
import { dateOnly } from "@/lib/dates";
import { clearTestDb, startTestDb, stopTestDb } from "../test-db";
import { User } from "../models/user";
import { exportAll } from "./export";
import { createTransaction } from "./transactions";

beforeAll(startTestDb);
afterAll(stopTestDb);
beforeEach(clearTestDb);

test("exporta solo los datos del usuario y sin secretos", async () => {
  const u = await User.create({ username: "a", passwordHash: "SECRETO", googleTokens: { enc: "TOKEN" }, pushTokens: ["PUSH"] });
  const otro = String(new Types.ObjectId());
  await createTransaction(String(u._id), { type: "expense", amountCents: 100, date: dateOnly(2026, 1, 1) });
  await createTransaction(otro, { type: "expense", amountCents: 999, date: dateOnly(2026, 1, 1) });
  const data = await exportAll(String(u._id));
  expect(data.transactions).toHaveLength(1);
  const json = JSON.stringify(data);
  expect(json).not.toContain("SECRETO");
  expect(json).not.toContain("TOKEN");
  expect(json).not.toContain("PUSH");
});
