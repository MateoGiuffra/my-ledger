"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUserId } from "@/server/session";
import { assignName } from "@/server/services/counterparties";
import { commitBatch, createPreview, discardBatch, ImportError, rollbackBatch, setOverride, setYieldsOption } from "@/server/services/imports";
import { createRule } from "@/server/services/rules";
import type { FormState } from "./auth";

const id = z.string().regex(/^[a-f0-9]{24}$/i);
const optId = z.preprocess((v) => (v === "" || v == null ? undefined : v), id.optional());
const MAX_BYTES = 5 * 1024 * 1024;

export async function uploadMpAction(_: FormState, fd: FormData): Promise<FormState> {
  const userId = await requireUserId();
  const file = fd.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "Elegí un archivo CSV" };
  if (file.size > MAX_BYTES) return { error: "El archivo es demasiado grande (máx. 5 MB)" };
  let batchId: string;
  try {
    batchId = await createPreview(userId, file.name.slice(0, 200), await file.text());
  } catch (e) {
    if (e instanceof ImportError) return { error: e.message };
    throw e;
  }
  redirect(`/importar/${batchId}`);
}

export async function setRowCategoryAction(batchId: string, rowKey: string, categoryId: string) {
  const userId = await requireUserId();
  await setOverride(userId, id.parse(batchId), z.string().max(60).parse(rowKey), categoryId ? id.parse(categoryId) : null);
  revalidatePath(`/importar/${batchId}`);
}

export async function setYieldsAction(fd: FormData) {
  const userId = await requireUserId();
  const p = z.object({ batchId: id, yields: z.enum(["ignore", "income"]) }).parse(Object.fromEntries(fd));
  await setYieldsOption(userId, p.batchId, p.yields);
  revalidatePath(`/importar/${p.batchId}`);
}

export async function assignCounterpartyAction(fd: FormData) {
  const userId = await requireUserId();
  const p = z
    .object({
      batchId: id,
      name: z.string().trim().min(1).max(200),
      counterpartyId: optId,
      displayName: z.string().trim().max(120).optional(),
      categoryId: optId,
      mode: z.enum(["normal", "debt", "transfer"]).default("normal"),
      debtPersonId: optId,
    })
    .parse(Object.fromEntries(fd));
  if (p.counterpartyId) await assignName(userId, p.name, { counterpartyId: p.counterpartyId });
  else
    await assignName(userId, p.name, {
      create: { displayName: p.displayName || p.name, defaultCategoryId: p.categoryId, mode: p.mode, debtPersonId: p.debtPersonId },
    });
  revalidatePath(`/importar/${p.batchId}`);
}

export async function createRuleFromMerchantAction(fd: FormData) {
  const userId = await requireUserId();
  const p = z.object({ batchId: id, pattern: z.string().trim().min(1).max(100), categoryId: id }).parse(Object.fromEntries(fd));
  await createRule(userId, { pattern: p.pattern, categoryId: p.categoryId });
  revalidatePath(`/importar/${p.batchId}`);
}

export async function commitImportAction(fd: FormData) {
  const userId = await requireUserId();
  const batchId = id.parse(fd.get("batchId"));
  try {
    await commitBatch(userId, batchId);
  } catch (e) {
    if (!(e instanceof ImportError)) throw e;
  }
  revalidatePath("/", "layout");
  redirect(`/importar/${batchId}`);
}

export async function rollbackImportAction(fd: FormData) {
  const userId = await requireUserId();
  const batchId = id.parse(fd.get("batchId"));
  try {
    await rollbackBatch(userId, batchId);
  } catch (e) {
    if (!(e instanceof ImportError)) throw e;
  }
  revalidatePath("/", "layout");
  redirect("/importar");
}

export async function discardImportAction(fd: FormData) {
  const userId = await requireUserId();
  await discardBatch(userId, id.parse(fd.get("batchId")));
  redirect("/importar");
}
