import { describe, expect, it } from "vitest";
import { applyPieceDelta, countUnits, isLow, isOutOfStock, remainingUnits } from "@/lib/domain/stock";
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

describe("applyPieceDelta", () => {
  it("แพ็คละ 10 ชิ้น ใช้ไป 1 ชิ้น → เหลือ 9 ชิ้น = 1 แพ็คที่เปิดค้าง 90%", () => {
    expect(applyPieceDelta({ qty: 1 }, -1, 10)).toEqual({ qty: 1, openPct: 90, packDelta: -0.1 });
  });

  it("ใช้ครบ 10 ชิ้นจาก 1 แพ็ค → qty=0 และล้าง openPct ทิ้ง", () => {
    expect(applyPieceDelta({ qty: 1 }, -10, 10)).toEqual({ qty: 0, openPct: undefined, packDelta: -1 });
  });

  it("ใช้ทะลุแพ็ค (2 แพ็ค ใช้ 11 ชิ้น) → 1 แพ็คเปิดค้าง 90%", () => {
    expect(applyPieceDelta({ qty: 2 }, -11, 10)).toEqual({ qty: 1, openPct: 90, packDelta: -1.1 });
  });

  it("ใช้เกินของที่มี ถูกหนีบไม่ให้ติดลบ (packDelta = จำนวนที่ใช้จริง)", () => {
    expect(applyPieceDelta({ qty: 1, openPct: 20 }, -5, 10)).toEqual({ qty: 0, openPct: undefined, packDelta: -0.2 });
  });

  it("เพิ่มชิ้นเข้าไปในแพ็คที่เปิดค้าง — ครบพอดีต้องล้าง openPct", () => {
    expect(applyPieceDelta({ qty: 1, openPct: 90 }, 1, 10)).toEqual({ qty: 1, openPct: undefined, packDelta: 0.1 });
  });

  it("แพ็คขนาด 3 ปัด openPct เป็นทศนิยม กันเพี้ยนสะสม", () => {
    // 3 ชิ้น ใช้ 1 → เหลือ 2 ชิ้น = 2/3 = 66.67% (ไม่ใช่ 67%)
    const a = applyPieceDelta({ qty: 1 }, -1, 3);
    expect(a.qty).toBe(1);
    expect(a.openPct).toBeCloseTo(200 / 3, 5);
    // ใช้ต่ออีก 1 → เหลือ 1 ชิ้น = 1/3 = 33.33%
    const b = applyPieceDelta({ qty: a.qty, openPct: a.openPct }, -1, 3);
    expect(b.openPct).toBeCloseTo(100 / 3, 5);
    // ใช้อีก 1 → หมด (ไม่ควรเหลือเศษ)
    const c = applyPieceDelta({ qty: b.qty, openPct: b.openPct }, -1, 3);
    expect(c.qty).toBe(0);
    expect(c.openPct).toBeUndefined();
    expect(c.packDelta).toBeCloseTo(-1 / 3, 5);
  });

  it("delta = 0 หรือ packAmount ไม่ถูกต้อง = ไม่เปลี่ยนอะไร", () => {
    expect(applyPieceDelta({ qty: 2, openPct: 50 }, 0, 10)).toEqual({ qty: 2, openPct: 50, packDelta: 0 });
    expect(applyPieceDelta({ qty: 2 }, -1, 0)).toEqual({ qty: 2, openPct: undefined, packDelta: 0 });
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
