import type { ICounterparty, IRule, ImportedRow } from "../models/import";
import { fold, normalizeIdentifier, normalizeName } from "./normalize";

export interface RuleLite {
  _id: string;
  match: IRule["match"];
  pattern: string;
  categoryId: string;
  priority: number;
  label?: string;
}

export type CounterpartyLite = Pick<ICounterparty, "_id" | "displayName" | "identifiers" | "defaultCategoryId" | "label" | "mode" | "debtPersonId" | "amountOverrides">;

/** Match exacto por identificador y, si no, por nombre normalizado (sin tildes/mayúsculas/orden). */
export function findCounterparty(list: CounterpartyLite[], name: string): CounterpartyLite | null {
  const exact = name.trim();
  const norm = normalizeName(name);
  for (const c of list) if (c.identifiers.some((i) => i.value.trim() === exact)) return c;
  for (const c of list) if (c.identifiers.some((i) => i.kind === "mp_name" && i.normalized === norm)) return c;
  const asKey = normalizeIdentifier("alias", name);
  for (const c of list) if (c.identifiers.some((i) => i.normalized === asKey || i.normalized === norm)) return c;
  return null;
}

export function matchRule(rules: RuleLite[], text: string): RuleLite | null {
  const folded = fold(text);
  const sorted = [...rules].sort((a, b) => b.priority - a.priority);
  for (const r of sorted) {
    if (r.match === "contains") {
      if (folded.includes(fold(r.pattern))) return r;
    } else {
      try {
        if (new RegExp(r.pattern, "i").test(text)) return r;
      } catch {
        /* regex inválida: se ignora */
      }
    }
  }
  return null;
}

export type RowStatus = "new" | "duplicate" | "ignored";
export type CategorySource = "override" | "counterparty" | "rule" | null;

export interface AnalyzedRow {
  row: ImportedRow;
  status: RowStatus;
  /** Por qué se ignora (rendimientos, devolución neteada, etc.) */
  note?: string;
  type: "expense" | "income" | "transfer";
  amountCents: number;
  categoryId: string | null;
  categorySource: CategorySource;
  merchant: string;
  counterpartyId: string | null;
  counterpartyName: string | null;
  internal: boolean;
  refund: boolean;
  /** Para contrapartes en modo deuda: movimiento sugerido en Deudas */
  debt: { personId: string; kind: "loan" | "payment" } | null;
  /** Nombre a asignar en la revisión (transferencias sin contraparte). */
  needsCounterparty: boolean;
  dedupeKey: string;
}

export interface AnalyzeContext {
  counterparties: CounterpartyLite[];
  rules: RuleLite[];
  /** externalIds ya importados (para dedupe) */
  existingExternalIds: Set<string>;
  overrides: Record<string, string>;
  options: { yields: "ignore" | "income" };
}

/** Clave de dedupe de una fila: id de referencia (las devoluciones comparten id con el pago, se distinguen). */
export function rowExternalId(r: ImportedRow): string {
  return r.kind === "refund" ? `${r.referenceId}:refund:${Math.abs(r.amountCents)}` : r.referenceId;
}

/**
 * Clasifica cada fila: nueva / duplicada / ignorada, y resuelve categoría con prioridad
 * override manual > contraparte > regla > sin categoría.
 */
export function analyzeRows(rows: ImportedRow[], ctx: AnalyzeContext): AnalyzedRow[] {
  const seenInFile = new Set<string>();
  return rows.map((row) => {
    const amountCents = Math.abs(row.amountCents);
    const dedupeKey = rowExternalId(row);
    let type: AnalyzedRow["type"] = row.amountCents >= 0 ? "income" : "expense";
    let internal = false;
    let refund = false;
    let status: RowStatus = "new";
    let note: string | undefined;

    if (row.kind === "yield" && ctx.options.yields === "ignore") {
      status = "ignored";
      note = "Rendimientos (ignorado)";
    } else if (row.kind === "reserved" || row.kind === "released") {
      type = "transfer";
      internal = true;
      note = "Movimiento interno";
    } else if (row.kind === "refund") {
      type = "income";
      refund = true;
      note = "Devolución: netea el pago original";
    }

    if (status === "new" && (ctx.existingExternalIds.has(dedupeKey) || seenInFile.has(dedupeKey))) {
      status = "duplicate";
      note = "Ya importada";
    }
    seenInFile.add(dedupeKey);

    const isPerson = row.kind === "transfer_out" || row.kind === "transfer_in";
    const cp = isPerson ? findCounterparty(ctx.counterparties, row.name) : null;
    let categoryId: string | null = null;
    let categorySource: CategorySource = null;
    let merchant = row.name;
    let debt: AnalyzedRow["debt"] = null;

    if (cp) {
      merchant = cp.label || cp.displayName;
      const ov = cp.amountOverrides?.find((o) => o.amountCents === amountCents);
      if (ov?.categoryId) {
        categoryId = String(ov.categoryId);
        if (ov.label) merchant = ov.label;
      } else if (cp.defaultCategoryId) categoryId = String(cp.defaultCategoryId);
      if (categoryId) categorySource = "counterparty";
      if (cp.mode === "transfer") {
        type = "transfer";
      } else if (cp.mode === "debt" && cp.debtPersonId) {
        debt = { personId: String(cp.debtPersonId), kind: row.amountCents < 0 ? "loan" : "payment" };
      }
    } else if (!isPerson) {
      const rule = matchRule(ctx.rules, row.rawType);
      if (rule) {
        categoryId = String(rule.categoryId);
        categorySource = "rule";
        if (rule.label) merchant = rule.label;
      }
    }
    const ov = ctx.overrides[row.referenceId] ?? ctx.overrides[String(row.index)];
    if (ov) {
      categoryId = ov;
      categorySource = "override";
    }
    return {
      row,
      status,
      note,
      type,
      amountCents,
      categoryId,
      categorySource,
      merchant,
      counterpartyId: cp ? String(cp._id) : null,
      counterpartyName: cp ? cp.displayName : null,
      internal,
      refund,
      debt,
      needsCounterparty: isPerson && !cp && status === "new",
      dedupeKey,
    };
  });
}

export interface PersonGroup {
  name: string;
  count: number;
  totalCents: number;
}

/** Agrupa por nombre las transferencias sin contraparte (FT-CPA-4). */
export function groupUnassigned(rows: AnalyzedRow[]): PersonGroup[] {
  const g = new Map<string, PersonGroup>();
  for (const r of rows) {
    if (!r.needsCounterparty) continue;
    const key = normalizeName(r.row.name);
    const cur = g.get(key) ?? { name: r.row.name, count: 0, totalCents: 0 };
    cur.count++;
    cur.totalCents += r.row.amountCents;
    g.set(key, cur);
  }
  return [...g.values()].sort((a, b) => b.count - a.count || Math.abs(b.totalCents) - Math.abs(a.totalCents));
}

/** Comercios (Pago X / Compra X) sin categoría: candidatos a regla. */
export function groupUncategorizedMerchants(rows: AnalyzedRow[]): PersonGroup[] {
  const g = new Map<string, PersonGroup>();
  for (const r of rows) {
    if (r.status !== "new" || r.categoryId || r.needsCounterparty || r.type === "transfer") continue;
    if (!["payment", "purchase", "order", "other"].includes(r.row.kind)) continue;
    const cur = g.get(r.row.name) ?? { name: r.row.name, count: 0, totalCents: 0 };
    cur.count++;
    cur.totalCents += r.row.amountCents;
    g.set(r.row.name, cur);
  }
  return [...g.values()].sort((a, b) => b.count - a.count);
}
