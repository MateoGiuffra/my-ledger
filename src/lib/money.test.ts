import { expect, test } from "vitest";
import { formatMoney, parseAmountEs, parseUserAmount } from "./money";

test("parseAmountEs", () => {
  expect(parseAmountEs("-1.415.972,44")).toBe(-141597244);
  expect(parseAmountEs("2.500")).toBe(250000);
  expect(parseAmountEs("100,5")).toBe(10050);
  expect(parseAmountEs("0,07")).toBe(7);
  expect(parseAmountEs("abc")).toBeNull();
});

test("parseUserAmount", () => {
  expect(parseUserAmount("1500")).toBe(150000);
  expect(parseUserAmount("1500.5")).toBe(150050);
  expect(parseUserAmount("1.500,50")).toBe(150050);
});

test("formatMoney", () => {
  expect(formatMoney(163000_00)).toBe("$ 163.000");
  expect(formatMoney(-150050)).toBe("-$ 1.500,50");
  expect(formatMoney(10000, "USD")).toBe("US$ 100");
});
