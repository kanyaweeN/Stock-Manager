import { describe, expect, it } from "vitest";
import {
  REPURCHASE_MIN_PURCHASES,
  repurchaseStats,
  sortByDueSoonest,
  type RepurchaseStats,
} from "@/lib/domain/repurchase";
import type { PricePoint } from "@/lib/types";

const NOW = new Date(2026, 5, 1); // 2026-06-01

function pp(date: string, qty = 1, price = 100): PricePoint {
  return { date, price, qty };
}

describe("repurchaseStats — ข้อมูลไม่พอ", () => {
  it(`ยังซื้อไม่ถึง ${REPURCHASE_MIN_PURCHASES} ครั้ง = null`, () => {
    expect(repurchaseStats({ priceHistory: [] })).toBeNull();
    expect(repurchaseStats({ priceHistory: [pp("2026-01-01")] })).toBeNull();
    expect(repurchaseStats({})).toBeNull();
  });

  it("จุดที่ไม่มีวันที่ตัดทิ้ง (ไม่ล้ม)", () => {
    expect(
      repurchaseStats({
        priceHistory: [{ date: "", price: 10, qty: 1 }, pp("2026-01-01")],
      }),
    ).toBeNull();
  });

  it("สองจุดวันเดียวกัน (gap = 0) = null", () => {
    expect(
      repurchaseStats({ priceHistory: [pp("2026-01-01"), pp("2026-01-01")] }),
    ).toBeNull();
  });
});

describe("repurchaseStats — คำนวณช่วงห่าง", () => {
  it("2 ครั้งห่าง 30 วัน ซื้อครั้งละ 1 = 30 วัน/แพ็ค · ครั้งล่าสุดซื้อ 1 = อีก 30 วัน", () => {
    const stats = repurchaseStats(
      { priceHistory: [pp("2026-04-01", 1), pp("2026-05-01", 1)] },
      NOW,
    );
    expect(stats).not.toBeNull();
    expect(stats!.daysPerPack).toBe(30);
    expect(stats!.nextDate).toBe("2026-05-31");
    expect(stats!.daysUntilNext).toBe(-1); // NOW = 06-01, next = 05-31 → เลยไป 1 วัน
    expect(stats!.confidence).toBe("low"); // แค่ 2 ครั้ง
  });

  it("ครั้งล่าสุดซื้อ 2 แพ็ค → ทำนายว่าอยู่ได้เป็นเท่าตัว", () => {
    const stats = repurchaseStats(
      { priceHistory: [pp("2026-01-01", 1), pp("2026-02-01", 2)] },
      NOW,
    );
    // 31 วัน / 1 แพ็คก่อน = 31 วัน/แพ็ค · ครั้งล่าสุดซื้อ 2 → 62 วัน
    expect(stats!.daysPerPack).toBe(31);
    expect(stats!.nextDate).toBe("2026-04-04");
  });

  it("ซื้อครั้งก่อน 2 แพ็ค แล้วอยู่ได้ 60 วัน = 30 วัน/แพ็ค (ถ่วงน้ำหนักด้วย qty)", () => {
    const stats = repurchaseStats(
      {
        priceHistory: [
          pp("2026-01-01", 2),
          pp("2026-03-02", 1), // ห่าง 60 วัน → 30 วัน/แพ็ค (weight 2)
          pp("2026-04-01", 1), // ห่าง 30 วัน → 30 วัน/แพ็ค (weight 1)
        ],
      },
      NOW,
    );
    expect(stats!.daysPerPack).toBe(30);
    expect(stats!.purchases).toBe(3);
  });
});

describe("repurchaseStats — confidence", () => {
  it("3 ครั้งขึ้นไปและช่วงห่างสม่ำเสมอ = ok", () => {
    const stats = repurchaseStats(
      {
        priceHistory: [
          pp("2026-01-01"),
          pp("2026-02-01"),
          pp("2026-03-03"),
          pp("2026-04-02"),
        ],
      },
      NOW,
    );
    expect(stats!.confidence).toBe("ok");
  });

  it("3 ครั้งแต่ช่วงห่างแกว่งมาก = low", () => {
    const stats = repurchaseStats(
      {
        priceHistory: [
          pp("2026-01-01"), // 10 วัน
          pp("2026-01-11"),
          pp("2026-06-01"), // 141 วัน — แกว่งเกิน 50%
        ],
      },
      NOW,
    );
    expect(stats!.confidence).toBe("low");
  });

  it("แค่ 2 ครั้งเสมอ = low ต่อให้ไม่แกว่ง (ไม่มีอะไรให้วัดความแกว่ง)", () => {
    const stats = repurchaseStats(
      { priceHistory: [pp("2026-01-01"), pp("2026-02-01")] },
      NOW,
    );
    expect(stats!.confidence).toBe("low");
  });
});

describe("sortByDueSoonest", () => {
  it("เลยกำหนดมากสุดมาก่อน · ไม่รู้ตกท้าย", () => {
    const items = [
      { id: "a" }, // อีก 10 วัน
      { id: "b" }, // เลยไป 5 วัน (−5)
      { id: "c" }, // null
      { id: "d" }, // อีก 0 วัน
    ];
    const stats = new Map<string, RepurchaseStats | null>([
      ["a", { ...base(), daysUntilNext: 10 }],
      ["b", { ...base(), daysUntilNext: -5 }],
      ["c", null],
      ["d", { ...base(), daysUntilNext: 0 }],
    ]);
    expect(sortByDueSoonest(items, stats).map((i) => i.id)).toEqual(["b", "d", "a", "c"]);
  });
});

function base(): RepurchaseStats {
  return {
    purchases: 2,
    daysPerPack: 30,
    lastDate: "2026-01-01",
    lastQty: 1,
    nextDate: "2026-01-31",
    daysUntilNext: 0,
    confidence: "low",
  };
}
