/**
 * ประมาณว่า "ของจะหมดอีกกี่วัน" จากประวัติการใช้ — คำนวณล้วนๆ ไม่มี state
 * (เทียบเคียง lib/price.ts, lib/expiry.ts)
 *
 * ปัญหาเดิม: แอปรู้แค่ `qty` ตอนนี้ เลยเตือนได้อย่างเดียวว่า "ถึงขั้นต่ำแล้ว" ซึ่งสายไปแล้ว
 * `usageLog` จดว่าจำนวนเปลี่ยนวันไหนบ้าง เลยคิดอัตราการใช้ต่อวันย้อนหลังได้
 *
 * **ของที่ข้อมูลยังไม่พอ คืน `null` เสมอ = ไม่รู้ ไม่ใช่ "ยังอีกนาน"** — เดาจากจุดเดียว
 * หรือจากช่วงเวลาสั้นๆ จะได้ตัวเลขที่ผิดมากจนหลอกให้ตัดสินใจผิด ยอมไม่ตอบดีกว่า
 */
import { daysBetween, todayISO } from "./date";
import { isOutOfStock, remainingUnits } from "./stock";
import type { StockItem, UsagePoint } from "./types";

/** ต้องมีการ "ใช้" อย่างน้อยกี่วันที่ต่างกัน ถึงจะเริ่มคำนวณอัตรา (1 จุดบอกอัตราไม่ได้เลย) */
export const USAGE_MIN_POINTS = 2;
/** และช่วงเวลาที่สังเกตต้องกว้างอย่างน้อยกี่วัน — ใช้ 2 วันติดกันแล้วเหมาว่าใช้เท่านี้ทุกวันคือมั่ว */
export const USAGE_MIN_DAYS = 7;
/** เหลือไม่เกินกี่วันถึงเรียกว่า "กำลังจะหมด" — ปรับที่นี่ที่เดียว (ป้ายบนการ์ด + ของที่เสนอเข้าแผน) */
export const RUNOUT_SOON_DAYS = 14;
/** เก็บย้อนหลังไม่เกินกี่จุด — วันละจุด ≈ ครึ่งปี กันไม่ให้ไฟล์ที่ซิงก์ขึ้น Drive โตไม่มีที่สิ้นสุด */
export const USAGE_LOG_MAX = 180;

/**
 * จดการเปลี่ยนจำนวน 1 ครั้งลงประวัติ — **รวมเป็นวันละจุด**
 *
 * กด − ทีละครั้งหลายทีในวันเดียวเป็นเรื่องปกติมาก ถ้าเก็บแยกจุดประวัติจะบวมเร็วมาก
 * โดยไม่ได้ข้อมูลเพิ่ม (อัตราคิดเป็นรายวันอยู่แล้ว) — จุดที่หักล้างกันจนเหลือ 0 ถูกตัดทิ้ง
 */
export function pushUsage(log: UsagePoint[] | undefined, delta: number, date: string = todayISO()): UsagePoint[] {
  if (!delta) return log ?? [];
  const out = [...(log ?? [])];
  const last = out[out.length - 1];
  if (last && last.date === date) {
    const merged = last.delta + delta;
    if (merged === 0) out.pop();
    else out[out.length - 1] = { date, delta: merged };
  } else {
    out.push({ date, delta });
  }
  return out.length > USAGE_LOG_MAX ? out.slice(out.length - USAGE_LOG_MAX) : out;
}

export interface UsageStats {
  /** ใช้ไปวันละกี่ชิ้นโดยเฉลี่ย (มากกว่า 0 เสมอ) */
  perDay: number;
  /** คิดจากช่วงเวลากี่วัน */
  days: number;
  /** ใช้ไปรวมกี่ชิ้นในช่วงนั้น */
  used: number;
}

/**
 * อัตราการใช้ต่อวัน — `null` ถ้าข้อมูลยังไม่พอ (ดูค่าคงที่ด้านบน)
 *
 * นับเฉพาะจุดที่ `delta` ติดลบ (การใช้) การเติมของเข้าไม่เกี่ยว และ **ไม่นับจุดแรก**
 * เพราะจุดแรกคือจุดเริ่มจับเวลา ไม่ใช่การใช้ที่เกิด "ภายใน" ช่วงที่วัด — นับด้วยจะได้
 * อัตราสูงเกินจริง (ใช้ 3 ครั้งใน 2 ช่วงเวลา กลายเป็นหาร 3 ด้วยความยาวของ 2 ช่วง)
 */
export function usageStats(item: Pick<StockItem, "usageLog">): UsageStats | null {
  const spent = (item.usageLog ?? []).filter((p) => p.delta < 0 && /^\d{4}-\d{2}-\d{2}$/.test(p.date));
  if (spent.length < USAGE_MIN_POINTS) return null;

  const days = daysBetween(spent[0].date, spent[spent.length - 1].date);
  if (days == null || days < USAGE_MIN_DAYS) return null;

  const used = spent.slice(1).reduce((s, p) => s + -p.delta, 0);
  if (used <= 0) return null;

  return { perDay: used / days, days, used };
}

/** เหลือของพอใช้อีกกี่วัน — `null` = ยังไม่รู้ (ข้อมูลไม่พอ) หรือของหมดไปแล้ว */
export function daysUntilEmpty(item: Pick<StockItem, "qty" | "openPct" | "usageLog">): number | null {
  if (isOutOfStock(item)) return null;
  const stats = usageStats(item);
  if (!stats) return null;
  return Math.floor(remainingUnits(item) / stats.perDay);
}

/** กำลังจะหมดใน `RUNOUT_SOON_DAYS` วัน — คนละเรื่องกับ `isLow` ที่ดูแค่ `qty` เทียบ `min` */
export function runningOut(item: Pick<StockItem, "qty" | "openPct" | "usageLog">): boolean {
  const left = daysUntilEmpty(item);
  return left != null && left <= RUNOUT_SOON_DAYS;
}
