import Link from "next/link";
import { loginAction } from "@/app/actions/auth";
import { AuthForm } from "@/components/app/auth-form";
import { registrationOpen } from "@/server/services/users";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const canRegister = await registrationOpen().catch(() => false);
  return (
    <>
      <AuthForm action={loginAction} submitLabel="Entrar" />
      {canRegister && (
        <p className="text-center text-sm text-muted-foreground">
          Primera vez? <Link href="/registro" className="underline">Crear usuario</Link>
        </p>
      )}
    </>
  );
}
