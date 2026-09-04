/**
 * คาดคะเนว่า "ควรซื้ออีกทีเมื่อไร" จาก **ช่วงห่างของประวัติการซื้อ** (`priceHistory[].date`)
 *
 * ต่างจาก `lib/domain/usage.ts` ตรงที่ `usageStats` ต้องมี `usageLog` (ผู้ใช้กด +/− บนการ์ด)
 * แต่ของอย่างอาหารสัตว์/ของใช้ที่ไม่มีใครมานั่งกดทุกวัน จะไม่มี `usageLog` เลย
 * ตัวนี้อาศัยแค่ว่า "ซื้อเมื่อไร ซื้อกี่ชิ้น" ซึ่งมีอยู่แล้วทุกออเดอร์ที่นำเข้า
 *
 * **ของที่ยังซื้อไม่ถึง 2 ครั้ง (ไม่มี interval สักช่วง) คืน `null` = ไม่รู้ ไม่ใช่ "อีกนาน"**
 * — เดาจากครั้งเดียวไม่ได้เลย
 */
import { daysUntil, todayISO } from "@/lib/core/date";
import type { PricePoint, StockItem } from "@/lib/types";

/** ต้องมีอย่างน้อยกี่ครั้งถึงเริ่มคำนวณ (2 ครั้ง = 1 interval) */
export const REPURCHASE_MIN_PURCHASES = 2;
/** ถึงกี่ครั้งขึ้นไปถือว่าข้อมูล "พอเชื่อได้" */
export const REPURCHASE_OK_PURCHASES = 3;
/** ความแปรปรวน (stdev / mean) เกินเท่าไรถือว่าไม่ค่อยแน่นอน */
export const REPURCHASE_OK_CV = 0.5;

export interface RepurchaseStats {
  /** จำนวนครั้งที่ซื้อทั้งหมด (จุดใน `priceHistory` ที่มีวันที่) */
  purchases: number;
  /** ช่วงห่างต่อ 1 แพ็ค เป็นวัน — ยาว = ใช้นานกว่าจะซื้อใหม่ */
  daysPerPack: number;
  /** วันซื้อครั้งล่าสุด (YYYY-MM-DD) */
  lastDate: string;
  /** จำนวนที่ซื้อครั้งล่าสุด — ใช้ทำนายว่าครั้งนี้จะพอใช้กี่วัน */
  lastQty: number;
  /** วันที่คาดว่าจะต้องซื้ออีก = `lastDate` + (`lastQty` × `daysPerPack`) */
  nextDate: string;
  /** เหลือกี่วันถึงวันที่คาด — ติดลบ = เลยกำหนดมาแล้ว */
  daysUntilNext: number;
  /** `"ok"` = มี ≥ 3 ครั้ง และช่วงห่างสม่ำเสมอ · `"low"` = มีแค่ 2 ครั้ง หรือแกว่งมาก */
  confidence: "low" | "ok";
}

/**
 * เอาจุดราคาที่มีวันที่จริง (YYYY-MM-DD) มาเรียงเก่า→ใหม่
 * จุดที่ไม่มีวันที่คำนวณช่วงห่างไม่ได้ ตัดทิ้งเงียบๆ (ไม่ใช่ error)
 */
function datedPoints(history: PricePoint[] | undefined): PricePoint[] {
  return (history ?? [])
    .filter((p) => /^\d{4}-\d{2}-\d{2}$/.test(p.date))
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * คำนวณคาดคะเนวันซื้อถัดไป — คืน `null` ถ้าข้อมูลยังไม่พอ
 *
 * โมเดล: interval แต่ละช่วง = ระยะเวลาที่ของครั้งก่อน "อยู่ได้" ก่อนต้องซื้อใหม่
 * ดังนั้น days-per-pack ของช่วงนั้น = `interval / qtyเริ่มช่วง` (ซื้อ 2 แพ็คแล้วอยู่ได้ 60 วัน = 30 วัน/แพ็ค)
 * ถ่วงน้ำหนักด้วย `qty` ของช่วงนั้นตอนหาค่าเฉลี่ย เพราะช่วงที่ซื้อเยอะให้สัญญาณอัตราการใช้ที่แรงกว่า
 */
export function repurchaseStats(
  item: Pick<StockItem, "priceHistory">,
  now: Date = new Date(),
): RepurchaseStats | null {
  const points = datedPoints(item.priceHistory);
  if (points.length < REPURCHASE_MIN_PURCHASES) return null;

  const perPack: number[] = [];
  const weights: number[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const prev = points[i];
    const next = points[i + 1];
    const gap = daysBetweenISO(prev.date, next.date);
    if (gap == null || gap <= 0) continue;
    const qty = prev.qty > 0 ? prev.qty : 1;
    perPack.push(gap / qty);
    weights.push(qty);
  }
  if (perPack.length === 0) return null;

  const totalWeight = weights.reduce((s, w) => s + w, 0);
  const daysPerPack = perPack.reduce((s, v, i) => s + v * weights[i], 0) / totalWeight;
  if (!Number.isFinite(daysPerPack) || daysPerPack <= 0) return null;

  const last = points[points.length - 1];
  const lastQty = last.qty > 0 ? last.qty : 1;
  const nextDate = addDaysISO(last.date, Math.round(daysPerPack * lastQty));

  // stdev แบบไม่ถ่วงน้ำหนัก — แค่ประเมินความแกว่ง ไม่ต้องแม่นระดับสถิติ
  const mean = perPack.reduce((s, v) => s + v, 0) / perPack.length;
  const variance = perPack.reduce((s, v) => s + (v - mean) ** 2, 0) / perPack.length;
  const stdev = Math.sqrt(variance);
  const cv = mean > 0 ? stdev / mean : Infinity;
  const confidence: "low" | "ok" =
    points.length >= REPURCHASE_OK_PURCHASES && cv <= REPURCHASE_OK_CV ? "ok" : "low";

  return {
    purchases: points.length,
    daysPerPack,
    lastDate: last.date,
    lastQty,
    nextDate,
    daysUntilNext: daysUntil(nextDate, now) ?? 0,
    confidence,
  };
}

/** เรียงสินค้าตาม "ควรซื้อก่อน" — เลยกำหนดมากสุดมาก่อน, ของที่ไม่รู้ตกท้าย */
export function sortByDueSoonest<T extends { id: string }>(
  items: T[],
  statsById: Map<string, RepurchaseStats | null>,
): T[] {
  return items.slice().sort((a, b) => {
    const sa = statsById.get(a.id);
    const sb = statsById.get(b.id);
    if (!sa && !sb) return 0;
    if (!sa) return 1;
    if (!sb) return -1;
    return sa.daysUntilNext - sb.daysUntilNext;
  });
}

// ─────────────────────────────────────────────────────────────
// helper — ใช้ในไฟล์นี้เท่านั้น
// ─────────────────────────────────────────────────────────────

function daysBetweenISO(fromISO: string, toISO: string): number | null {
  const a = fromISO.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const b = toISO.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!a || !b) return null;
  const from = new Date(Number(a[1]), Number(a[2]) - 1, Number(a[3]));
  const to = new Date(Number(b[1]), Number(b[2]) - 1, Number(b[3]));
  return Math.round((to.getTime() - from.getTime()) / 86400000);
}

function addDaysISO(iso: string, days: number): string {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return iso;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  d.setDate(d.getDate() + days);
  return todayISO(d);
}
