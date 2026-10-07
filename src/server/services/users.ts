import bcrypt from "bcryptjs";
import { connectDb } from "../db";
import { User } from "../models/user";
import { seedDefaults } from "./seed";

const ROUNDS = 12;

export class AuthError extends Error {}

/** Registro permitido solo si ALLOW_REGISTER != "false" y todavía no existe ningún usuario (app personal). */
export async function registrationOpen(): Promise<boolean> {
  if (process.env.ALLOW_REGISTER === "false") return false;
  await connectDb();
  return (await User.estimatedDocumentCount()) === 0;
}

export async function registerUser(username: string, password: string) {
  if (!(await registrationOpen())) throw new AuthError("El registro está deshabilitado");
  const passwordHash = await bcrypt.hash(password, ROUNDS);
  const user = await User.create({ username, passwordHash });
  await seedDefaults(String(user._id));
  return { id: String(user._id), username: user.username };
}

export async function verifyCredentials(username: string, password: string) {
  await connectDb();
  const user = await User.findOne({ username: username.trim().toLowerCase() });
  // comparar siempre para no filtrar por timing si el usuario no existe
  const hash = user?.passwordHash ?? "$2b$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidi";
  const ok = await bcrypt.compare(password, hash);
  if (!user || !ok) return null;
  return { id: String(user._id), username: user.username };
}

export async function changePassword(userId: string, current: string, next: string) {
  await connectDb();
  const user = await User.findById(userId);
  if (!user || !(await bcrypt.compare(current, user.passwordHash))) throw new AuthError("Contraseña actual incorrecta");
  user.passwordHash = await bcrypt.hash(next, ROUNDS);
  await user.save();
}
