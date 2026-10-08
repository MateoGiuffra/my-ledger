"use server";

import { revalidatePath } from "next/cache";
import { disconnectGoogle } from "@/server/integrations/gcal";
import { requireUserId } from "@/server/session";

export async function disconnectGoogleAction() {
  await disconnectGoogle(await requireUserId());
  revalidatePath("/config/google");
}
