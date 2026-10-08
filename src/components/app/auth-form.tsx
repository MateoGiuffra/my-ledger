"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { FormState } from "@/app/actions/auth";

export function AuthForm({
  action,
  submitLabel,
  newPassword = false,
}: {
  action: (s: FormState, fd: FormData) => Promise<FormState>;
  submitLabel: string;
  newPassword?: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  return (
    <form action={formAction} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="username">Usuario</Label>
        <Input id="username" name="username" autoComplete="username" required autoFocus />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="password">Contraseña</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete={newPassword ? "new-password" : "current-password"}
          required
          minLength={newPassword ? 8 : undefined}
        />
      </div>
      {state?.error && <p role="alert" className="text-sm text-destructive">{state.error}</p>}
      <Button type="submit" className="h-10 w-full" disabled={pending}>
        {pending ? "..." : submitLabel}
      </Button>
    </form>
  );
}
