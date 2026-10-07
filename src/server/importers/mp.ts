import Papa from "papaparse";
import { parseAmountEs } from "@/lib/money";
import { parseDmy } from "@/lib/dates";
import type { ImportedRow } from "../models/import";

export type MpKind = "transfer_out" | "transfer_in" | "payment" | "purchase" | "order" | "yield" | "reserved" | "released" | "refund" | "other";

export interface MpSummary {
  initialCents: number;
  creditsCents: number;
  debitsCents: number;
  finalCents: number;
}

export interface MpValidation {
  ok: boolean;
  expectedFinalCents: number;
  computedFinalCents: number;
  /** Filas cuyo PARTIAL_BALANCE no coincide con saldo anterior + monto. */
  balanceBreaks: number;
  errors: string[];
}

export interface MpParseResult {
  summary: MpSummary | null;
  rows: ImportedRow[];
  validation: MpValidation;
}

/** Prefijos conocidos, de más específico a más genérico. */
const PREFIXES: [string, MpKind][] = [
  ["Transferencia enviada ", "transfer_out"],
  ["Transferencia recibida ", "transfer_in"],
  ["Devolución de pago ", "refund"],
  ["Devolucion de pago ", "refund"],
  ["Dinero reservado", "reserved"],
  ["Dinero retirado", "released"],
  ["Pago de suscripción ", "payment"],
  ["Pago de suscripcion ", "payment"],
  ["Pago de servicio ", "payment"],
  ["Pago ", "payment"],
  ["Compra ", "purchase"],
  ["Pedido ", "order"],
];

/** "Transferencia enviada Juan Pérez" → { kind: transfer_out, name: "Juan Pérez" }. */
export function classifyMpType(raw: string): { kind: MpKind; name: string } {
  const t = raw.trim().replace(/\s+/g, " ");
  if (/^rendimientos$/i.test(t)) return { kind: "yield", name: "Rendimientos" };
  for (const [prefix, kind] of PREFIXES) {
    if (t.toLowerCase().startsWith(prefix.toLowerCase())) {
      const name = t.slice(prefix.length).trim();
      return { kind, name: name || t };
    }
  }
  return { kind: "other", name: t };
}

function parseSummary(line1: string, line2: string): MpSummary | null {
  const h = line1.split(";").map((s) => s.trim());
  const v = line2.split(";").map((s) => s.trim());
  const get = (k: string) => {
    const i = h.indexOf(k);
    return i >= 0 ? parseAmountEs(v[i] ?? "") : null;
  };
  const [initialCents, creditsCents, debitsCents, finalCents] = [get("INITIAL_BALANCE"), get("CREDITS"), get("DEBITS"), get("FINAL_BALANCE")];
  if ([initialCents, creditsCents, debitsCents, finalCents].some((x) => x == null)) return null;
  return { initialCents: initialCents!, creditsCents: creditsCents!, debitsCents: debitsCents!, finalCents: finalCents! };
}

/**
 * Parsea un `account_statement-*.csv` de Mercado Pago.
 * Formato: separador `;`, números es-AR, fecha DD-MM-YYYY, resumen en las primeras líneas.
 */
export function parseMpCsv(input: string): MpParseResult {
  const text = input.replace(/^﻿/, "").replace(/\r\n?/g, "\n");
  const lines = text.split("\n");
  const headerIdx = lines.findIndex((l) => l.trim().startsWith("RELEASE_DATE"));
  const errors: string[] = [];
  if (headerIdx < 0) {
    return {
      summary: null,
      rows: [],
      validation: { ok: false, expectedFinalCents: 0, computedFinalCents: 0, balanceBreaks: 0, errors: ["No parece un extracto de Mercado Pago (falta la cabecera RELEASE_DATE)"] },
    };
  }
  const sumIdx = lines.findIndex((l) => l.trim().startsWith("INITIAL_BALANCE"));
  const summary = sumIdx >= 0 && lines[sumIdx + 1] ? parseSummary(lines[sumIdx], lines[sumIdx + 1]) : null;
  if (!summary) errors.push("No se pudo leer el resumen inicial (INITIAL_BALANCE/FINAL_BALANCE)");

  const parsed = Papa.parse<Record<string, string>>(lines.slice(headerIdx).join("\n"), { header: true, delimiter: ";", skipEmptyLines: true });
  const rows: ImportedRow[] = [];
  const seenRef = new Map<string, number>();
  parsed.data.forEach((r, i) => {
    const line = headerIdx + 2 + i;
    const date = parseDmy(r.RELEASE_DATE ?? "");
    const amount = parseAmountEs(r.TRANSACTION_NET_AMOUNT ?? "");
    const balance = parseAmountEs(r.PARTIAL_BALANCE ?? "");
    const rawType = (r.TRANSACTION_TYPE ?? "").trim();
    const ref = (r.REFERENCE_ID ?? "").trim();
    if (!date || amount == null || balance == null || !rawType || !ref) {
      errors.push(`Línea ${line}: fila inválida`);
      return;
    }
    const { kind, name } = classifyMpType(rawType);
    // Mismo REFERENCE_ID repetido (salvo devoluciones, que comparten id con el pago): se desambigua por orden
    let referenceId = ref;
    if (kind !== "refund") {
      const n = (seenRef.get(ref) ?? 0) + 1;
      seenRef.set(ref, n);
      if (n > 1) referenceId = `${ref}#${n}`;
    }
    rows.push({ index: rows.length, date: date.toISOString().slice(0, 10), rawType, referenceId, amountCents: amount, balanceCents: balance, kind, name });
  });

  // Validación: saldo inicial + Σ filas = saldo final, y cadena de PARTIAL_BALANCE
  const sum = rows.reduce((s, r) => s + r.amountCents, 0);
  let prev = summary?.initialCents ?? rows[0]?.balanceCents ?? 0;
  let balanceBreaks = 0;
  for (const r of rows) {
    if (prev + r.amountCents !== r.balanceCents) balanceBreaks++;
    prev = r.balanceCents;
  }
  const computedFinalCents = (summary?.initialCents ?? 0) + sum;
  const expectedFinalCents = summary?.finalCents ?? 0;
  const ok = !!summary && errors.length === 0 && computedFinalCents === expectedFinalCents && balanceBreaks === 0;
  if (summary && computedFinalCents !== expectedFinalCents) errors.push("El saldo inicial + movimientos no coincide con el saldo final");
  if (balanceBreaks) errors.push(`${balanceBreaks} fila(s) con saldo parcial inconsistente`);
  return { summary, rows, validation: { ok, expectedFinalCents, computedFinalCents, balanceBreaks, errors } };
}
