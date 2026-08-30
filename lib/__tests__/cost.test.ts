import { describe, expect, it } from "vitest";
import {
  bahtPerUnit,
  driftNote,
  duplicateLineIds,
  stockDrift,
  lineFromItem,
  parsePackSize,
  perUnitPrice,
  productionSummary,
  recipeTotals,
  totalPieces,
} from "@/lib/cost";
import { priceForMargin, roundPrice } from "@/lib/pricing";
import type { PricingSettings, Recipe, RecipeLine, StockItem } from "@/lib/types";

const item = (over: Partial<StockItem> = {}): StockItem => ({
  id: "i", name: "x", cats: [], qty: 1, min: 0, note: "", ...over,
});

const recipe = (over: Partial<Recipe> = {}): Recipe => ({
  id: "r", name: "สูตร", note: "", lines: [], yieldQty: 10, yieldUnit: "ก้อน", laborCost: 0, otherCost: 0, ...over,
});

describe("parsePackSize", () => {
  it("แกะน้ำหนัก/ปริมาตรเป็นหน่วยฐาน", () => {
    expect(parsePackSize("1000 g")).toEqual({ amount: 1000, unit: "g" });
    expect(parsePackSize("1 kg")).toEqual({ amount: 1000, unit: "g" });
    expect(parsePackSize("500ml")).toEqual({ amount: 500, unit: "ml" });
  });

  it("ขนาดที่เป็นมิติ (ความยาว) ไม่ใช่ขนาดบรรจุ", () => {
    expect(parsePackSize("10x15 ซม.")).toBeNull();
  });

  it("แกะไม่ออก = null ไม่เดามั่ว", () => {
    expect(parsePackSize("ขวดกลาง")).toBeNull();
    expect(parsePackSize("")).toBeNull();
    expect(parsePackSize(undefined)).toBeNull();
  });
});

describe("lineFromItem", () => {
  it("ใช้ packAmount/unit ที่กรอกไว้ก่อนการเดาจากข้อความ size", () => {
    const l = lineFromItem(item({ packAmount: 250, unit: "ml", size: "1000 g", price: 90 }));
    expect(l).toMatchObject({ packAmount: 250, unit: "ml", buyPrice: 90 });
  });

  it("ไม่กรอกก็ตกไปเดาจาก size เหมือนเดิม", () => {
    expect(lineFromItem(item({ size: "1000 g" }))).toMatchObject({ packAmount: 1000, unit: "g" });
  });

  it("ไม่ระบุขนาดเลย = ของนับเป็นชิ้น", () => {
    expect(lineFromItem(item())).toMatchObject({ packAmount: 1, unit: "ชิ้น" });
  });

  it("ระบุขนาดแต่แกะไม่ออก = 0 (ยังไม่รู้) ไม่ใช่ 1 เงียบๆ", () => {
    // ตั้งเป็น 1 จะกลายเป็น "ใช้ 50 g = จ่ายราคาเต็ม 50 แพ็ค"
    expect(lineFromItem(item({ size: "ขวดกลาง" })).packAmount).toBe(0);
  });
});

describe("recipeTotals", () => {
  const r = recipe({
    lines: [{ id: "l", name: "น้ำมัน", buyPrice: 100, packAmount: 1000, unit: "g", usedAmount: 500 }],
    laborCost: 50,
    otherCost: 0,
  });

  it("ต้นทุนบรรทัด = ราคา ÷ ปริมาณต่อแพ็ค × ปริมาณที่ใช้", () => {
    expect(recipeTotals(r).materialCost).toBe(50);
    expect(recipeTotals(r).batchCost).toBe(100);
    expect(recipeTotals(r).perUnitCost).toBe(10);
  });

  it("ไม่ตั้งราคาขาย = ไม่คิดกำไรให้", () => {
    expect(recipeTotals(r).profitPerUnit).toBeNull();
  });
});

describe("productionSummary", () => {
  it("รวมรอบที่ทำและของที่ได้", () => {
    const r = recipe({
      lines: [{ id: "l", name: "น้ำมัน", buyPrice: 100, packAmount: 1000, unit: "g", usedAmount: 500 }],
      laborCost: 50,
      runs: [
        { id: "x", date: "2026-08-01", batches: 2, note: "" },
        { id: "y", date: "2026-08-20", batches: 1, note: "" },
      ],
    });
    expect(productionSummary(r)).toMatchObject({ batches: 3, units: 30, cost: 300, lastDate: "2026-08-20", times: 2 });
  });

  it("ยังไม่เคยทำ", () => {
    expect(productionSummary(recipe())).toMatchObject({ batches: 0, units: 0, cost: 0, lastDate: "", times: 0 });
  });
});

describe("pricing — คิดราคาขาย", () => {
  const settings = (over: Partial<PricingSettings> = {}): PricingSettings => ({
    targetMarginPct: 40, feePct: 0, feePerUnit: 0, rounding: "none", ...over,
  });

  it("คืน null เมื่อค่าธรรมเนียม + กำไรที่อยากได้ ≥ 100% (หารด้วยศูนย์/ติดลบ) ไม่เดาเลขให้", () => {
    expect(priceForMargin(100, 60, settings({ feePct: 40 }))).toBeNull();
    expect(priceForMargin(100, 80, settings({ feePct: 30 }))).toBeNull();
  });

  it("สูตร: ราคา = (ต้นทุน + ค่าส่งต่อชิ้น) ÷ (1 − ค่าธรรมเนียม% − กำไร%)", () => {
    expect(priceForMargin(50, 50, settings())).toBe(100);
    // กำไร % คิดจาก "ราคาขาย" (margin) ไม่ใช่ % ของต้นทุน (markup) — 50 ÷ (1−0.5) = 100
    expect(priceForMargin(50, 50, settings({ feePerUnit: 10 }))).toBe(120);
  });

  it("ปัดราคาขึ้นเสมอ กำไรจะได้ไม่หลุดเป้า", () => {
    expect(roundPrice(101, "10")).toBe(110);
    expect(roundPrice(101, "9")).toBeGreaterThanOrEqual(101);
    expect(roundPrice(101, "none")).toBe(101);
  });
});

describe("perUnitPrice", () => {
  it("ของที่ขายเป็นแพ็ค หารราคาต่อแพ็คด้วยจำนวนชิ้นในแพ็ค", () => {
    expect(perUnitPrice(item({ price: 90, packAmount: 100, unit: "ชิ้น" }))).toEqual({
      amount: 100,
      unit: "ชิ้น",
      perUnit: 0.9,
    });
  });

  it("ไม่ได้กรอก packAmount ก็เดาจากช่องขนาด — แต่ค่าที่กรอกเองมาก่อนเสมอ", () => {
    expect(perUnitPrice(item({ price: 90, size: "1000 g" }))).toEqual({ amount: 1000, unit: "g", perUnit: 0.09 });
    expect(perUnitPrice(item({ price: 90, size: "1000 g", packAmount: 250, unit: "ml" }))).toMatchObject({
      amount: 250,
      perUnit: 0.36,
    });
  });

  it("ไม่รู้ขนาดบรรจุ = คืน null ไม่เดาว่าแพ็คละ 1", () => {
    expect(perUnitPrice(item({ price: 90, size: "ขวดกลาง" }))).toBeNull();
  });

  it("แพ็คละ 1 หน่วย/ของนับชิ้น คืน null — ราคาต่อหน่วยเท่ากับราคาที่โชว์อยู่แล้ว", () => {
    expect(perUnitPrice(item({ price: 90 }))).toBeNull();
    expect(perUnitPrice(item({ price: 90, packAmount: 1, unit: "ชิ้น" }))).toBeNull();
  });

  it("ยังไม่ได้กรอกราคา = null แต่ราคา 0 (ของแถม) คิดได้ตามปกติ", () => {
    expect(perUnitPrice(item({ packAmount: 100 }))).toBeNull();
    expect(perUnitPrice(item({ price: 0, packAmount: 100 }))).toMatchObject({ perUnit: 0 });
  });
});

describe("totalPieces", () => {
  it("qty นับเป็นแพ็ค — คูณขนาดบรรจุออกมาเป็นจำนวนชิ้นจริง", () => {
    expect(totalPieces(item({ qty: 2, packAmount: 50, unit: "ชิ้น" }))).toMatchObject({
      pieces: 100,
      packs: 2,
      amount: 50,
      unit: "ชิ้น",
    });
  });

  it("เดาขนาดบรรจุจากช่องขนาดได้เหมือน perUnitPrice", () => {
    expect(totalPieces(item({ qty: 3, size: "10 ชิ้น" }))).toMatchObject({ pieces: 30, unit: "ชิ้น" });
  });

  it("นับเศษของแพ็คที่เปิดอยู่ด้วย", () => {
    expect(totalPieces(item({ qty: 2, openPct: 50, packAmount: 10, unit: "ชิ้น" }))).toMatchObject({ pieces: 15 });
  });

  it("หน่วยเป็นน้ำหนัก/ปริมาตร = null — 'รวม 2,000 g' ไม่ใช่คำตอบของ 'มีกี่ชิ้น'", () => {
    expect(totalPieces(item({ qty: 2, packAmount: 1000, unit: "g" }))).toBeNull();
    expect(totalPieces(item({ qty: 2, size: "500ml" }))).toBeNull();
  });

  it("ไม่รู้ขนาดบรรจุ/แพ็คละ 1 = null ไม่โชว์ตัวเลขซ้ำกับจำนวนแพ็ค", () => {
    expect(totalPieces(item({ qty: 2 }))).toBeNull();
    expect(totalPieces(item({ qty: 2, size: "ขวดกลาง" }))).toBeNull();
    expect(totalPieces(item({ qty: 2, packAmount: 1, unit: "ชิ้น" }))).toBeNull();
  });

  it("ของหมดแล้ว = null", () => {
    expect(totalPieces(item({ qty: 0, packAmount: 50, unit: "ชิ้น" }))).toBeNull();
  });
});

describe("bahtPerUnit", () => {
  it("ต่ำกว่าสตางค์ต้องไม่กลายเป็น ฿0 (อ่านแล้วนึกว่าฟรี)", () => {
    expect(bahtPerUnit(90 / 30000)).toContain("0.003");
    expect(bahtPerUnit(0.9)).toBe("฿0.9");
    expect(bahtPerUnit(0)).toBe("฿0");
  });
});

describe("stockDrift", () => {
  const line = (over: Partial<RecipeLine> = {}): RecipeLine => ({
    id: "l", itemId: "i", name: "x", buyPrice: 30, packAmount: 1000, unit: "g", usedAmount: 50, ...over,
  });

  it("ตรงกับสต็อก = null", () => {
    expect(stockDrift(line(), item({ price: 30, packAmount: 1000, unit: "g" }))).toBeNull();
    expect(stockDrift(line(), item({ price: 30, size: "1 kg" }))).toBeNull();
  });

  it("ไม่ได้ผูกกับสต็อก / หาสินค้าไม่เจอ = null", () => {
    expect(stockDrift(line({ itemId: undefined }), item({ price: 999 }))).toBeNull();
    expect(stockDrift(line(), undefined)).toBeNull();
  });

  it("กรอกขนาดแพ็คที่หน้าสินค้าทีหลัง — สูตรที่ยังไม่รู้ต้องเสนอเติมให้", () => {
    const d = stockDrift(line({ packAmount: 0, unit: "ชิ้น" }), item({ price: 30, packAmount: 1000, unit: "g" }));
    expect(d).toMatchObject({ packAmount: 1000, unit: "g", fillsUnknownPack: true });
    expect(driftNote(d!, line({ packAmount: 0, unit: "ชิ้น" }))).toContain("1,000 g");
  });

  it("ราคาเปลี่ยนหลังซื้อรอบใหม่", () => {
    const d = stockDrift(line(), item({ price: 45, packAmount: 1000, unit: "g" }));
    expect(d).toMatchObject({ buyPrice: 45, fillsUnknownPack: false });
    expect(d!.packAmount).toBeUndefined();
    expect(driftNote(d!, line())).toContain("฿45");
  });

  it("สต็อกยังไม่กรอกราคา = ไม่รู้ ห้ามลากราคาในสูตรลง 0", () => {
    expect(stockDrift(line(), item({ packAmount: 1000, unit: "g" }))).toBeNull();
  });

  it("สต็อกเดาขนาดแพ็คไม่ออก = ไม่นับว่าต่าง", () => {
    expect(stockDrift(line(), item({ price: 30, size: "ขวดกลาง" }))).toBeNull();
  });
});

describe("duplicateLineIds", () => {
  const dl = (id: string, over: Partial<RecipeLine> = {}) => ({ id, name: "", ...over });

  it("ผูกสินค้าชิ้นเดียวกัน = ตัวที่มาทีหลังคือตัวซ้ำ (ตัวแรกไม่ใช่)", () => {
    const dups = duplicateLineIds([dl("a", { itemId: "i1" }), dl("b", { itemId: "i2" }), dl("c", { itemId: "i1" })]);
    expect([...dups]).toEqual(["c"]);
  });

  it("ซ้ำสามบรรทัดก็เตือนทุกตัวที่เกินตัวแรก", () => {
    const dups = duplicateLineIds([dl("a", { itemId: "i1" }), dl("b", { itemId: "i1" }), dl("c", { itemId: "i1" })]);
    expect([...dups]).toEqual(["b", "c"]);
  });

  it("บรรทัดที่กรอกเองเทียบด้วยชื่อ ไม่สนช่องว่างหัวท้าย/ตัวพิมพ์", () => {
    const dups = duplicateLineIds([dl("a", { name: "ผงมุก" }), dl("b", { name: " ผงมุก " }), dl("c", { name: "Mica" }), dl("d", { name: "mica" })]);
    expect([...dups]).toEqual(["b", "d"]);
  });

  it("บรรทัดเปล่าหลายบรรทัด = กำลังกรอกอยู่ ไม่ใช่ซ้ำ", () => {
    expect(duplicateLineIds([dl("a"), dl("b"), dl("c")]).size).toBe(0);
  });

  it("ชื่อเดียวกันแต่ผูกคนละชิ้น = คนละของ (คนละร้าน/คนละสูตรผสม)", () => {
    const dups = duplicateLineIds([dl("a", { itemId: "i1", name: "กลีเซอรีน" }), dl("b", { itemId: "i2", name: "กลีเซอรีน" })]);
    expect(dups.size).toBe(0);
  });
});
