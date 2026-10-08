import type { IdentifierKind } from "../models/import";

/** Sin tildes, minúsculas, sin puntuación y con palabras ordenadas ("Pérez, Juan" ≡ "Juan Perez"). */
export function normalizeName(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .sort()
    .join(" ");
}

export function normalizeIdentifier(kind: IdentifierKind, value: string): string {
  switch (kind) {
    case "cbu":
    case "cvu":
    case "cuit":
      return value.replace(/\D/g, "");
    case "alias":
      return value.trim().toLowerCase();
    default:
      return normalizeName(value);
  }
}

/** Texto sin tildes y en minúsculas para comparar con reglas. */
export function fold(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}
