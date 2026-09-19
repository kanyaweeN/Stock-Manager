/**
 * คำถามพื้นฐานเกี่ยวกับ "ของ 1 ชิ้น" — เหลือเท่าไร ใกล้หมดหรือยัง นับเป็นกี่หน่วย
 *
 * คำนวณล้วนๆ ไม่มี state และ**ไม่พึ่งโมดูลอื่นเลย** จึงเป็นชั้นล่างสุดที่ทุกอย่างเรียกได้
 * โดยไม่เกิด import วน (lib/domain/usage.ts, lib/domain/plan.ts, lib/domain/summary.ts เรียกที่นี่ ไม่ใช่ทางกลับ)
 *
 * เกณฑ์พวกนี้เคยกระจายอยู่ 3 ที่: `isLow` ประกาศไว้ในไฟล์ฮุก `useProductFilters`,
 * `ProductGrid` เขียนเงื่อนไขเดียวกันซ้ำในตัวเอง และ `suggestForPlan` เขียนซ้ำอีกที
 * — แก้เกณฑ์ทีต้องไล่แก้ 3 จุดและพลาดง่าย ตอนนี้รวมมาไว้ที่เดียว
 */
import type { StockItem } from "@/lib/types";

/** ของหมด = ไม่เหลือสักชิ้น (คนละเรื่องกับ "ใกล้หมด") */
export function isOutOfStock(item: Pick<StockItem, "qty">): boolean {
  return item.qty <= 0;
}

/**
 * ใกล้หมด = ยังมีของอยู่ แต่เหลือไม่เกินขั้นต่ำที่ตั้งไว้
 *
 * `min = 0` แปลว่า "ไม่ได้ตั้งเตือน" ไม่ใช่ "เตือนเมื่อเหลือ 0" — ของที่ไม่ได้ตั้งขั้นต่ำ
 * จึงไม่มีวันนับเป็นใกล้หมด (ของหมดจริงๆ ไปเข้าเงื่อนไข `isOutOfStock` แทน)
 */
export function isLow(item: Pick<StockItem, "qty" | "min">): boolean {
  return item.qty > 0 && item.min > 0 && item.qty <= item.min;
}

/**
 * ของที่เหลือจริงคิดเป็นกี่แพ็ค — รวม "เศษของขวดที่เปิดอยู่" (`openPct`) เข้าไปด้วย
 *
 * `qty` นับแพ็คเต็มๆ เท่านั้น ขวดที่ใช้ไปครึ่งนึงยังนับเป็น 1 เท่าขวดใหม่ ซึ่งทำให้
 * มูลค่าสต็อกกับการทำนายวันหมดสูงเกินจริง — ขวดที่เปิดอยู่ถือว่ามี 1 ขวดเสมอ (ขวดล่าสุด)
 * ที่เหลือจึงเป็น `qty − 1` ขวดเต็ม บวกเศษของขวดที่เปิด
 *
 * ไม่กรอก `openPct` = ถือว่าเต็มทุกขวด (คืน `qty` ตรงๆ) จะได้ไม่เปลี่ยนพฤติกรรมเดิม
 */
export function remainingUnits(item: Pick<StockItem, "qty" | "openPct">): number {
  if (item.openPct == null || item.qty <= 0) return item.qty;
  return item.qty - 1 + Math.min(100, Math.max(0, item.openPct)) / 100;
}

export interface PieceAdjustment {
  qty: number;
  openPct?: number;
  /** เปลี่ยนแปลงจริงเป็นแพ็ค (ติดลบ = ใช้ไป) — เอาไปจดลง `usageLog` ผ่าน `pushUsage` */
  packDelta: number;
}

/**
 * ปรับจำนวนที่เหลือ **ทีละชิ้นย่อย** ของของที่ขายยกแพ็ค — ตอบโจทย์ "แพ็คละ 10 ชิ้น ใช้ไป 1 ชิ้น เหลือ 9 ชิ้น"
 *
 * ผู้ใช้อยากลด/เพิ่มทีละชิ้น (ที่เห็นบนการ์ด) ไม่ใช่ทีละแพ็ค — แต่โครงข้อมูลเก็บเป็นแพ็คเต็ม (`qty`)
 * + เศษของแพ็คที่เปิดอยู่ (`openPct`) เท่านั้น ตัวนี้เป็นตัวแปลง: รับจำนวนชิ้นที่จะลด/เพิ่ม
 * แล้วคืนค่า `qty`/`openPct` ใหม่ให้เข้ากับโครงเดิม พร้อม `packDelta` (การใช้จริงเป็นแพ็ค)
 * ที่เอาไปจดลง `usageLog` ต่อได้เลย
 *
 * `openPct` เก็บเป็น**ทศนิยม**ตามที่ `normalizeItem` ยอมรับ — ปัดเป็นจำนวนเต็มไม่ได้ ไม่งั้น
 * กด −1 ชิ้นซ้ำๆ กับแพ็คขนาด 3 จะเพี้ยนสะสม (33.33% ปัดเป็น 33% → 3×0.33 = 0.99 → 0)
 * ทำให้ 3 ชิ้นสุดท้ายหายไป 1 ชิ้นเงียบๆ
 */
export function applyPieceDelta(
  item: Pick<StockItem, "qty" | "openPct">,
  deltaPieces: number,
  packAmount: number,
): PieceAdjustment {
  if (packAmount <= 0 || !Number.isFinite(deltaPieces) || deltaPieces === 0) {
    return { qty: item.qty, openPct: item.openPct, packDelta: 0 };
  }
  const currentPacks = remainingUnits(item);
  const currentPieces = currentPacks * packAmount;
  const nextPieces = Math.max(0, currentPieces + deltaPieces);
  const packDelta = (nextPieces - currentPieces) / packAmount;
  if (packDelta === 0) return { qty: item.qty, openPct: item.openPct, packDelta: 0 };
  if (nextPieces <= 0) return { qty: 0, openPct: undefined, packDelta };
  const nextPacks = nextPieces / packAmount;
  const wholePacks = Math.floor(nextPacks);
  const fraction = nextPacks - wholePacks;
  // แพ็คเต็มพอดี = ไม่มีขวดที่เปิดค้าง ล้าง openPct ทิ้ง (เทียบ ≈ 0 กัน float rounding)
  if (fraction <= 1e-9) return { qty: wholePacks, openPct: undefined, packDelta };
  return { qty: wholePacks + 1, openPct: fraction * 100, packDelta };
}

/** นับจำนวน "หน่วย" ของสินค้า — สินค้าที่ถูกจัดกลุ่มไว้ (groupId เดียวกัน) นับรวมเป็น 1 หน่วยแทนที่จะนับแยกทีละชิ้น */
export function countUnits(items: StockItem[]): number {
  const groupIds = new Set(items.filter((i) => i.groupId).map((i) => i.groupId));
  const ungroupedCount = items.filter((i) => !i.groupId).length;
  return ungroupedCount + groupIds.size;
}
