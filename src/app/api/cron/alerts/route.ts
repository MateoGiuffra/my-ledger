import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { connectDb } from "@/server/db";
import { runAlertsForAll } from "@/server/services/alerts";

export const dynamic = "force-dynamic";

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const given = req.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Cron (Vercel Cron / GitHub Actions): genera alertas y manda los push pendientes. Protegido con CRON_SECRET. */
async function handle(req: Request) {
  if (!process.env.CRON_SECRET) return NextResponse.json({ error: "CRON_SECRET no configurado" }, { status: 503 });
  if (!authorized(req)) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  await connectDb();
  return NextResponse.json(await runAlertsForAll());
}

export const GET = handle;
export const POST = handle;
