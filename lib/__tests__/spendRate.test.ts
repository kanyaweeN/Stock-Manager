import { describe, expect, it } from "vitest";
import { spendRate } from "@/lib/domain/spendRate";
import type { PricePoint, StockItem, UsagePoint } from "@/lib/types";

function item(overrides: Partial<StockItem> = {}): StockItem {
  return {
    id: "x",
    name: "test",
    cats: [],
    qty: 1,
    min: 0,
    note: "",
    ...overrides,
  };
}

const priceHistory = (points: Array<Partial<PricePoint> & { date: string; price: number }>): PricePoint[] =>
  points.map((p) => ({ qty: 1, ...p }));

const dailyLog = (start: string, deltas: number[]): UsagePoint[] => {
  const m = start.match(/^(\d{4})-(\d{2})-(\d{2})$/)!;
  const base = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return deltas.map((delta, i) => {
    const d = new Date(base);
    d.setDate(base.getDate() + i);
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    return { date: iso, delta };
  });
};

describe("spendRate", () => {
  it("ใช้ usageLog ก่อนเพราะแม่นกว่าประวัติซื้อ", () => {
    // ใช้ไป 1 ชิ้น/วัน ตลอด 14 วัน (จุดแรกเป็นจุดเริ่ม ไม่นับใน perDay → 13 ÷ 13 = 1)
    const log = dailyLog("2026-08-01", Array(14).fill(-1));
    const rate = spendRate(
      item({
        usageLog: log,
        priceHistory: priceHistory([{ date: "2026-07-01", price: 20, qty: 5 }]),
      }),
    );
    expect(rate?.source).toBe("usage");
    expect(rate?.bahtPerDay).toBeCloseTo(20, 5);
    expect(rate?.bahtPerMonth).toBeCloseTo(600, 5);
    expect(rate?.daysPerPack).toBeCloseTo(1, 5);
  });

  it("ตกลงมาที่ประวัติซื้อเมื่อ usageLog ไม่พอ", () => {
    // ซื้อทุก 30 วัน ครั้งละ 1 แพ็ค → 30 วัน/แพ็ค, ราคาเฉลี่ย ฿90
    const rate = spendRate(
      item({
        priceHistory: priceHistory([
          { date: "2026-01-01", price: 90 },
          { date: "2026-01-31", price: 90 },
          { date: "2026-03-02", price: 90 },
        ]),
      }),
    );
    expect(rate?.source).toBe("purchases");
    expect(rate?.daysPerPack).toBeCloseTo(30, 0);
    expect(rate?.bahtPerDay).toBeCloseTo(3, 1);
    expect(rate?.bahtPerMonth).toBeCloseTo(90, 0);
  });

  it("ใช้ราคาเฉลี่ยแบบถ่วงน้ำหนัก ไม่ใช่ราคาปัจจุบัน", () => {
    // ซื้อ ฿100 × 10 ชิ้น แล้ว ฿200 × 1 ชิ้น → เฉลี่ยถ่วง = (1000+200)/11 ≈ 109.09
    const log = dailyLog("2026-08-01", Array(15).fill(-1));
    const rate = spendRate(
      item({
        price: 500, // ราคาปัจจุบันสูงกว่ามาก — ตัวนี้ห้ามถูกใช้
        priceHistory: priceHistory([
          { date: "2026-06-01", price: 100, qty: 10 },
          { date: "2026-07-01", price: 200, qty: 1 },
        ]),
        usageLog: log,
      }),
    );
    expect(rate?.avgPricePerPack).toBeCloseTo(109.09, 1);
    expect(rate?.bahtPerDay).toBeCloseTo(109.09, 1);
  });

  it("ตกไปใช้ item.price เมื่อยังไม่มีประวัติราคา (แต่มี usageLog)", () => {
    const log = dailyLog("2026-08-01", Array(14).fill(-1));
    const rate = spendRate(item({ price: 50, usageLog: log }));
    expect(rate?.avgPricePerPack).toBe(50);
    expect(rate?.bahtPerDay).toBeCloseTo(50, 5);
  });

  it("คืน null เมื่อไม่มีทั้งราคาและประวัติราคา", () => {
    const log = dailyLog("2026-08-01", Array(14).fill(-1));
    expect(spendRate(item({ usageLog: log }))).toBeNull();
  });

  it("คืน null เมื่อราคา 0 (ของแถม)", () => {
    const log = dailyLog("2026-08-01", Array(14).fill(-1));
    expect(spendRate(item({ price: 0, usageLog: log }))).toBeNull();
  });

  it("คืน null เมื่อทั้ง usageLog และประวัติซื้อไม่พอ", () => {
    expect(
      spendRate(
        item({
          price: 100,
          priceHistory: priceHistory([{ date: "2026-01-01", price: 100 }]),
        }),
      ),
    ).toBeNull();
  });
});
