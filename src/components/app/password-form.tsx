"use client";

import { useActionState } from "react";
import { changePasswordAction } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function PasswordForm() {
  const [state, action, pending] = useActionState(changePasswordAction, undefined);
  return (
    <form action={action} className="space-y-3">
      <Input name="current" type="password" placeholder="Contraseña actual" autoComplete="current-password" required />
      <Input name="next" type="password" placeholder="Nueva contraseña (mín. 8)" autoComplete="new-password" minLength={8} required />
      {state?.error && <p role="alert" className="text-sm text-destructive">{state.error}</p>}
      {state?.ok && <p className="text-sm text-green-600">{state.ok}</p>}
      <Button type="submit" disabled={pending} className="h-10 w-full">Cambiar contraseña</Button>
    </form>
  );
}
