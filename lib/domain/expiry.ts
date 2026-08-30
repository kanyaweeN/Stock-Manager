/**
 * วันหมดอายุของสินค้า — คำนวณล้วนๆ ไม่มี state (เทียบเคียง lib/domain/price.ts, lib/domain/plan.ts)
 *
 * ของในสต็อกนี้ส่วนใหญ่เป็นสกินแคร์/เครื่องสำอาง ซึ่งหมดอายุได้ 2 ทางและมักไม่ตรงกัน
 *
 * 1. **วันหมดอายุตามฉลาก** (`expiryAt`) — ใช้ได้ตราบใดที่ยังไม่แกะ
 * 2. **เปิดแล้วใช้ได้กี่เดือน** (PAO — รูปกระปุกเปิดฝาที่เขียน `6M`/`12M` ข้างขวด) นับจาก
 *    วันที่เปิด (`openedAt` + `paoMonths`) ซึ่ง**สั้นกว่าฉลากได้มาก** ถ้าเปิดขวดทิ้งไว้นาน
 *
 * วันที่ใช้จริงจึงเป็น **ตัวที่มาถึงก่อน** ระหว่างสองทางนี้ (ดู `effectiveExpiry`)
 * ของที่ไม่ได้กรอกอะไรเลยคืน `null` = ไม่รู้ ไม่ใช่ "ยังไม่หมดอายุ" — อย่าเอาไปนับรวมกับของที่ปลอดภัย
 */
import { daysUntil, todayISO } from "@/lib/core/date";
import type { StockItem } from "@/lib/types";

/** เหลือไม่เกินกี่วันถึงเรียกว่า "ใกล้หมดอายุ" — ปรับที่นี่ที่เดียว (ชิปหน้าแรก + ป้ายบนการ์ด) */
export const EXPIRY_SOON_DAYS = 60;

export type ExpirySource = "label" | "pao";

export interface ExpiryInfo {
  /** วันหมดอายุที่ใช้จริง (YYYY-MM-DD) = ตัวที่มาถึงก่อนระหว่างฉลากกับ PAO */
  date: string;
  /** มาจากไหน — `"label"` = วันหมดอายุบนฉลาก, `"pao"` = นับจากวันที่เปิดใช้ */
  source: ExpirySource;
  /** เหลืออีกกี่วัน (ติดลบ = หมดอายุไปแล้ว) */
  daysLeft: number;
  /** หมดอายุไปแล้ว */
  expired: boolean;
  /** ใกล้หมดอายุ (ยังไม่หมด แต่เหลือไม่เกิน `EXPIRY_SOON_DAYS` วัน) */
  soon: boolean;
}

type ExpiryFields = Pick<StockItem, "expiryAt" | "openedAt" | "paoMonths">;

/**
 * `openedAt` + `paoMonths` → วันหมดอายุหลังเปิด (YYYY-MM-DD)
 *
 * `setMonth` ของ JS เลื่อนเดือนแบบล้นวันได้ (31 ม.ค. + 1 เดือน = 3 มี.ค. เพราะไม่มี 31 ก.พ.)
 * ซึ่งเป็นการ**ยืดอายุ**ให้ยาวกว่าจริง จึงหนีบกลับมาเป็นวันสุดท้ายของเดือนปลายทางแทน
 */
export function paoExpiry(openedAt?: string, paoMonths?: number): string | null {
  const m = (openedAt || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m || !paoMonths || !Number.isFinite(paoMonths) || paoMonths <= 0) return null;
  const [, y, mm, dd] = m;
  const day = Number(dd);
  const target = new Date(Number(y), Number(mm) - 1 + Math.round(paoMonths), 1);
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  target.setDate(Math.min(day, lastDay));
  return todayISO(target);
}

/** วันหมดอายุที่ใช้จริงพร้อมสถานะ — `null` = ไม่ได้กรอกข้อมูลไว้เลย (ไม่ใช่ "ยังไม่หมดอายุ") */
export function effectiveExpiry(item: ExpiryFields, now: Date = new Date()): ExpiryInfo | null {
  const label = /^\d{4}-\d{2}-\d{2}$/.test(item.expiryAt || "") ? item.expiryAt! : null;
  const pao = paoExpiry(item.openedAt, item.paoMonths);
  // เปิดขวดแล้วอายุมักสั้นกว่าที่ฉลากบอก — ตัวที่มาถึงก่อนคือตัวที่ต้องเตือน
  const date = label && pao ? (label <= pao ? label : pao) : (label ?? pao);
  if (!date) return null;
  const source: ExpirySource = date === label ? "label" : "pao";
  const daysLeft = daysUntil(date, now);
  if (daysLeft == null) return null;
  return { date, source, daysLeft, expired: daysLeft < 0, soon: daysLeft >= 0 && daysLeft <= EXPIRY_SOON_DAYS };
}

/** ต้องรีบใช้/ทิ้งไหม — หมดอายุแล้วหรือใกล้หมด (ตัวเดียวกับที่ชิป "⏰ ใกล้หมดอายุ" ใช้กรอง) */
export function needsAttention(item: ExpiryFields, now: Date = new Date()): boolean {
  const info = effectiveExpiry(item, now);
  return !!info && (info.expired || info.soon);
}

/** ข้อความสั้นๆ สำหรับป้ายบนการ์ด เช่น "หมดอายุแล้ว 3 วัน" / "เหลือ 12 วัน" */
export function expiryLabel(info: ExpiryInfo): string {
  if (info.expired) return `หมดอายุแล้ว ${Math.abs(info.daysLeft)} วัน`;
  if (info.daysLeft === 0) return "หมดอายุวันนี้";
  return `เหลือ ${info.daysLeft} วัน`;
}
