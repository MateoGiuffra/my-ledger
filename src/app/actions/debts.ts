"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { adjustmentFormSchema, debtEntryFormSchema } from "@/lib/validators/debt";
import { addEntry, createPerson, DebtError, voidEntry } from "@/server/services/debts";
import { requireUserId } from "@/server/session";
import type { FormState } from "./auth";

export async function createPersonAction(fd: FormData) {
  const userId = await requireUserId();
  const name = z.string().trim().min(1).max(80).parse(fd.get("name"));
  const p = await createPerson(userId, name);
  revalidatePath("/deudas");
  redirect(`/deudas/${p._id}`);
}

export async function addDebtEntryAction(_: FormState, fd: FormData): Promise<FormState> {
  const userId = await requireUserId();
  const raw = Object.fromEntries(fd);
  let personId: string;
  try {
    if (raw.kind === "adjustment") {
      const p = adjustmentFormSchema.safeParse(raw);
      if (!p.success) return { error: p.error.issues[0].message };
      personId = p.data.personId;
      await addEntry(userId, { personId, kind: "adjustment", amountCents: p.data.amount, reason: p.data.reason, date: p.data.date });
    } else {
      const p = debtEntryFormSchema.safeParse(raw);
      if (!p.success) return { error: p.error.issues[0].message };
      personId = p.data.personId;
      await addEntry(userId, {
        personId,
        kind: p.data.kind,
        amountCents: p.data.amount,
        reason: p.data.reason,
        date: p.data.date,
        transactionId: p.data.transactionId,
      });
    }
  } catch (e) {
    if (e instanceof DebtError) return { error: e.message };
    throw e;
  }
  revalidatePath("/", "layout");
  redirect(`/deudas/${personId}`);
}

export async function voidDebtEntryAction(fd: FormData) {
  const userId = await requireUserId();
  const { id, personId, reason } = z.object({ id: z.string(), personId: z.string(), reason: z.string() }).parse(Object.fromEntries(fd));
  try {
    await voidEntry(userId, id, reason);
  } catch (e) {
    if (!(e instanceof DebtError)) throw e;
  }
  revalidatePath(`/deudas/${personId}`);
}
