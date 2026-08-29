import { describe, expect, it } from "vitest";
import { countUnits, isLow, isOutOfStock, remainingUnits } from "@/lib/stock";
import type { StockItem } from "@/lib/types";

const item = (over: Partial<StockItem> = {}): StockItem => ({
  id: "i", name: "x", cats: [], qty: 1, min: 0, note: "", ...over,
});

describe("isLow / isOutOfStock", () => {
  it("min = 0 คือไม่ได้ตั้งเตือน จึงไม่มีวันนับเป็นใกล้หมด", () => {
    expect(isLow({ qty: 1, min: 0 })).toBe(false);
    expect(isLow({ qty: 0, min: 0 })).toBe(false);
  });

  it("ใกล้หมด = ยังมีของ แต่ไม่เกินขั้นต่ำ", () => {
    expect(isLow({ qty: 2, min: 5 })).toBe(true);
    expect(isLow({ qty: 5, min: 5 })).toBe(true);
    expect(isLow({ qty: 6, min: 5 })).toBe(false);
  });

  it("ของหมดไม่นับเป็นใกล้หมด — คนละสถานะกัน", () => {
    expect(isLow({ qty: 0, min: 5 })).toBe(false);
    expect(isOutOfStock({ qty: 0 })).toBe(true);
    expect(isOutOfStock({ qty: 1 })).toBe(false);
  });
});

describe("remainingUnits", () => {
  it("ไม่กรอก openPct = เต็มทุกขวด คืน qty ตรงๆ", () => {
    expect(remainingUnits({ qty: 3 })).toBe(3);
    expect(remainingUnits({ qty: 0 })).toBe(0);
  });

  it("นับเศษของขวดที่เปิดอยู่ 1 ขวด ที่เหลือถือว่าเต็ม", () => {
    expect(remainingUnits({ qty: 3, openPct: 50 })).toBe(2.5);
    expect(remainingUnits({ qty: 1, openPct: 40 })).toBeCloseTo(0.4);
    expect(remainingUnits({ qty: 1, openPct: 0 })).toBe(0);
  });

  it("openPct ที่เพี้ยนถูกหนีบไม่ให้ดันมูลค่าสต็อกเกินจริง", () => {
    expect(remainingUnits({ qty: 2, openPct: 250 })).toBe(2);
    expect(remainingUnits({ qty: 2, openPct: -50 })).toBe(1);
  });

  it("ของหมดแล้วไม่สนใจ openPct ที่ค้างอยู่", () => {
    expect(remainingUnits({ qty: 0, openPct: 50 })).toBe(0);
  });
});

describe("countUnits", () => {
  it("ของในกลุ่มเดียวกันนับรวมเป็น 1 หน่วย", () => {
    expect(
      countUnits([
        item({ id: "a" }),
        item({ id: "b", groupId: "g1" }),
        item({ id: "c", groupId: "g1" }),
        item({ id: "d", groupId: "g2" }),
      ])
    ).toBe(3);
  });

  it("ไม่มีของเลย = 0", () => {
    expect(countUnits([])).toBe(0);
  });
});
