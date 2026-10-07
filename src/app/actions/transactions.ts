"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { transactionFormSchema } from "@/lib/validators/transaction";
import { requireUserId } from "@/server/session";
import { createTransaction, deleteTransaction, updateTransaction } from "@/server/services/transactions";
import type { FormState } from "./auth";

function parse(fd: FormData) {
  const p = transactionFormSchema.safeParse(Object.fromEntries(fd));
  if (!p.success) return { error: p.error.issues[0].message } as const;
  const { amount, ...rest } = p.data;
  return { data: { ...rest, amountCents: amount } } as const;
}

export async function createTxAction(_: FormState, fd: FormData): Promise<FormState> {
  const userId = await requireUserId();
  const r = parse(fd);
  if ("error" in r) return { error: r.error };
  await createTransaction(userId, r.data);
  revalidatePath("/", "layout");
  if (fd.get("intent") === "again") redirect("/movimientos/nuevo?ok=1");
  redirect("/movimientos");
}

export async function updateTxAction(id: string, _: FormState, fd: FormData): Promise<FormState> {
  const userId = await requireUserId();
  const r = parse(fd);
  if ("error" in r) return { error: r.error };
  await updateTransaction(userId, id, {
    ...r.data,
    categoryId: r.data.categoryId ?? null,
    accountId: r.data.accountId ?? null,
  });
  revalidatePath("/", "layout");
  redirect("/movimientos");
}

export async function deleteTxAction(fd: FormData) {
  const userId = await requireUserId();
  await deleteTransaction(userId, String(fd.get("id")));
  revalidatePath("/", "layout");
  redirect("/movimientos");
}
