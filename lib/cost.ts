import type { Recipe, RecipeLine, StockItem } from "./types";
import { uid } from "./uid";

/** ต้นทุนของวัตถุดิบ 1 บรรทัด = ราคาที่ซื้อ ÷ ปริมาณต่อแพ็ค × ปริมาณที่ใช้ */
export function lineCost(line: RecipeLine): number {
  if (!line.packAmount || line.packAmount <= 0) return 0;
  return (line.buyPrice / line.packAmount) * line.usedAmount;
}

/** ต้นทุนต่อ 1 หน่วยย่อย (เช่น บาท/กรัม) — ใช้โชว์ให้เห็นว่าของชิ้นนี้ตกหน่วยละเท่าไร */
export function unitCost(line: RecipeLine): number {
  if (!line.packAmount || line.packAmount <= 0) return 0;
  return line.buyPrice / line.packAmount;
}

export interface RecipeTotals {
  materialCost: number;
  /** ต้นทุนรวมต่อการทำ 1 รอบ (วัตถุดิบ + ค่าแรง + อื่นๆ) */
  batchCost: number;
  /** ต้นทุนต่อชิ้น */
  perUnitCost: number;
  /** กำไรต่อชิ้น (ถ้ากรอกราคาขาย) */
  profitPerUnit: number | null;
  /** กำไรทั้งรอบ */
  profitPerBatch: number | null;
  /** อัตรากำไร % ของราคาขาย */
  marginPct: number | null;
}

export function recipeTotals(recipe: Recipe): RecipeTotals {
  const materialCost = recipe.lines.reduce((s, l) => s + lineCost(l), 0);
  const batchCost = materialCost + (recipe.laborCost || 0) + (recipe.otherCost || 0);
  const yieldQty = recipe.yieldQty > 0 ? recipe.yieldQty : 1;
  const perUnitCost = batchCost / yieldQty;
  const sell = recipe.sellPrice;
  const hasSell = typeof sell === "number" && sell > 0;
  return {
    materialCost,
    batchCost,
    perUnitCost,
    profitPerUnit: hasSell ? sell - perUnitCost : null,
    profitPerBatch: hasSell ? (sell - perUnitCost) * yieldQty : null,
    marginPct: hasSell ? ((sell - perUnitCost) / sell) * 100 : null,
  };
}

/** แสดงเงินแบบไทย ทศนิยม 2 ตำแหน่ง (ตัด .00 ทิ้งถ้าเป็นจำนวนเต็ม) */
export function baht(n: number): string {
  const rounded = Math.round(n * 100) / 100;
  return `฿${rounded.toLocaleString("th-TH", { maximumFractionDigits: 2 })}`;
}

/**
 * แกะขนาดบรรจุจากข้อความ field `size` ของสินค้า เช่น "500 g", "30ml", "1 กก."
 * คืน null ถ้าอ่านไม่ออก (เช่น "S, M, L") — ให้ผู้ใช้กรอกเอง
 */
export function parsePackSize(size?: string): { amount: number; unit: string } | null {
  if (!size) return null;
  const m = size.trim().match(/^(\d+(?:[.,]\d+)?)\s*([A-Za-z฀-๿.]*)/);
  if (!m) return null;
  const amount = Number(m[1].replace(",", "."));
  if (!Number.isFinite(amount) || amount <= 0) return null;
  return { amount, unit: m[2] || "ชิ้น" };
}

/** สร้างบรรทัดวัตถุดิบจากสินค้าในสต็อก — ดึงราคา/ขนาดบรรจุมาให้อัตโนมัติ */
export function lineFromItem(item: StockItem): RecipeLine {
  const pack = parsePackSize(item.size);
  return {
    id: uid(),
    itemId: item.id,
    name: item.name,
    buyPrice: item.price ?? 0,
    packAmount: pack?.amount ?? 1,
    unit: pack?.unit ?? "ชิ้น",
    usedAmount: 0,
  };
}

export function emptyLine(): RecipeLine {
  return { id: uid(), name: "", buyPrice: 0, packAmount: 1, unit: "ชิ้น", usedAmount: 0 };
}

export function emptyRecipe(): Recipe {
  return {
    id: uid(),
    name: "",
    note: "",
    lines: [],
    yieldQty: 1,
    yieldUnit: "ชิ้น",
    laborCost: 0,
    otherCost: 0,
    sellPrice: undefined,
  };
}
