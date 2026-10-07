"use server";

import { AuthError as NextAuthError } from "next-auth";
import { redirect } from "next/navigation";
import { signIn, signOut } from "@/auth";
import { changePasswordSchema, loginSchema, registerSchema } from "@/lib/validators/auth";
import { AuthError, changePassword, registerUser } from "@/server/services/users";
import { requireUserId } from "@/server/session";

export type FormState = { error?: string; ok?: string } | undefined;

export async function loginAction(_: FormState, fd: FormData): Promise<FormState> {
  const parsed = loginSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: "Usuario o contraseña incorrectos" };
  try {
    await signIn("credentials", { ...parsed.data, redirectTo: "/inicio" });
  } catch (e) {
    if (e instanceof NextAuthError) return { error: "Usuario o contraseña incorrectos" };
    throw e; // el redirect de Next también es una excepción: dejarlo pasar
  }
}

export async function registerAction(_: FormState, fd: FormData): Promise<FormState> {
  const parsed = registerSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  try {
    await registerUser(parsed.data.username, parsed.data.password);
  } catch (e) {
    if (e instanceof AuthError) return { error: e.message };
    return { error: "No se pudo crear el usuario (¿ya existe?)" };
  }
  await signIn("credentials", { ...parsed.data, redirectTo: "/inicio" });
}

export async function logoutAction() {
  await signOut({ redirect: false });
  redirect("/login");
}

export async function changePasswordAction(_: FormState, fd: FormData): Promise<FormState> {
  const userId = await requireUserId();
  const parsed = changePasswordSchema.safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  try {
    await changePassword(userId, parsed.data.current, parsed.data.next);
  } catch (e) {
    if (e instanceof AuthError) return { error: e.message };
    throw e;
  }
  return { ok: "Contraseña actualizada" };
}
