import { afterAll, beforeAll, beforeEach, expect, test, vi } from "vitest";
import { startTestDb, stopTestDb } from "@/server/test-db";

vi.mock("@/server/db", () => ({ connectDb: async () => {} }));

import { GET, POST } from "./route";

beforeAll(startTestDb);
afterAll(stopTestDb);
beforeEach(() => vi.unstubAllEnvs());

const req = (auth?: string) => new Request("http://x/api/cron/alerts", { headers: auth ? { authorization: auth } : {} });

test("sin CRON_SECRET configurado responde 503", async () => {
  vi.stubEnv("CRON_SECRET", "");
  expect((await GET(req("Bearer x"))).status).toBe(503);
});

test("sin header o con secreto incorrecto responde 401", async () => {
  vi.stubEnv("CRON_SECRET", "s3cret");
  expect((await GET(req())).status).toBe(401);
  expect((await POST(req("Bearer otro"))).status).toBe(401);
  expect((await GET(req("s3cret"))).status).toBe(401);
});

test("con el secreto correcto corre", async () => {
  vi.stubEnv("CRON_SECRET", "s3cret");
  const res = await GET(req("Bearer s3cret"));
  expect(res.status).toBe(200);
  expect(await res.json()).toEqual({ users: 0, created: 0, pushed: 0 });
});
