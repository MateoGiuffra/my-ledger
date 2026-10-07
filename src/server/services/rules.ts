import { Category } from "../models/category";
import { plain } from "../models/helpers";
import { Rule, type IRule } from "../models/import";

export async function listRules(userId: string) {
  return plain(await Rule.find({ userId }).sort({ priority: -1, createdAt: 1 }).lean<IRule[]>());
}

export async function createRule(userId: string, d: { pattern: string; categoryId: string; match?: "contains" | "regex"; priority?: number; label?: string }) {
  const pattern = d.pattern.trim();
  if (!pattern) throw new Error("Patrón requerido");
  if (d.match === "regex") new RegExp(pattern); // valida
  // evitar duplicados exactos
  const dup = await Rule.findOne({ userId, pattern: new RegExp(`^${pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i"), match: d.match ?? "contains" });
  if (dup) {
    dup.categoryId = d.categoryId;
    await dup.save();
    return plain(dup.toObject());
  }
  return plain((await Rule.create({ userId, match: d.match ?? "contains", pattern, categoryId: d.categoryId, priority: d.priority ?? 0, label: d.label })).toObject());
}

export async function deleteRule(userId: string, id: string) {
  await Rule.deleteOne({ _id: id, userId });
}

/** Reglas sugeridas (comercios frecuentes). Solo se crean las cuya categoría existe y que todavía no existen. */
export const SUGGESTED_RULES: [string, string][] = [
  ["Spotify", "Ocio"],
  ["EBANX", "Ocio"],
  ["Steam", "Ocio"],
  ["Mercado Libre", "Otros"],
  ["Tuenti", "Servicios"],
  ["Movistar", "Servicios"],
  ["ARCA", "Servicios"],
  ["SUBE", "Transporte"],
  ["PedidosYa", "Comida"],
  ["Rappi", "Comida"],
];

export async function seedSuggestedRules(userId: string): Promise<number> {
  const cats = await Category.find({ userId, deletedAt: null }).lean<{ _id: string; name: string }[]>();
  const byName = new Map(cats.map((c) => [c.name, String(c._id)]));
  let created = 0;
  for (const [pattern, catName] of SUGGESTED_RULES) {
    const categoryId = byName.get(catName);
    if (!categoryId) continue;
    if (await Rule.exists({ userId, pattern })) continue;
    await Rule.create({ userId, pattern, match: "contains", categoryId });
    created++;
  }
  return created;
}
