import { z } from "zod";
import { amountField, dateField } from "./transaction";

const optId = z.preprocess((v) => (v === "" || v == null ? undefined : v), z.string().regex(/^[a-f0-9]{24}$/i).optional());

export const debtEntryFormSchema = z.object({
  personId: z.string().regex(/^[a-f0-9]{24}$/i),
  kind: z.enum(["loan", "paid_for", "payment", "offset"]),
  amount: amountField,
  reason: z.string().trim().min(1, "El motivo es obligatorio").max(300),
  date: dateField,
  transactionId: optId,
});

/** Ajuste: monto con signo (±). */
export const adjustmentFormSchema = z.object({
  personId: z.string().regex(/^[a-f0-9]{24}$/i),
  amount: z.string().transform((s, ctx) => {
    const t = s.trim();
    const neg = t.startsWith("-");
    const m = /^-?\s*(.+)$/.exec(t);
    const parsed = m ? amountField.safeParse(m[1]) : null;
    if (!parsed?.success) {
      ctx.addIssue({ code: "custom", message: "Monto inválido" });
      return z.NEVER;
    }
    return neg ? -parsed.data : parsed.data;
  }),
  reason: z.string().trim().min(1, "El motivo es obligatorio").max(300),
  date: dateField,
});
