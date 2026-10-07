"use client";

import { useActionState } from "react";
import { uploadMpAction } from "@/app/actions/imports";
import { Button } from "@/components/ui/button";

export function UploadForm() {
  const [state, action, pending] = useActionState(uploadMpAction, undefined);
  return (
    <form action={action} className="space-y-3 rounded-lg border p-3">
      <p className="text-sm font-medium">Mercado Pago · extracto CSV (account_statement-*.csv)</p>
      <input type="file" name="file" accept=".csv,text/csv" required className="block w-full text-sm" />
      {state?.error && <p role="alert" className="text-sm text-destructive">{state.error}</p>}
      <Button type="submit" disabled={pending} className="h-10 w-full">{pending ? "Procesando…" : "Subir y revisar"}</Button>
    </form>
  );
}
