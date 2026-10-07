import { z } from "zod";
import { amountField, dateField } from "./transaction";

const optId = z.preprocess((v) => (v === "" || v == null ? undefined : v), z.string().regex(/^[a-f0-9]{24}$/i).optional());
const optDate = z.preprocess((v) => (v === "" || v == null ? undefined : v), dateField.optional());

export const commitmentFormSchema = z.object({
  name: z.string().trim().min(1, "Nombre requerido").max(100),
  kind: z.enum(["expense", "income"]).default("expense"),
  amount: amountField,
  currency: z.enum(["ARS", "USD"]).default("ARS"),
  frequency: z.enum(["once", "weekly", "monthly"]),
  dayOfMonth: z.preprocess((v) => (v === "" || v == null ? undefined : Number(v)), z.number().int().min(1).max(28).optional()),
  startDate: dateField,
  endDate: optDate,
  categoryId: optId,
  accountId: optId,
  r3: z.string().optional(),
  r1: z.string().optional(),
  r0: z.string().optional(),
  gcalSync: z.string().optional(),
});
