"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import * as cp from "@/server/services/counterparties";
import { createRule, deleteRule, seedSuggestedRules } from "@/server/services/rules";
import { requireUserId } from "@/server/session";

const id = z.string().regex(/^[a-f0-9]{24}$/i);
const optId = z.preprocess((v) => (v === "" || v == null ? undefined : v), id.optional());
const mode = z.enum(["normal", "debt", "transfer"]).default("normal");
const kind = z.enum(["mp_name", "alias", "cbu", "cvu", "cuit"]);

export async function createCounterpartyAction(fd: FormData) {
  const userId = await requireUserId();
  const p = z.object({ displayName: z.string().trim().min(1).max(120), defaultCategoryId: optId, label: z.string().trim().max(80).optional(), mode, debtPersonId: optId }).parse(Object.fromEntries(fd));
  const c = await cp.createCounterparty(userId, p);
  redirect(`/contrapartes/${c._id}`);
}

export async function updateCounterpartyAction(fd: FormData) {
  const userId = await requireUserId();
  const p = z.object({ id, displayName: z.string().trim().min(1).max(120), defaultCategoryId: optId, label: z.string().trim().max(80).optional(), mode, debtPersonId: optId }).parse(Object.fromEntries(fd));
  await cp.updateCounterparty(userId, p.id, { displayName: p.displayName, defaultCategoryId: p.defaultCategoryId ?? null, label: p.label ?? "", mode: p.mode, debtPersonId: p.debtPersonId ?? null });
  revalidatePath(`/contrapartes/${p.id}`);
}

export async function addIdentifierAction(fd: FormData) {
  const userId = await requireUserId();
  const p = z.object({ id, kind, value: z.string().trim().min(1).max(200) }).parse(Object.fromEntries(fd));
  await cp.addIdentifier(userId, p.id, { kind: p.kind, value: p.value });
  revalidatePath(`/contrapartes/${p.id}`);
}

export async function removeIdentifierAction(fd: FormData) {
  const userId = await requireUserId();
  const p = z.object({ id, normalized: z.string().max(300) }).parse(Object.fromEntries(fd));
  await cp.removeIdentifier(userId, p.id, p.normalized);
  revalidatePath(`/contrapartes/${p.id}`);
}

export async function applyToExistingAction(fd: FormData) {
  const userId = await requireUserId();
  const cid = id.parse(fd.get("id"));
  await cp.applyToExisting(userId, cid);
  revalidatePath("/", "layout");
}

export async function mergeCounterpartyAction(fd: FormData) {
  const userId = await requireUserId();
  const p = z.object({ id, intoId: id }).parse(Object.fromEntries(fd));
  await cp.mergeCounterparties(userId, p.id, p.intoId);
  redirect(`/contrapartes/${p.intoId}`);
}

export async function archiveCounterpartyAction(fd: FormData) {
  const userId = await requireUserId();
  await cp.archiveCounterparty(userId, id.parse(fd.get("id")));
  redirect("/contrapartes");
}

export async function createRuleAction(fd: FormData) {
  const userId = await requireUserId();
  const p = z.object({ pattern: z.string().trim().min(1).max(100), categoryId: id, match: z.enum(["contains", "regex"]).default("contains"), priority: z.coerce.number().int().default(0) }).parse(Object.fromEntries(fd));
  try {
    await createRule(userId, p);
  } catch {
    /* regex inválida: se ignora */
  }
  revalidatePath("/config/reglas");
}

export async function deleteRuleAction(fd: FormData) {
  const userId = await requireUserId();
  await deleteRule(userId, id.parse(fd.get("id")));
  revalidatePath("/config/reglas");
}

export async function seedRulesAction() {
  const userId = await requireUserId();
  await seedSuggestedRules(userId);
  revalidatePath("/config/reglas");
}
