import { describe, expect, test } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { analyzeRows, findCounterparty, groupUncategorizedMerchants, groupUnassigned, matchRule, type CounterpartyLite, type RuleLite } from "./analyze";
import { classifyMpType, parseMpCsv } from "./mp";
import { normalizeName } from "./normalize";

// Datos 100% inventados (nombres y montos ficticios).
const SAMPLE = [
  "INITIAL_BALANCE;CREDITS;DEBITS;FINAL_BALANCE",
  "1.000,00;3.500,50;-1.515,00;2.985,50",
  "",
  "RELEASE_DATE;TRANSACTION_TYPE;REFERENCE_ID;TRANSACTION_NET_AMOUNT;PARTIAL_BALANCE",
  "01-05-2026;Rendimientos ;1001;0,50;1.000,50",
  "02-05-2026;Transferencia recibida Ana Gómez Ruiz;1002;3.500,00;4.500,50",
  "02-05-2026;Pago Spotify;1003;-100,00;4.400,50",
  "03-05-2026;Transferencia enviada Perez Juan Carlos;1004;-1.000,00;3.400,50",
  "03-05-2026;Transferencia enviada Tomás Ficticio;1005;-200,00;3.200,50",
  "04-05-2026;Dinero reservado Gastos;1006;-300,00;2.900,50",
  "04-05-2026;Pago EBANX S.A.;1007;-50,00;2.850,50",
  "05-05-2026;Devolución de pago EBANX S.A.;1007;50,00;2.900,50",
  "06-05-2026;Dinero retirado Gastos;1008;300,00;3.200,50",
  "07-05-2026;Compra Mercado Libre;1009;-215,00;2.985,50",
  "",
].join("\n");

describe("parser MP", () => {
  const r = parseMpCsv(SAMPLE);

  test("resumen, filas y validación saldo inicial + Σ = final", () => {
    expect(r.summary).toEqual({ initialCents: 100000, creditsCents: 350050, debitsCents: -151500, finalCents: 298550 });
    expect(r.rows).toHaveLength(10);
    expect(r.validation).toMatchObject({ ok: true, balanceBreaks: 0, computedFinalCents: 298550, expectedFinalCents: 298550 });
    expect(r.rows[0]).toMatchObject({ date: "2026-05-01", kind: "yield", amountCents: 50, referenceId: "1001" });
  });

  test("números es-AR y fechas DD-MM-YYYY", () => {
    expect(r.rows[1]).toMatchObject({ date: "2026-05-02", amountCents: 350000, balanceCents: 450050 });
    expect(r.rows[2].amountCents).toBe(-10000);
  });

  test("clasifica prefijos conocidos", () => {
    expect(classifyMpType("Transferencia enviada Juan Pérez")).toEqual({ kind: "transfer_out", name: "Juan Pérez" });
    expect(classifyMpType("Transferencia recibida Ana")).toEqual({ kind: "transfer_in", name: "Ana" });
    expect(classifyMpType("Pago Spotify")).toEqual({ kind: "payment", name: "Spotify" });
    expect(classifyMpType("Pago de servicio ARCA")).toEqual({ kind: "payment", name: "ARCA" });
    expect(classifyMpType("Pago de suscripción Meli+")).toEqual({ kind: "payment", name: "Meli+" });
    expect(classifyMpType("Compra Mercado Libre")).toEqual({ kind: "purchase", name: "Mercado Libre" });
    expect(classifyMpType("Pedido Rappi")).toEqual({ kind: "order", name: "Rappi" });
    expect(classifyMpType("Rendimientos ")).toMatchObject({ kind: "yield" });
    expect(classifyMpType("Devolución de pago X")).toEqual({ kind: "refund", name: "X" });
    expect(classifyMpType("Dinero reservado Gastos").kind).toBe("reserved");
    expect(classifyMpType("Dinero retirado Gastos").kind).toBe("released");
    expect(classifyMpType("Algo raro").kind).toBe("other");
  });

  test("detecta saldo inconsistente", () => {
    const bad = parseMpCsv(SAMPLE.replace("2.985,50\n", "9.999,00\n").replace("3.500,50;-1.515,00;2.985,50", "3.500,50;-1.515,00;3.000,00"));
    expect(bad.validation.ok).toBe(false);
    expect(bad.validation.errors.length).toBeGreaterThan(0);
  });

  test("archivo que no es de MP", () => {
    const x = parseMpCsv("a;b\n1;2");
    expect(x.validation.ok).toBe(false);
    expect(x.rows).toHaveLength(0);
  });

  test("ids repetidos (no devoluciones) se desambiguan", () => {
    const csv = SAMPLE.replace("1003;-100,00", "1002;-100,00");
    const rows = parseMpCsv(csv).rows;
    expect(rows[1].referenceId).toBe("1002");
    expect(rows[2].referenceId).toBe("1002#2");
  });
});

describe("contrapartes y reglas", () => {
  const cps: CounterpartyLite[] = [
    {
      _id: "cp1",
      displayName: "Juan · Peluquería",
      identifiers: [{ kind: "mp_name", value: "Juan Carlos Perez", normalized: normalizeName("Juan Carlos Perez") }],
      defaultCategoryId: "cat-hogar",
      label: "Peluquería",
      mode: "normal",
      amountOverrides: [{ amountCents: 20000, categoryId: "cat-ocio", label: "Otra cosa" }],
    },
    {
      _id: "cp2",
      displayName: "Papá",
      identifiers: [{ kind: "mp_name", value: "Ana Gómez Ruiz", normalized: normalizeName("Ana Gómez Ruiz") }],
      defaultCategoryId: null,
      mode: "debt",
      debtPersonId: "person1",
      amountOverrides: [],
    },
  ];
  const rules: RuleLite[] = [
    { _id: "r1", match: "contains", pattern: "spotify", categoryId: "cat-ocio", priority: 0 },
    { _id: "r2", match: "regex", pattern: "^Pago EBANX", categoryId: "cat-ocio", priority: 5 },
    { _id: "r3", match: "contains", pattern: "pago", categoryId: "cat-otros", priority: -1 },
  ];

  test("normalizado: sin tildes, mayúsculas ni orden de palabras", () => {
    expect(findCounterparty(cps, "PEREZ juan CARLOS")?._id).toBe("cp1");
    expect(findCounterparty(cps, "Ana Gomez Ruiz")?._id).toBe("cp2");
    expect(findCounterparty(cps, "Otro Nombre")).toBeNull();
  });

  test("reglas por prioridad", () => {
    expect(matchRule(rules, "Pago Spotify")?._id).toBe("r1");
    expect(matchRule(rules, "Pago EBANX S.A.")?._id).toBe("r2");
    expect(matchRule(rules, "Pago Luz")?._id).toBe("r3");
    expect(matchRule(rules, "Compra X")).toBeNull();
  });

  const { rows } = parseMpCsv(SAMPLE);
  const run = (over: Partial<Parameters<typeof analyzeRows>[1]> = {}) =>
    analyzeRows(rows, { counterparties: cps, rules, existingExternalIds: new Set(), overrides: {}, options: { yields: "ignore" }, ...over });

  test("prioridad contraparte > regla > sin categoría; ignora rendimientos; interno; refund; deuda", () => {
    const a = run();
    expect(a[0]).toMatchObject({ status: "ignored", note: "Rendimientos (ignorado)" });
    expect(a[1]).toMatchObject({ type: "income", counterpartyId: "cp2", debt: { personId: "person1", kind: "payment" } });
    expect(a[2]).toMatchObject({ categoryId: "cat-ocio", categorySource: "rule" }); // Spotify
    expect(a[3]).toMatchObject({ counterpartyId: "cp1", categoryId: "cat-hogar", categorySource: "counterparty", merchant: "Peluquería" });
    expect(a[4]).toMatchObject({ needsCounterparty: true, categoryId: null });
    expect(a[5]).toMatchObject({ type: "transfer", internal: true });
    expect(a[6]).toMatchObject({ categoryId: "cat-ocio", amountCents: 5000 });
    expect(a[7]).toMatchObject({ refund: true, type: "income" });
    expect(a[8]).toMatchObject({ type: "transfer", internal: true });
    expect(a[9]).toMatchObject({ categoryId: null, categorySource: null }); // Compra: sin regla
  });

  test("excepción por monto de la contraparte", () => {
    const csv = SAMPLE.replace("Perez Juan Carlos;1004;-1.000,00", "Perez Juan Carlos;1004;-200,00");
    const a = analyzeRows(parseMpCsv(csv).rows, { counterparties: cps, rules, existingExternalIds: new Set(), overrides: {}, options: { yields: "ignore" } });
    expect(a[3]).toMatchObject({ categoryId: "cat-ocio", merchant: "Otra cosa" });
  });

  test("override manual manda sobre todo", () => {
    expect(run({ overrides: { "1003": "cat-x" } })[2]).toMatchObject({ categoryId: "cat-x", categorySource: "override" });
  });

  test("rendimientos como ingreso (configurable)", () => {
    expect(run({ options: { yields: "income" } })[0]).toMatchObject({ status: "new", type: "income" });
  });

  test("dedupe: ya importadas y repetidas en el archivo", () => {
    const a = run({ existingExternalIds: new Set(["1002", "1003"]) });
    expect(a.filter((x) => x.status === "duplicate").map((x) => x.row.referenceId)).toEqual(["1002", "1003"]);
    const twice = analyzeRows([...rows, rows[2]], { counterparties: cps, rules, existingExternalIds: new Set(), overrides: {}, options: { yields: "ignore" } });
    expect(twice[twice.length - 1].status).toBe("duplicate");
  });

  test("agrupa transferencias sin contraparte y comercios sin categoría", () => {
    const a = run();
    expect(groupUnassigned(a)).toEqual([{ name: "Tomás Ficticio", count: 1, totalCents: -20000 }]);
    expect(groupUncategorizedMerchants(a).map((g) => g.name)).toEqual(["Mercado Libre"]);
  });
});

// Test local opcional: usa el extracto real si existe (docs/files/ está gitignoreado). No imprime datos personales.
const realDir = path.resolve(__dirname, "../../../docs/files/mp");
const realFiles = fs.existsSync(realDir) ? fs.readdirSync(realDir).filter((f) => f.endsWith(".csv")) : [];
describe.skipIf(realFiles.length === 0)("extracto real (local)", () => {
  test.each(realFiles)("%s valida saldo inicial + Σ = final", (f) => {
    const r = parseMpCsv(fs.readFileSync(path.join(realDir, f), "utf8"));
    expect(r.validation.errors).toEqual([]);
    expect(r.validation.ok).toBe(true);
    expect(r.rows.length).toBeGreaterThan(0);
    expect(r.rows.every((x) => x.kind !== "other")).toBe(true);
  });
});
