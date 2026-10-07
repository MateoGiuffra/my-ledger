"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { removeToken, saveToken } from "@/server/integrations/push";
import { ALERT_TYPES, markAllRead, markRead, setPrefs } from "@/server/services/alerts";
import { requireUserId } from "@/server/session";

export async function markReadAction(fd: FormData) {
  const userId = await requireUserId();
  await markRead(userId, z.string().regex(/^[a-f0-9]{24}$/i).parse(fd.get("id")));
  revalidatePath("/", "layout");
}

export async function markAllReadAction() {
  await markAllRead(await requireUserId());
  revalidatePath("/", "layout");
}

export async function savePrefsAction(fd: FormData) {
  const userId = await requireUserId();
  const hour = z.coerce.number().int().min(0).max(23).parse(fd.get("hour"));
  const types = ALERT_TYPES.filter((t) => fd.get(`t_${t}`) === "on");
  await setPrefs(userId, { types: [...types], hour });
  revalidatePath("/config/notificaciones");
}

export async function savePushTokenAction(token: string) {
  await saveToken(await requireUserId(), z.string().min(20).max(4096).parse(token));
}

export async function removePushTokenAction(token: string) {
  await removeToken(await requireUserId(), z.string().max(4096).parse(token));
}
