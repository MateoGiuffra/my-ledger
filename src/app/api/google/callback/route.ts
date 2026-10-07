import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { connectDb } from "@/server/db";
import { exchangeCode } from "@/server/integrations/gcal";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const session = await auth();
  if (!session?.user?.id) return NextResponse.redirect(new URL("/login", req.url));
  const cookieState = req.headers.get("cookie")?.split("; ").find((c) => c.startsWith("g_state="))?.slice(8);
  const back = (q: string) => {
    const res = NextResponse.redirect(new URL(`/config/google?${q}`, req.url));
    res.cookies.delete({ name: "g_state", path: "/api/google" });
    return res;
  };
  const code = url.searchParams.get("code");
  if (url.searchParams.get("error") || !code) return back("error=denied");
  if (!cookieState || cookieState !== url.searchParams.get("state")) return back("error=state");
  try {
    await connectDb();
    await exchangeCode(session.user.id, code);
  } catch {
    return back("error=exchange");
  }
  return back("ok=1");
}
