import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { connectDb } from "@/server/db";
import { exportAll } from "@/server/services/export";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  await connectDb();
  const data = await exportAll(session.user.id);
  return new NextResponse(JSON.stringify(data, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="my-ledger-${new Date().toISOString().slice(0, 10)}.json"`,
    },
  });
}
