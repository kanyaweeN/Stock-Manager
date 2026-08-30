import type { PricePoint, StockItem } from "@/lib/types";

/** ปัดเงินเหลือทศนิยม 2 ตำแหน่ง — ราคาต่อชิ้นมักหารไม่ลงตัว (฿54 ÷ 3 ชิ้น = ฿18, แต่ ฿55 ÷ 3 = ฿18.33) */
export function roundBaht(n: number): number {
  return Math.round(n * 100) / 100;
}

export interface PriceStats {
  /** ราคาเฉลี่ยต่อ 1 แพ็ค/ชิ้น ถ่วงน้ำหนักด้วยจำนวนที่ซื้อแต่ละครั้ง (ไม่ใช่เฉลี่ยแบบนับครั้งเท่ากัน) */
  avg: number;
  min: number;
  max: number;
  /** ซื้อไปกี่ครั้ง */
  times: number;
  /** จำนวนแพ็ค/ชิ้นที่ซื้อรวมทุกครั้ง */
  totalQty: number;
  /** เงินที่จ่ายไปรวมทุกครั้ง */
  totalSpent: number;
  /** ราคาครั้งล่าสุด (จุดท้ายสุดของประวัติ) */
  latest: PricePoint;
}

/**
 * สรุปประวัติราคาของสินค้า 1 ชิ้น — คืน null ถ้ายังไม่มีประวัติ
 *
 * ค่าเฉลี่ยถ่วงน้ำหนักด้วยจำนวน เพราะซื้อ 10 ชิ้นตอนราคาถูกกับซื้อ 1 ชิ้นตอนราคาแพง
 * ไม่ควรมีน้ำหนักเท่ากัน (= เงินที่จ่ายไปทั้งหมด ÷ ของที่ได้มาทั้งหมด)
 */
export function priceStats(history?: PricePoint[]): PriceStats | null {
  const points = (history ?? []).filter((p) => typeof p?.price === "number" && Number.isFinite(p.price));
  if (points.length === 0) return null;

  let totalQty = 0;
  let totalSpent = 0;
  for (const p of points) {
    const qty = p.qty > 0 ? p.qty : 1;
    totalQty += qty;
    totalSpent += p.price * qty;
  }
  const prices = points.map((p) => p.price);

  return {
    avg: roundBaht(totalSpent / totalQty),
    min: Math.min(...prices),
    max: Math.max(...prices),
    times: points.length,
    totalQty,
    totalSpent: roundBaht(totalSpent),
    latest: points[points.length - 1],
  };
}

/** ราคาเฉลี่ยต่อชิ้น (null ถ้ายังไม่มีประวัติ) — ทางลัดของ `priceStats(...)?.avg` */
export function avgPrice(history?: PricePoint[]): number | null {
  return priceStats(history)?.avg ?? null;
}

/**
 * ต่อจุดราคาใหม่เข้าประวัติ แล้วเรียงตามวันที่ (จุดที่ไม่รู้วันที่ลอยไปอยู่ต้นสุด)
 * ไม่รวมจุดที่ซ้ำกันให้อัตโนมัติ — ซื้อของเดิมราคาเดิมสองครั้งในวันเดียวก็เป็นไปได้ ให้ผู้ใช้ลบเองใน ProductModal
 */
export function pushPricePoint(history: PricePoint[] | undefined, point: PricePoint): PricePoint[] {
  return [...(history ?? []), point].sort((a, b) => (a.date || "").localeCompare(b.date || ""));
}

// ─────────────────────────────────────────────────────────────
// ของที่ซื้อบ่อย
// ─────────────────────────────────────────────────────────────

/** ซื้อซ้ำกี่ครั้งขึ้นไปถึงนับว่า "ซื้อบ่อย" — ปรับที่นี่ที่เดียว (ชิปหน้าแรก + ป้ายบนการ์ด + ของที่เสนอเข้าแผน) */
export const FREQUENT_MIN_TIMES = 3;

/**
 * ซื้อของชิ้นนี้ไปกี่ครั้งแล้ว — นับจุดใน `priceHistory` (เพิ่มทุกครั้งที่นำเข้าออเดอร์ Shopee)
 *
 * ของเก่าที่ยังไม่มีประวัติราคาแต่รู้วันที่ซื้อ ถือว่าซื้อไป 1 ครั้ง — ไม่ใช่ 0
 * เพราะ `priceHistory` เพิ่งมีทีหลัง ของที่นำเข้าก่อนหน้านั้นจึงไม่มีจุดสักจุด
 */
export function buyTimes(item: Pick<StockItem, "priceHistory" | "purchasedAt">): number {
  const times = priceStats(item.priceHistory)?.times ?? 0;
  return times > 0 ? times : item.purchasedAt ? 1 : 0;
}

/** ซื้อบ่อยไหม — ใช้จำนวนครั้งที่ซื้อจริง ไม่เกี่ยวกับ `fav` (ปักดาวเอง) หรือ `status: "rebuy"` (ติดธงเอง) */
export function isFrequent(item: Pick<StockItem, "priceHistory" | "purchasedAt">): boolean {
  return buyTimes(item) >= FREQUENT_MIN_TIMES;
}
