import { afterAll, beforeAll, expect, test } from "vitest";
import mongoose from "mongoose";
import { startTestDb, stopTestDb } from "./test-db";

beforeAll(startTestDb);
afterAll(stopTestDb);

test("mongo memory server arranca", async () => {
  expect(mongoose.connection.readyState).toBe(1);
});
