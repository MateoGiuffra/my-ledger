"use client";

import { useActionState } from "react";
import { addDebtEntryAction } from "@/app/actions/debts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function DebtEntryForm({
  personId,
  kind,
  today,
  recentTx,
}: {
  personId: string;
  kind: "loan" | "paid_for" | "payment" | "offset" | "adjustment";
  today: string;
  recentTx: { _id: string; label: string }[];
}) {
  const [state, action, pending] = useActionState(addDebtEntryAction, undefined);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="personId" value={personId} />
      <input type="hidden" name="kind" value={kind} />
      <Input
        name="amount"
        inputMode="decimal"
        placeholder={kind === "adjustment" ? "Monto (±, ej. -500)" : "Monto"}
        required
        autoFocus
        className="h-14 text-center text-2xl md:text-2xl"
        aria-label="Monto"
      />
      <Input name="reason" placeholder="Motivo (obligatorio)" required maxLength={300} />
      <Input type="date" name="date" defaultValue={today} required />
      {kind !== "adjustment" && recentTx.length > 0 && (
        <select name="transactionId" className="h-9 w-full rounded-lg border bg-transparent px-2 text-sm" aria-label="Movimiento vinculado">
          <option value="">Vincular a un movimiento (opcional)</option>
          {recentTx.map((t) => <option key={t._id} value={t._id}>{t.label}</option>)}
        </select>
      )}
      {state?.error && <p role="alert" className="text-sm text-destructive">{state.error}</p>}
      <Button type="submit" disabled={pending} className="h-11 w-full">Guardar</Button>
    </form>
  );
}
