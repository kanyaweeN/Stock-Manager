import type { PricingSettings, Recipe, RecipeLine, StockItem } from "./types";
import { priceOutcome } from "./pricing";
import { remainingUnits } from "./stock";
import { uid } from "./uid";

/**
 * ต้นทุนของวัตถุดิบ 1 บรรทัด = ราคาต่อ 1 แพ็ค ÷ ปริมาณที่ได้ต่อ 1 แพ็ค × ปริมาณที่ใช้
 *
 * หมายเหตุเรื่อง "ซื้อหลายแพ็ค": `buyPrice` เป็นราคา **ต่อ 1 แพ็ค** (เหมือนช่องราคาในสต็อก)
 * ซื้อ 3 แพ็คจ่ายจริง ฿90 ก็จริง แต่ก็ได้ของ 3 เท่าเหมือนกัน ต้นทุนต่อหน่วยจึงเท่าเดิม
 * (฿30 ÷ 1000 g = ฿90 ÷ 3000 g) — จำนวนแพ็คที่ซื้อจึงไม่เข้ามาในสูตรนี้โดยตั้งใจ
 */
export function lineCost(line: RecipeLine): number {
  if (!line.packAmount || line.packAmount <= 0) return 0;
  return (line.buyPrice / line.packAmount) * line.usedAmount;
}

/** ปัญหาที่ทำให้บรรทัดนี้คิดต้นทุนไม่ได้ (หรือได้ค่าที่เชื่อไม่ได้) — เอาไปเตือนบน UI */
export function lineIssue(line: RecipeLine): string | null {
  if (!(line.packAmount > 0)) {
    return 'ยังไม่รู้ว่า 1 แพ็คได้ปริมาณเท่าไร — กรอกช่อง "ได้ปริมาณ" ก่อน ไม่งั้นบรรทัดนี้คิดเป็น ฿0';
  }
  if (!(line.buyPrice > 0)) return "ยังไม่ได้กรอกราคาที่ซื้อ (ต่อ 1 แพ็ค)";
  return null;
}

/** ตัวเลขปริมาณแบบอ่านง่าย — ตัด .00 ทิ้ง */
export function amountText(n: number): string {
  return (Math.round(n * 1000) / 1000).toLocaleString("th-TH", { maximumFractionDigits: 3 });
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
  /** ค่าธรรมเนียม/ค่าส่งที่โดนหักจากราคาขายต่อชิ้น (0 ถ้าไม่ได้ตั้งค่าไว้) */
  feePerUnit: number;
  /** กำไรต่อชิ้น หลังหักค่าธรรมเนียมแล้ว (ถ้ากรอกราคาขาย) */
  profitPerUnit: number | null;
  /** กำไรทั้งรอบ */
  profitPerBatch: number | null;
  /** อัตรากำไร % ของราคาขาย */
  marginPct: number | null;
}

/** ไม่มีค่าธรรมเนียม = คิดกำไรแบบตรงๆ (ราคาขาย − ต้นทุน) เหมือนก่อนมีหน้าคิดราคาขาย */
const NO_FEES: PricingSettings = { targetMarginPct: 0, feePct: 0, feePerUnit: 0, rounding: "none" };

/**
 * ส่ง `pricing` มาด้วยถ้าอยากให้กำไรหักค่าธรรมเนียมร้าน/ค่าส่งให้ (ดู lib/pricing.ts)
 * ไม่ส่ง = กำไรดิบ ราคาขาย − ต้นทุน
 */
export function recipeTotals(recipe: Recipe, pricing?: PricingSettings): RecipeTotals {
  const materialCost = recipe.lines.reduce((s, l) => s + lineCost(l), 0);
  const batchCost = materialCost + (recipe.laborCost || 0) + (recipe.otherCost || 0);
  const yieldQty = recipe.yieldQty > 0 ? recipe.yieldQty : 1;
  const perUnitCost = batchCost / yieldQty;
  const sell = recipe.sellPrice;
  const outcome =
    typeof sell === "number" && sell > 0 ? priceOutcome(sell, perUnitCost, pricing ?? NO_FEES) : null;
  return {
    materialCost,
    batchCost,
    perUnitCost,
    feePerUnit: outcome?.fee ?? 0,
    profitPerUnit: outcome ? outcome.profit : null,
    profitPerBatch: outcome ? outcome.profit * yieldQty : null,
    marginPct: outcome ? outcome.marginPct : null,
  };
}

export interface ProductionSummary {
  /** ทำไปแล้วกี่รอบสูตร (รวมทุกครั้ง) */
  batches: number;
  /** ได้ของออกมากี่ชิ้น = รอบ × yieldQty */
  units: number;
  /** ต้นทุนที่ลงไปแล้วทั้งหมด = รอบ × ต้นทุนต่อรอบ (คิดจากราคาวัตถุดิบ**ปัจจุบัน**) */
  cost: number;
  /** ครั้งล่าสุดทำเมื่อไร (`""` = ยังไม่เคยทำ/ไม่ทราบวันที่) */
  lastDate: string;
  /** บันทึกไว้กี่ครั้ง (คนละตัวกับ `batches` — 1 ครั้งทำหลายรอบได้) */
  times: number;
}

/**
 * สรุปว่าสูตรนี้ทำไปแล้วเท่าไร — **ต้นทุนคิดจากราคาวัตถุดิบปัจจุบัน ไม่ใช่ราคา ณ วันที่ทำ**
 *
 * สูตรเก็บแค่ราคาล่าสุดของวัตถุดิบ (`RecipeLine.buyPrice`) ไม่ได้ถ่ายรูปราคาไว้ตอนทำ
 * ตัวเลขนี้จึงเป็น "ถ้าทำเท่านี้ด้วยราคาวันนี้จะเป็นเงินเท่าไร" ไม่ใช่เงินที่จ่ายจริงย้อนหลัง
 */
export function productionSummary(recipe: Recipe, pricing?: PricingSettings): ProductionSummary {
  const runs = recipe.runs ?? [];
  const batches = runs.reduce((s, r) => s + (r.batches > 0 ? r.batches : 1), 0);
  const yieldQty = recipe.yieldQty > 0 ? recipe.yieldQty : 1;
  const dates = runs.map((r) => r.date).filter(Boolean).sort();
  return {
    batches,
    units: batches * yieldQty,
    cost: batches * recipeTotals(recipe, pricing).batchCost,
    lastDate: dates[dates.length - 1] || "",
    times: runs.length,
  };
}

/** แสดงเงินแบบไทย ทศนิยม 2 ตำแหน่ง (ตัด .00 ทิ้งถ้าเป็นจำนวนเต็ม) */
export function baht(n: number): string {
  const rounded = Math.round(n * 100) / 100;
  return `฿${rounded.toLocaleString("th-TH", { maximumFractionDigits: 2 })}`;
}

/**
 * เงินต่อ 1 หน่วยย่อย — ปัดแค่ 2 ตำแหน่งไม่พอ เพราะของที่บรรจุเยอะจะได้ "฿0"
 * ที่อ่านแล้วเข้าใจผิดว่าฟรี (฿90 ÷ 30,000 g = ฿0.003) ต่ำกว่าสตางค์เมื่อไรจึงโชว์เป็นเลขนัยสำคัญแทน
 */
export function bahtPerUnit(n: number): string {
  if (n > 0 && n < 0.01) return `฿${n.toLocaleString("th-TH", { maximumSignificantDigits: 2 })}`;
  return baht(n);
}

// ─────────────────────────────────────────────────────────────
// แกะขนาดบรรจุจากข้อความ `item.size`
// ─────────────────────────────────────────────────────────────

/** หน่วยที่แปลงเป็นหน่วยฐานได้ (น้ำหนัก → g, ปริมาตร → ml) */
const UNIT_TABLE: Record<string, { base: string; factor: number }> = {};
const addUnits = (base: string, factor: number, names: string[]) => {
  for (const nm of names) UNIT_TABLE[nm] = { base, factor };
};
addUnits("g", 1, ["g", "gram", "grams", "gm", "กรัม", "ก"]);
addUnits("g", 1000, ["kg", "kgs", "กก", "กิโล", "กิโลกรัม"]);
addUnits("g", 100, ["ขีด"]);
addUnits("g", 0.001, ["mg", "มก", "มิลลิกรัม"]);
addUnits("g", 28.3495, ["oz", "ออนซ์"]);
addUnits("g", 453.592, ["lb", "lbs", "ปอนด์"]);
addUnits("ml", 1, ["ml", "cc", "มล", "มิลลิลิตร", "ซีซี"]);
addUnits("ml", 1000, ["l", "ลิตร", "ล"]);

/** หน่วยนับชิ้น — ใช้เป็นปริมาณต่อแพ็คได้ตรงๆ ไม่ต้องแปลง */
const COUNT_UNITS = new Set([
  "ชิ้น", "อัน", "เม็ด", "ใบ", "แผ่น", "เส้น", "ลูก", "ดวง", "ชุด", "คู่",
  "ซอง", "ขวด", "หลอด", "ม้วน", "ก้อน", "pcs", "pc", "ea", "set",
]);

/** หน่วยความยาว = ขนาดมิติของตัวสินค้า (เช่น "10x15 ซม.") ไม่ใช่ปริมาณบรรจุ ห้ามเอามาหาร */
const LENGTH_UNITS = new Set([
  "cm", "ซม", "เซนติเมตร", "mm", "มม", "มิลลิเมตร", "m", "เมตร", "นิ้ว", "inch", "in", "ft",
]);

const unitKey = (u: string) => u.trim().toLowerCase().replace(/\.+$/, "");

/**
 * แกะขนาดบรรจุจากข้อความ field `size` ของสินค้า เช่น "500 g", "30ml", "1 กก.", "500ml x2"
 * แปลงเป็นหน่วยฐานให้เลย (1 กก. → 1000 g) จะได้กรอก "ใช้ไป" เป็นกรัม/มล. ตามที่ชั่งจริงได้
 *
 * คืน null ถ้าอ่านไม่ออก (เช่น "S, M, L", "10x15 ซม.", "500" เฉยๆ ไม่บอกหน่วย)
 * — ตรงนี้สำคัญ: เดาผิดแล้วเอาไปเป็น "ตัวหาร" ต้นทุนจะเพี้ยนแบบเงียบๆ สู้ให้ผู้ใช้กรอกเองดีกว่า
 */
export function parsePackSize(size?: string): { amount: number; unit: string } | null {
  if (!size) return null;
  const s = size.replace(/(\d),(\d)/g, "$1$2").trim().toLowerCase();
  if (!s) return null;

  let found: { amount: number; unit: string } | null = null;
  for (const m of s.matchAll(/(\d+(?:\.\d+)?)\s*([a-z฀-๿]+\.?)?/g)) {
    const amount = Number(m[1]);
    if (!Number.isFinite(amount) || amount <= 0) continue;
    const key = unitKey(m[2] ?? "");
    if (LENGTH_UNITS.has(key)) return null; // เจอหน่วยความยาว = เป็นขนาดมิติทั้งข้อความ
    if (found) continue; // เอาตัวแรกที่อ่านออกพอ แต่ยังวนต่อเผื่อเจอหน่วยความยาวทีหลัง
    const conv = UNIT_TABLE[key];
    if (conv) found = { amount: amount * conv.factor, unit: conv.base };
    else if (COUNT_UNITS.has(key)) found = { amount, unit: key };
  }
  if (!found) return null;

  // แพ็คคู่/แพ็คสาม เช่น "500ml x2" หรือ "2x500ml" = ได้ 1000 ml ต่อการซื้อ 1 ครั้ง
  const mult =
    s.match(/[x×]\s*(\d+)\s*(?:แพ็?ค|ห่อ|ถุง|ขวด|ชิ้น|pack|packs)?\s*$/) ||
    s.match(/^(\d+)\s*[x×]\s*(?=\d)/);
  const times = mult ? Number(mult[1]) : 1;
  if (times > 1 && times <= 100) found = { ...found, amount: found.amount * times };

  return found;
}

export interface PackSize {
  /** 1 แพ็คได้กี่หน่วยย่อย */
  amount: number;
  /** หน่วยย่อย เช่น g, ml, ชิ้น */
  unit: string;
}

type PackSource = Pick<StockItem, "packAmount" | "unit" | "size">;

/**
 * ขนาดบรรจุของสินค้า 1 แพ็ค — ค่าที่กรอกเอง (`packAmount`/`unit`) มาก่อนการเดาจากข้อความ `size` เสมอ
 * คืน null = **ยังไม่รู้** ไม่ใช่ "แพ็คละ 1" — ตัวหารที่เดาผิดทำให้ต้นทุน/ราคาต่อหน่วยเพี้ยนแบบเงียบๆ
 */
export function packOf(item: PackSource): PackSize | null {
  if (item.packAmount && item.packAmount > 0) {
    return { amount: item.packAmount, unit: item.unit?.trim() || "ชิ้น" };
  }
  return parsePackSize(item.size);
}

export interface PerUnitPrice extends PackSize {
  /** ราคาต่อ 1 หน่วยย่อย (ถุงซิปแพ็ค 100 ชิ้น ราคา ฿90 ⇒ ฿0.9 ต่อชิ้น) */
  perUnit: number;
}

/**
 * ราคาต่อ "ชิ้นย่อย" ของสินค้าในสต็อก
 *
 * `item.price` เป็นราคา **ต่อ 1 แพ็ค** เสมอ (เหมือนที่ `qty` นับเป็นแพ็ค) ของที่ 1 แพ็คมีหลายชิ้น
 * จึงเอาราคาบนการ์ดไปเทียบร้านที่ขายแยกชิ้นไม่ได้ ต้องหารด้วยขนาดบรรจุก่อน
 *
 * คืน null เมื่อไม่รู้ขนาดบรรจุ หรือแพ็คละ 1 หน่วย (ราคาต่อหน่วย = ราคาที่โชว์อยู่แล้ว ไม่ต้องโชว์ซ้ำ)
 */
export function perUnitPrice(item: PackSource & Pick<StockItem, "price">): PerUnitPrice | null {
  if (item.price == null || !Number.isFinite(item.price)) return null;
  const pack = packOf(item);
  if (!pack || pack.amount <= 1) return null;
  return { ...pack, perUnit: item.price / pack.amount };
}

export interface PieceCount extends PackSize {
  /** เหลือกี่ชิ้นย่อยจริงๆ — รวมเศษของแพ็คที่เปิดอยู่แล้ว (`amount` คือชิ้นย่อยต่อ 1 แพ็ค) */
  pieces: number;
  /** เหลือกี่แพ็ค (= `remainingUnits`) — เก็บไว้ให้ UI อธิบายที่มาของตัวเลขได้โดยไม่ต้องคิดซ้ำ */
  packs: number;
}

/**
 * "ของชิ้นนี้เหลือกี่ชิ้น" — `qty` นับเป็น**แพ็ค** กล่องละ 50 ชิ้นเหลือ 2 กล่องคือ 100 ชิ้น
 * ซึ่งเป็นตัวเลขที่ผู้ใช้อยากรู้จริงๆ เวลาถามว่า "ของเหลือพอไหม"
 *
 * คืน null = **ตอบไม่ได้/ไม่ต้องตอบ** ห้ามเดาเป็น `qty`:
 * - ไม่รู้ขนาดบรรจุ (ไม่ได้กรอก `packAmount` และเดาจาก `size` ไม่ออก)
 * - แพ็คละ 1 หน่วย — จำนวนชิ้น = จำนวนแพ็คอยู่แล้ว โชว์ซ้ำเปล่าๆ
 * - หน่วยย่อยเป็นน้ำหนัก/ปริมาตร (g, ml) — "รวม 2,000 g" ไม่ใช่คำตอบของ "มีกี่ชิ้น"
 * - ของหมด (เหลือ 0 แพ็ค) — 0 ชิ้นก็คือ 0 ที่โชว์อยู่แล้ว
 */
export function totalPieces(
  item: PackSource & Pick<StockItem, "qty" | "openPct">,
): PieceCount | null {
  const pack = packOf(item);
  if (!pack || pack.amount <= 1) return null;
  if (!COUNT_UNITS.has(unitKey(pack.unit))) return null;
  const packs = remainingUnits(item);
  if (packs <= 0) return null;
  return { ...pack, packs, pieces: packs * pack.amount };
}

/**
 * สร้างบรรทัดวัตถุดิบจากสินค้าในสต็อก — ดึงราคา/ขนาดบรรจุมาให้อัตโนมัติ
 *
 * ใช้ `item.packAmount`/`item.unit` ที่กรอกไว้ตรงๆ ก่อนเสมอ แล้วค่อยตกไปเดาจากข้อความ
 * `item.size` ด้วย `parsePackSize` — ค่าที่ผู้ใช้กรอกเองย่อมแม่นกว่าการแกะสตริง และ
 * ของที่เขียนขนาดไม่เป็นแพตเทิร์น ("ขวดกลาง") เดายังไงก็ไม่ออก
 *
 * ถ้าไม่รู้จริงๆ จะตั้ง packAmount = 0 (= ยังไม่รู้) แล้วให้ UI เตือนให้กรอกเอง
 * ไม่ตั้งเป็น 1 เงียบๆ เพราะจะกลายเป็น "ใช้ 50 g = จ่ายราคาเต็ม 50 แพ็ค"
 */
export function lineFromItem(item: StockItem): RecipeLine {
  const pack = packOf(item);
  const countable = !item.packAmount && !item.size?.trim(); // ไม่ได้ระบุขนาดไว้เลย = ของนับเป็นชิ้น
  return {
    id: uid(),
    itemId: item.id,
    name: item.name,
    buyPrice: item.price ?? 0,
    packAmount: pack?.amount ?? (countable ? 1 : 0),
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
