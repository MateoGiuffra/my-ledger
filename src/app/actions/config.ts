"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUserId } from "@/server/session";
import * as catalog from "@/server/services/catalog";

const name = z.string().trim().min(1).max(60);

export async function createAccountAction(fd: FormData) {
  const userId = await requireUserId();
  const d = z
    .object({ name, type: z.enum(["mp", "cash", "card", "cocos", "sube"]), currency: z.enum(["ARS", "USD"]) })
    .parse(Object.fromEntries(fd));
  await catalog.createAccount(userId, d);
  revalidatePath("/config/cuentas");
}

export async function archiveAccountAction(fd: FormData) {
  const userId = await requireUserId();
  await catalog.archiveAccount(userId, z.string().parse(fd.get("id")));
  revalidatePath("/config/cuentas");
}

export async function createCategoryAction(fd: FormData) {
  const userId = await requireUserId();
  const d = z.object({ name, icon: z.string().max(8).optional(), isIncome: z.string().optional() }).parse(Object.fromEntries(fd));
  await catalog.createCategory(userId, { name: d.name, icon: d.icon || undefined, isIncome: d.isIncome === "on" });
  revalidatePath("/config/categorias");
}

export async function archiveCategoryAction(fd: FormData) {
  const userId = await requireUserId();
  await catalog.archiveCategory(userId, z.string().parse(fd.get("id")));
  revalidatePath("/config/categorias");
}
