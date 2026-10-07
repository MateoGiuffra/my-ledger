export type Currency = "ARS" | "USD";

/** Parsea un número es-AR ("-1.415.972,44") a centavos enteros. Devuelve null si no es válido. */
export function parseAmountEs(input: string): number | null {
  const s = input.trim().replace(/\s/g, "").replace(/^\$/, "");
  if (!/^-?\d{1,3}(\.\d{3})*(,\d+)?$|^-?\d+(,\d+)?$/.test(s)) return null;
  const neg = s.startsWith("-");
  const [intPart, decPart = ""] = s.replace("-", "").replace(/\./g, "").split(",");
  const cents = Number(intPart) * 100 + Number((decPart + "00").slice(0, 2));
  return neg ? -cents : cents;
}

/** Parsea lo que tipea el usuario ("1500", "1500,5", "1.500,50", "1500.50") a centavos. */
export function parseUserAmount(input: string): number | null {
  const s = input.trim();
  if (/^-?\d+(\.\d{1,2})?$/.test(s)) {
    const neg = s.startsWith("-");
    const [i, d = ""] = s.replace("-", "").split(".");
    const c = Number(i) * 100 + Number((d + "00").slice(0, 2));
    return neg ? -c : c;
  }
  return parseAmountEs(s);
}

export function formatMoney(cents: number, currency: Currency = "ARS"): string {
  const abs = Math.abs(cents);
  const int = Math.floor(abs / 100).toLocaleString("es-AR");
  const dec = String(abs % 100).padStart(2, "0");
  const sym = currency === "USD" ? "US$" : "$";
  const body = dec === "00" ? int : `${int},${dec}`;
  return `${cents < 0 ? "-" : ""}${sym} ${body}`;
}

export function toCents(units: number): number {
  return Math.round(units * 100);
}
