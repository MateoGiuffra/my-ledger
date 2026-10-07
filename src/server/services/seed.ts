import { Account } from "../models/account";
import { Category } from "../models/category";

export const DEFAULT_ACCOUNTS = [
  { name: "Mercado Pago", type: "mp", currency: "ARS" },
  { name: "Efectivo", type: "cash", currency: "ARS" },
  { name: "Tarjeta", type: "card", currency: "ARS" },
  { name: "Cocos ARS", type: "cocos", currency: "ARS" },
  { name: "Cocos USD", type: "cocos", currency: "USD" },
  { name: "SUBE", type: "sube", currency: "ARS" },
] as const;

/** FT-CAT-1 + "Ingresos" (para clasificar ingresos). */
export const DEFAULT_CATEGORIES = [
  { name: "Comida", icon: "🍔", color: "#f97316" },
  { name: "Transporte", icon: "🚌", color: "#3b82f6" },
  { name: "Servicios", icon: "💡", color: "#eab308" },
  { name: "Salud", icon: "💊", color: "#ef4444" },
  { name: "Ocio", icon: "🎮", color: "#a855f7" },
  { name: "Hogar", icon: "🏠", color: "#14b8a6" },
  { name: "Tarjeta", icon: "💳", color: "#6366f1" },
  { name: "Préstamos", icon: "🤝", color: "#64748b" },
  { name: "Ahorro", icon: "🐷", color: "#22c55e" },
  { name: "Otros", icon: "📦", color: "#94a3b8" },
  { name: "Ingresos", icon: "💰", color: "#16a34a", isIncome: true },
] as const;

/** Crea cuentas y categorías por defecto si el usuario no tiene ninguna. Idempotente. */
export async function seedDefaults(userId: string) {
  const [accs, cats] = await Promise.all([
    Account.countDocuments({ userId }),
    Category.countDocuments({ userId }),
  ]);
  if (!accs) await Account.insertMany(DEFAULT_ACCOUNTS.map((a) => ({ ...a, userId })));
  if (!cats) await Category.insertMany(DEFAULT_CATEGORIES.map((c) => ({ ...c, userId })));
}
