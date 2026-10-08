import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { connectDb } from "./db";

/** userId de la sesión o redirect a /login. Además asegura la conexión a Mongo. */
export async function requireUserId(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  await connectDb();
  return session.user.id;
}
