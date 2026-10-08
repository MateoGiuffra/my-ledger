"use client";

import { useActionState, useState } from "react";
import type { FormState } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export interface CommitmentDefaults {
  name: string;
  kind: "expense" | "income";
  amount: string;
  currency: "ARS" | "USD";
  frequency: "once" | "weekly" | "monthly";
  dayOfMonth?: number;
  startDate: string;
  endDate?: string;
  categoryId?: string;
  accountId?: string;
  reminders: number[];
  gcalSync: boolean;
}

const SELECT = "h-9 w-full rounded-lg border bg-transparent px-2 text-sm";

export function CommitmentForm({
  action,
  defaults,
  categories,
  accounts,
  googleConnected,
}: {
  action: (s: FormState, fd: FormData) => Promise<FormState>;
  defaults: CommitmentDefaults;
  categories: { _id: string; name: string }[];
  accounts: { _id: string; name: string }[];
  googleConnected: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const [freq, setFreq] = useState(defaults.frequency);
  return (
    <form action={formAction} className="space-y-3">
      <select name="kind" defaultValue={defaults.kind} className={SELECT} aria-label="Tipo"><option value="expense">Pago (egreso)</option><option value="income">Cobro (ingreso, ej. Sueldo)</option></select>
      <Input name="name" placeholder="Nombre (ej. Tarjeta)" defaultValue={defaults.name} required maxLength={100} />
      <div className="flex gap-2">
        <Input name="amount" inputMode="decimal" placeholder="Monto" defaultValue={defaults.amount} required aria-label="Monto" className="text-lg" />
        <select name="currency" defaultValue={defaults.currency} className="h-8 rounded-lg border bg-transparent px-2" aria-label="Moneda"><option>ARS</option><option>USD</option></select>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <select name="frequency" value={freq} onChange={(e) => setFreq(e.target.value as typeof freq)} className={SELECT} aria-label="Frecuencia">
          <option value="monthly">Mensual</option><option value="weekly">Semanal</option><option value="once">Única</option>
        </select>
        {freq === "monthly" ? (
          <Input name="dayOfMonth" type="number" min={1} max={28} placeholder="Día (1–28)" defaultValue={defaults.dayOfMonth} aria-label="Día del mes" />
        ) : <span />}
        <label className="space-y-1 text-xs text-muted-foreground">{freq === "once" ? "Fecha" : "Desde"}<Input type="date" name="startDate" defaultValue={defaults.startDate} required /></label>
        {freq !== "once" && <label className="space-y-1 text-xs text-muted-foreground">Hasta (opcional)<Input type="date" name="endDate" defaultValue={defaults.endDate} /></label>}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <select name="categoryId" defaultValue={defaults.categoryId ?? ""} className={SELECT} aria-label="Categoría"><option value="">Sin categoría</option>{categories.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}</select>
        <select name="accountId" defaultValue={defaults.accountId ?? ""} className={SELECT} aria-label="Cuenta"><option value="">Sin cuenta</option>{accounts.map((a) => <option key={a._id} value={a._id}>{a.name}</option>)}</select>
      </div>
      <fieldset className="flex flex-wrap gap-4 text-sm">
        <legend className="mb-1 text-xs text-muted-foreground">Recordatorios</legend>
        {([[3, "r3", "3 días antes"], [1, "r1", "1 día antes"], [0, "r0", "El día"]] as const).map(([d, n, l]) => (
          <label key={n} className="flex items-center gap-1"><input type="checkbox" name={n} defaultChecked={defaults.reminders.includes(d)} /> {l}</label>
        ))}
      </fieldset>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="gcalSync" defaultChecked={defaults.gcalSync} /> Agregar a Google Calendar
        {!googleConnected && <span className="text-xs text-muted-foreground">(no conectado: Config → Google)</span>}
      </label>
      {state?.error && <p role="alert" className="text-sm text-destructive">{state.error}</p>}
      <Button type="submit" disabled={pending} className="h-11 w-full">Guardar</Button>
    </form>
  );
}
