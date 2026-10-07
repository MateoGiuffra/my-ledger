"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { commitmentFormSchema } from "@/lib/validators/commitment";
import { CommitmentError, createCommitment, deleteCommitment, markPaid, postponeOccurrence, seedPlanCommitments, skipOccurrence, updateCommitment, type CommitmentInput } from "@/server/services/commitments";
import { requireUserId } from "@/server/session";
import type { FormState } from "./auth";

function parse(fd: FormData): { data: CommitmentInput } | { error: string } {
  const p = commitmentFormSchema.safeParse(Object.fromEntries(fd));
  if (!p.success) return { error: p.error.issues[0].message };
  const d = p.data;
  const reminders = [d.r3 ? 3 : null, d.r1 ? 1 : null, d.r0 ? 0 : null].filter((x): x is number => x !== null);
  return {
    data: {
      name: d.name,
      kind: d.kind,
      amountCents: d.amount,
      currency: d.currency,
      frequency: d.frequency,
      dayOfMonth: d.frequency === "monthly" ? (d.dayOfMonth ?? d.startDate.getUTCDate()) : undefined,
      startDate: d.startDate,
      endDate: d.endDate ?? null,
      categoryId: d.categoryId ?? null,
      accountId: d.accountId ?? null,
      reminders,
      gcalSync: !!d.gcalSync,
    },
  };
}

export async function createCommitmentAction(_: FormState, fd: FormData): Promise<FormState> {
  const userId = await requireUserId();
  const r = parse(fd);
  if ("error" in r) return { error: r.error };
  try {
    await createCommitment(userId, r.data);
  } catch (e) {
    if (e instanceof CommitmentError) return { error: e.message };
    throw e;
  }
  revalidatePath("/", "layout");
  redirect("/compromisos");
}

export async function updateCommitmentAction(id: string, _: FormState, fd: FormData): Promise<FormState> {
  const userId = await requireUserId();
  const r = parse(fd);
  if ("error" in r) return { error: r.error };
  try {
    await updateCommitment(userId, id, r.data);
  } catch (e) {
    if (e instanceof CommitmentError) return { error: e.message };
    throw e;
  }
  revalidatePath("/", "layout");
  redirect("/compromisos");
}

export async function deleteCommitmentAction(fd: FormData) {
  const userId = await requireUserId();
  await deleteCommitment(userId, z.string().parse(fd.get("id")));
  revalidatePath("/", "layout");
  redirect("/compromisos");
}

const occ = z.string().regex(/^[a-f0-9]{24}$/i);

async function guard(fn: () => Promise<unknown>) {
  try {
    await fn();
  } catch (e) {
    if (!(e instanceof CommitmentError)) throw e;
  }
  revalidatePath("/", "layout");
}

export async function payOccurrenceAction(fd: FormData) {
  const userId = await requireUserId();
  await guard(() => markPaid(userId, occ.parse(fd.get("id"))));
}

export async function skipOccurrenceAction(fd: FormData) {
  const userId = await requireUserId();
  await guard(() => skipOccurrence(userId, occ.parse(fd.get("id"))));
}

export async function postponeOccurrenceAction(fd: FormData) {
  const userId = await requireUserId();
  await guard(() => postponeOccurrence(userId, occ.parse(fd.get("id")), 7));
}

export async function seedPlanCommitmentsAction() {
  const userId = await requireUserId();
  await seedPlanCommitments(userId);
  revalidatePath("/", "layout");
}
