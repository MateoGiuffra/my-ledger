"use client";

import { useActionState } from "react";
import type { FormState } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ICategory } from "@/server/models/category";
import type { IAccount } from "@/server/models/account";

export interface TxDefaults {
  type: "expense" | "income" | "transfer";
  amount: string;
  currency: "ARS" | "USD";
  date: string;
  accountId?: string;
  categoryId?: string;
  merchant: string;
  note: string;
  fx?: string;
}

const chip =
  "cursor-pointer rounded-full border px-3 py-1.5 text-sm peer-checked:border-primary peer-checked:bg-primary peer-checked:text-primary-foreground";

export function TxForm({
  action,
  categories,
  accounts,
  defaults,
  isEdit = false,
}: {
  action: (s: FormState, fd: FormData) => Promise<FormState>;
  categories: Pick<ICategory, "_id" | "name" | "icon">[];
  accounts: Pick<IAccount, "_id" | "name">[];
  defaults: TxDefaults;
  isEdit?: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  return (
    <form action={formAction} className="space-y-4">
      <div className="grid grid-cols-3 gap-2 text-center">
        {(
          [["expense", "Gasto"], ["income", "Ingreso"], ["transfer", "Transf."]] as const
        ).map(([v, l]) => (
          <label key={v}>
            <input type="radio" name="type" value={v} defaultChecked={defaults.type === v} className="peer sr-only" />
            <span className={`${chip} block`}>{l}</span>
          </label>
        ))}
      </div>

      <div className="flex gap-2">
        <Input
          name="amount"
          inputMode="decimal"
          placeholder="0"
          defaultValue={defaults.amount}
          required
          autoFocus={!isEdit}
          aria-label="Monto"
          className="h-16 flex-1 text-center text-3xl font-semibold md:text-3xl"
        />
        <select name="currency" defaultValue={defaults.currency} aria-label="Moneda" className="h-16 rounded-lg border bg-transparent px-2">
          <option>ARS</option>
          <option>USD</option>
        </select>
      </div>

      <fieldset className="space-y-2">
        <legend className="text-sm text-muted-foreground">Categoría</legend>
        <div className="flex flex-wrap gap-2">
          <label>
            <input type="radio" name="categoryId" value="" defaultChecked={!defaults.categoryId} className="peer sr-only" />
            <span className={chip}>Sin categoría</span>
          </label>
          {categories.map((c) => (
            <label key={c._id}>
              <input type="radio" name="categoryId" value={c._id} defaultChecked={defaults.categoryId === c._id} className="peer sr-only" />
              <span className={chip}>{c.icon} {c.name}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="grid grid-cols-2 gap-2">
        <label className="space-y-1 text-sm">
          <span className="text-muted-foreground">Cuenta</span>
          <select name="accountId" defaultValue={defaults.accountId ?? ""} className="h-9 w-full rounded-lg border bg-transparent px-2">
            <option value="">—</option>
            {accounts.map((a) => <option key={a._id} value={a._id}>{a.name}</option>)}
          </select>
        </label>
        <label className="space-y-1 text-sm">
          <span className="text-muted-foreground">Fecha</span>
          <Input type="date" name="date" defaultValue={defaults.date} required />
        </label>
      </div>
      <Input name="merchant" placeholder="Comercio / concepto" defaultValue={defaults.merchant} maxLength={120} />
      <Input name="note" placeholder="Nota" defaultValue={defaults.note} maxLength={500} />
      <Input name="fx" placeholder="Cotización (solo USD, opcional)" inputMode="decimal" defaultValue={defaults.fx} />

      {state?.error && <p role="alert" className="text-sm text-destructive">{state.error}</p>}
      <div className="flex gap-2">
        <Button type="submit" name="intent" value="save" disabled={pending} className="h-11 flex-1">Guardar</Button>
        {!isEdit && (
          <Button type="submit" name="intent" value="again" variant="outline" disabled={pending} className="h-11 flex-1">
            Guardar y otro
          </Button>
        )}
      </div>
    </form>
  );
}
