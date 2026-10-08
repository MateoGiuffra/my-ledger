import { z } from "zod";
import { parseUserAmount } from "@/lib/money";
import { parseIsoDate } from "@/lib/dates";

const objectId = z.string().regex(/^[a-f0-9]{24}$/i, "Id inválido");
const optionalId = z.preprocess((v) => (v === "" || v == null ? undefined : v), objectId.optional());

export const amountField = z
  .string()
  .transform((s, ctx) => {
    const c = parseUserAmount(s);
    if (c == null || c <= 0) {
      ctx.addIssue({ code: "custom", message: "Monto inválido" });
      return z.NEVER;
    }
    return c;
  });

export const dateField = z.string().transform((s, ctx) => {
  const d = parseIsoDate(s);
  if (!d) {
    ctx.addIssue({ code: "custom", message: "Fecha inválida" });
    return z.NEVER;
  }
  return d;
});

export const transactionFormSchema = z.object({
  type: z.enum(["expense", "income", "transfer"]),
  amount: amountField,
  currency: z.enum(["ARS", "USD"]).default("ARS"),
  fx: z.preprocess((v) => (v === "" || v == null ? undefined : Number(String(v).replace(",", "."))), z.number().positive().optional()),
  date: dateField,
  accountId: optionalId,
  categoryId: optionalId,
  merchant: z.string().trim().max(120).default(""),
  note: z.string().trim().max(500).default(""),
});

export type TransactionForm = z.infer<typeof transactionFormSchema>;

export const txFiltersSchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/).optional(),
  categoryId: optionalId,
  accountId: optionalId,
  type: z.enum(["expense", "income", "transfer"]).optional(),
  q: z.string().trim().max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
});
