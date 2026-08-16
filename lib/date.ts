/**
 * วันที่แบบ `YYYY-MM-DD` ที่อิง **เวลาเครื่องผู้ใช้** ไม่ใช่ UTC
 *
 * `new Date().toISOString().slice(0, 10)` คือกับดัก: มันคืนวันที่ตามเวลา UTC
 * ไทยเร็วกว่า UTC 7 ชั่วโมง แปลว่าตั้งแต่เที่ยงคืนถึง 7 โมงเช้า มันจะได้ "เมื่อวาน"
 * ของที่ซื้อ/นำเข้าตอนตี 2 เลยถูกลงวันที่ผิดไป 1 วัน แล้วไปเพี้ยนต่อที่หน้าสรุปยอด
 * (`purchasedAt`, `priceHistory[].date` และช่วง 30 วันล่าสุด ใช้สตริงนี้เทียบกันตรงๆ)
 */
export function todayISO(d: Date = new Date()): string {
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

const TH_MONTHS_SHORT = [
  "ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.",
  "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค.",
];

/**
 * `YYYY-MM-DD` → `"4 เม.ย. 62"` (พ.ศ. สองหลัก) สำหรับโชว์บนการ์ด
 * ของปีนี้ตัดปีทิ้งเหลือแค่ `"4 เม.ย."` เพราะส่วนใหญ่เป็นของปีปัจจุบันอยู่แล้ว ปีซ้ำๆ กินที่เปล่าๆ
 * คืนสตริงว่างถ้าอ่านไม่ออก — ผู้เรียกเช็คเองว่าจะโชว์ไหม
 */
export function formatThaiShortDate(iso: string | undefined, now: Date = new Date()): string {
  const m = (iso || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return "";
  const [, y, mm, dd] = m;
  const month = TH_MONTHS_SHORT[Number(mm) - 1];
  if (!month) return "";
  const day = Number(dd);
  if (Number(y) === now.getFullYear()) return `${day} ${month}`;
  return `${day} ${month} ${String(Number(y) + 543).slice(-2)}`;
}

/** วันที่ของ n วันก่อน (เวลาเครื่องผู้ใช้เหมือน `todayISO`) */
export function daysAgoISO(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return todayISO(d);
}

const TH_MONTHS_FULL = [
  "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
  "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม",
];

/** `"2026-08"` → `"สิงหาคม 2569"` — คืนค่าเดิมถ้าอ่านไม่ออก */
export function thaiMonthLabel(ym: string): string {
  const [y, m] = (ym || "").split("-").map(Number);
  const name = TH_MONTHS_FULL[m - 1];
  if (!name || !y) return ym;
  return `${name} ${y + 543}`;
}

/** เดือนของวันที่ (`YYYY-MM`) ตามเวลาเครื่อง — `offset` = เลื่อนไปกี่เดือน (1 = เดือนหน้า) */
export function monthISO(offset = 0, now: Date = new Date()): string {
  const d = new Date(now.getFullYear(), now.getMonth() + offset, 1);
  return todayISO(d).slice(0, 7);
}

/** วันสุดท้ายของเดือน (`YYYY-MM-DD`) — `offset` = เลื่อนไปกี่เดือนจากเดือนนี้ */
export function endOfMonthISO(offset = 0, now: Date = new Date()): string {
  // วันที่ 0 ของเดือนถัดไป = วันสุดท้ายของเดือนที่ต้องการ
  return todayISO(new Date(now.getFullYear(), now.getMonth() + offset + 1, 0));
}

/**
 * เหลืออีกกี่วันถึงวันที่กำหนด (ติดลบ = เลยกำหนดมาแล้ว) — null ถ้าอ่านวันที่ไม่ออก
 * เทียบแบบวันชนวัน ไม่เอาเวลามาเกี่ยว จะได้ไม่เพี้ยนตามชั่วโมงที่เปิดแอป
 */
export function daysUntil(iso: string | undefined, now: Date = new Date()): number | null {
  const m = (iso || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const target = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((target.getTime() - today.getTime()) / 86400000);
}
