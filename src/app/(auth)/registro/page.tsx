import { notFound } from "next/navigation";
import { registerAction } from "@/app/actions/auth";
import { AuthForm } from "@/components/app/auth-form";
import { registrationOpen } from "@/server/services/users";

export const dynamic = "force-dynamic";

export default async function RegistroPage() {
  if (!(await registrationOpen())) notFound();
  return <AuthForm action={registerAction} submitLabel="Crear usuario" newPassword />;
}
