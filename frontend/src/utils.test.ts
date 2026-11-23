import { describe, expect, it } from "vitest";
import { contrast, fromCents, readable, toCents } from "./utils";

describe("dinheiro", () => {
  it("converte texto em centavos", () => {
    expect(toCents("25,90")).toBe(2590);
    expect(toCents("1.234,56")).toBe(123456);
    expect(toCents("10")).toBe(1000);
  });
  it("rejeita valores inválidos", () => {
    expect(toCents("abc")).toBeNaN();
    expect(toCents("0")).toBeNaN();
    expect(toCents("-5")).toBeNaN();
  });
  it("formata centavos", () => {
    expect(fromCents(2590)).toBe("25,90");
  });
});
describe("contraste", () => {
  it("preto e branco = 21:1", () => {
    expect(contrast("#000000", "#FFFFFF")).toBeCloseTo(21, 0);
  });
  it("escolhe texto legível", () => {
    expect(readable("#000000")).toBe("#FFFFFF");
    expect(readable("#F4F8FF")).toBe("#000000");
  });
  it("azul padrão sobre preto passa de 3:1", () => {
    expect(contrast("#1E90FF", "#000000")).toBeGreaterThan(3);
  });
});
