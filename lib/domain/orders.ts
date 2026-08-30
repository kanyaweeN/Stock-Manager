/**
 * ออเดอร์ (ค่าส่ง/ส่วนลดที่ไม่ได้อยู่ในราคาสินค้า) — คำนวณล้วนๆ ไม่มี state
 *
 * **ทุกอย่างที่เกี่ยวกับออเดอร์อยู่ในไฟล์นี้ไฟล์เดียว** — ตัวออเดอร์เอง (เรียง/หาซ้ำ/ยอดก้อนเดียว)
 * และการแปลงเป็นก้อนเงินให้หน้าสรุปเอาไปรวม (`orderExtras`/`extrasInRange`/`totalExtras`)
 * ส่วน `lib/domain/summary.ts` เป็นคนรวมยอดพวกนี้เข้ากับ `priceHistory` ของสินค้าอีกที
 *
 * ชื่อร้าน (`normalizeShopName`/`shopKey`) ก็อยู่ที่นี่ เพราะร้านเป็นเรื่องของ "การซื้อ"
 * ทั้ง `PurchaseOrder.shop`, `StockItem.shop` และ `PricePoint.shop` ต้องบีบชื่อแบบเดียวกัน
 * ไม่งั้นร้านเดียวกันที่พิมพ์ต่างกันนิดเดียวจะกลายเป็นคนละร้านในหน้าสรุป
 */
import type { PurchaseOrder } from "@/lib/types";

/**
 * ชื่อร้านที่ใช้ **แสดงผล** — ตัดช่องว่างหัวท้ายและบีบช่องว่างซ้อนให้เหลือช่องเดียว
 * (คงช่องว่างเดี่ยวไว้ ชื่อร้านที่ผู้ใช้ตั้งใจเว้นวรรคจะได้อ่านเหมือนเดิม)
 */
export function normalizeShopName(shop: string | undefined): string {
  return (shop || "").trim().replace(/\s+/g, " ");
}

/**
 * คีย์สำหรับ **จัดกลุ่ม** ร้าน — ตัดช่องว่าง**ทั้งหมด**ทิ้งและไม่สนตัวพิมพ์ใหญ่เล็ก
 *
 * ตัดทิ้งหมดไม่ใช่แค่บีบ เพราะ**ภาษาไทยไม่เว้นวรรคระหว่างคำ** `"ร้านเอ"` กับ `"ร้าน เอ"`
 * คือร้านเดียวกันที่พิมพ์คนละแบบ ถ้าบีบเฉยๆ มันจะยังเป็นคนละคีย์ แล้วแตกเป็นสองแถว
 * แบ่งยอดกันเองในหน้าสรุป — แถมตัวเทียบราคาข้ามร้านจะเอาร้านเดียวกันมาเทียบกับตัวเอง
 *
 * ผลข้างเคียงที่ยอมรับ: ร้านคนละร้านที่ชื่อต่างกัน**แค่ช่องว่าง**จะถูกรวมเป็นร้านเดียว
 * — ในทางปฏิบัติแทบไม่เกิด และคีย์นี้ใช้จัดกลุ่มอย่างเดียว ชื่อที่โชว์ยังเป็นตัวที่ผู้ใช้พิมพ์
 */
export function shopKey(shop: string | undefined): string {
  return normalizeShopName(shop).replace(/\s+/g, "").toLowerCase();
}

/** เงินที่ต้องบวกเพิ่มจากออเดอร์นี้ = ค่าส่ง − ส่วนลด (ติดลบได้ = ส่วนลดมากกว่าค่าส่ง) */
export function orderNet(o: PurchaseOrder): number {
  return (o.shipping || 0) - (o.discount || 0);
}

/** เรียงออเดอร์ใหม่→เก่า (ตัวที่ไม่ทราบวันที่ไปท้ายสุด) */
export function sortOrders(orders: PurchaseOrder[]): PurchaseOrder[] {
  return [...orders].sort((a, b) => {
    if (!a.date && !b.date) return 0;
    if (!a.date) return 1;
    if (!b.date) return -1;
    return b.date.localeCompare(a.date);
  });
}

/**
 * หาออเดอร์ที่ "น่าจะเป็นก้อนเดียวกัน" กับที่กำลังจะบันทึก — ใช้เตือนตอนนำเข้าหน้าเดิมซ้ำ
 *
 * ค่าส่งเป็นเงินระดับออเดอร์ ถ้าบันทึกซ้ำยอดรวมจะเกินจริงแบบ**เงียบๆ** (ต่างจากสินค้าที่
 * ซ้ำแล้วเห็นชัดว่าจำนวนเด้ง) เทียบด้วย วันที่ + ร้าน + ยอด เพราะ Shopee ไม่ได้ให้เลขออเดอร์
 * ที่แกะได้แน่นอน — เป็นแค่การเตือน ผู้ใช้ตัดสินใจเองว่าจะบันทึกไหม
 */
export function findDuplicateOrder(
  orders: PurchaseOrder[] | undefined,
  candidate: { date?: string; shop?: string; shipping: number; discount: number }
): PurchaseOrder | undefined {
  if (!candidate.date) return undefined;
  const shop = shopKey(candidate.shop);
  return (orders ?? []).find(
    (o) =>
      o.date === candidate.date &&
      shopKey(o.shop) === shop &&
      o.shipping === candidate.shipping &&
      o.discount === candidate.discount
  );
}

// ─────────────────────────────────────────────────────────────
// ค่าส่ง/ส่วนลดระดับออเดอร์ (เงินที่จ่ายจริงแต่ไม่ได้อยู่ในราคาสินค้า)
// ─────────────────────────────────────────────────────────────

/**
 * ค่าใช้จ่ายส่วนที่เกินราคาสินค้าของ 1 ออเดอร์ — `net` ติดลบได้ (ส่วนลดมากกว่าค่าส่ง)
 *
 * แยกจาก `SpendEvent` เพราะเป็นเงินระดับ**ออเดอร์** ไม่ใช่ระดับชิ้น เอาไปหารลงสินค้าแต่ละชิ้น
 * ไม่ได้โดยไม่เดา จึงไม่ถูกนับใน "แยกตามหมวดหมู่/รายชิ้น" แต่ถูกบวกในยอดรวมกับยอดรายเดือน
 */
export interface OrderExtra {
  orderId: string;
  /** `""` = ไม่ทราบวันที่ (ไม่เข้าตัวกรองช่วงวัน เหมือนจุดราคาที่ไม่มีวันที่) */
  date: string;
  shop: string;
  shipping: number;
  discount: number;
  /** ค่าส่ง − ส่วนลด = เงินที่ต้องบวกเพิ่มเข้ายอด (ติดลบ = ประหยัดได้) */
  net: number;
}

/** ออเดอร์ที่ไม่มีทั้งค่าส่งและส่วนลดถูกตัดทิ้ง — ไม่มีผลกับยอดใดๆ อยู่แล้ว */
export function orderExtras(orders?: PurchaseOrder[]): OrderExtra[] {
  return (orders ?? [])
    .filter((o) => o.shipping > 0 || o.discount > 0)
    .map((o) => ({
      orderId: o.id,
      date: o.date || "",
      shop: o.shop || "",
      shipping: o.shipping,
      discount: o.discount,
      net: o.shipping - o.discount,
    }));
}

export function extrasInRange(extras: OrderExtra[], from: string, to: string): OrderExtra[] {
  return extras.filter((x) => x.date >= from && x.date <= to);
}

export function totalExtras(extras: OrderExtra[]): number {
  return extras.reduce((s, x) => s + x.net, 0);
}
