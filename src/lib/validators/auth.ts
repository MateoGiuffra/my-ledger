import { z } from "zod";

export const usernameSchema = z.string().trim().min(3, "Mínimo 3 caracteres").max(40);
export const passwordSchema = z.string().min(8, "Mínimo 8 caracteres").max(200);

export const loginSchema = z.object({ username: usernameSchema, password: z.string().min(1).max(200) });
export const registerSchema = z.object({ username: usernameSchema, password: passwordSchema });
export const changePasswordSchema = z.object({
  current: z.string().min(1),
  next: passwordSchema,
});
