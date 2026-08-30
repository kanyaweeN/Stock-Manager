/**
 * แปลงสินค้า ↔ ค่าที่กรอกในฟอร์ม — คำนวณล้วนๆ ไม่มี state
 *
 * แยกออกจาก `components/ProductModal.tsx` ให้เข้าชุดกับ `lib/forms/recipeDraft.ts` / `lib/forms/planDraft.ts`
 * และเพื่อให้เทสต์การแปลงตัวเลขได้ (0 กับ "ไม่ได้กรอก" ต้องไม่ปนกัน ดู helper ข้างล่าง)
 *
 * **เพิ่มฟิลด์ใหม่ = แก้ `ProductForm` + `toProductForm` + `fromProductForm` เท่านั้น**
 */
import { todayISO } from "@/lib/core/date";
import { normalizeShopName } from "@/lib/domain/orders";
import type { ItemStatus, PricePoint, StockItem } from "@/lib/types";

const todayStr = () => todayISO();

/**
 * ค่าที่กรอกอยู่ในฟอร์ม — **ตัวเลขทุกช่องเก็บเป็นสตริง** จะได้ลบให้ว่างได้ระหว่างพิมพ์
 * โดยไม่โดนเด้งกลับเป็น 0 (เหมือน RecipeModal/PlanModal)
 *
 * `qty`/`min` เคยเป็น number ด้วยเหตุผลว่า "ต้องมีค่าเสมอ ไม่มีสถานะไม่ได้กรอก" — แต่ผลคือ
 * ลบเลขในช่องทิ้งไม่ได้เลย มันเด้งเป็น `0` ทันทีที่ช่องว่าง ต้องไปลบ 0 ทิ้งอีกทีก่อนพิมพ์เลขใหม่
 * ตอนนี้เป็นสตริงเหมือนช่องอื่น แล้วให้ `fromProductForm` ตีความว่าง = 0 ตอนบันทึกแทน
 */
export interface ProductForm {
  name: string;
  cats: string[];
  qty: string;
  min: string;
  price: string;
  buyQty: string;
  size: string;
  note: string;
  img: string;
  link: string;
  status: ItemStatus;
  purchasedAt: string;
  ingredients: string;
  priceHistory: PricePoint[];
  shop: string;
  expiryAt: string;
  openedAt: string;
  paoMonths: string;
  unit: string;
  packAmount: string;
  location: string;
  openPct: string;
  reorderQty: string;
}

/**
 * สตริงตัวเลขที่ "ไม่ได้กรอก" ต้องออกมาเป็น `undefined` ไม่ใช่ 0
 * (บางช่อง 0 เป็นค่าที่ผู้ใช้ตั้งใจกรอกได้จริง เช่น ราคา ฿0 ของแถม)
 */
const numOrUndef = (v: string): number | undefined =>
  v.trim() === "" ? undefined : Math.max(0, Number(v) || 0);

/** ช่องที่ 0 ไม่มีความหมาย (ขนาดบรรจุ/จำนวนเดือน/จำนวนที่ซื้อประจำ) — 0 กับว่าง = ยังไม่ได้ตั้ง */
const positiveOrUndef = (v: string): number | undefined => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : undefined;
};

/** เหมือน `positiveOrUndef` แต่ปัดเป็นจำนวนเต็ม (เดือน/จำนวนชิ้น ไม่มีเศษ) */
const positiveIntOrUndef = (v: string): number | undefined => {
  const n = positiveOrUndef(v);
  return n == null ? undefined : Math.round(n);
};

const textOrUndef = (v: string) => v.trim() || undefined;

/**
 * สินค้า → ฟอร์ม (ไม่ส่งอะไรมา = ฟอร์มเปล่าสำหรับเพิ่มของใหม่)
 *
 * `toForm`/`fromForm` จับคู่กันและเป็น **จุดเดียว** ที่รู้ว่าฟิลด์ไหนแปลงยังไง —
 * เพิ่มฟิลด์ใหม่ให้แก้แค่ `ProductForm` กับสองฟังก์ชันนี้ ไม่ต้องไล่แก้ทั้ง useEffect
 * และ handleSave แยกกันอย่างเดิม (ซึ่งลืมที่ใดที่หนึ่งแล้วค่าหายเงียบๆ)
 */
export function toProductForm(item: StockItem | null): ProductForm {
  if (!item) {
    return {
      name: "", cats: [], qty: "", min: "", price: "", buyQty: "", size: "", note: "",
      img: "", link: "", status: "", purchasedAt: todayStr(), ingredients: "", priceHistory: [],
      shop: "", expiryAt: "", openedAt: "", paoMonths: "",
      unit: "", packAmount: "", location: "", openPct: "", reorderQty: "",
    };
  }
  const num = (v: number | undefined) => (v != null ? String(v) : "");
  return {
    name: item.name,
    cats: item.cats,
    qty: String(item.qty),
    min: String(item.min),
    price: num(item.price),
    buyQty: num(item.buyQty),
    size: item.size || "",
    note: item.note,
    img: item.img || "",
    link: item.link || "",
    status: item.status || "",
    purchasedAt: item.purchasedAt || "",
    ingredients: item.ingredients || "",
    priceHistory: item.priceHistory || [],
    shop: item.shop || "",
    expiryAt: item.expiryAt || "",
    openedAt: item.openedAt || "",
    paoMonths: num(item.paoMonths),
    unit: item.unit || "",
    packAmount: num(item.packAmount),
    location: item.location || "",
    openPct: num(item.openPct),
    reorderQty: num(item.reorderQty),
  };
}

/**
 * ฟอร์ม → สินค้า (ยังไม่มี `id` ผู้เรียกเป็นคนใส่)
 *
 * `usageLog` ไม่ได้อยู่ในฟอร์มเพราะไม่มีช่องให้แก้ — ระบบจดให้เองตอนกด +/− บนการ์ด
 * จึงต้องพกของเดิมติดไปด้วย ไม่งั้นการกดบันทึกในฟอร์มจะล้างประวัติการใช้ทิ้ง
 */
export function fromProductForm(form: ProductForm, item: StockItem | null): Omit<StockItem, "id"> {
  return {
    name: form.name.trim(),
    cats: form.cats,
    qty: Math.max(0, Number(form.qty) || 0),
    min: Math.max(0, Number(form.min) || 0),
    price: numOrUndef(form.price),
    buyQty: numOrUndef(form.buyQty),
    priceHistory: form.priceHistory,
    // บันทึกเอง = ผู้ใช้ตรวจราคาแล้ว ปลดธง "ยังไม่ยืนยัน" ของข้อมูลเก่าทิ้ง
    priceUnverified: undefined,
    size: form.size.trim(),
    note: form.note.trim(),
    img: form.img.trim(),
    link: form.link.trim(),
    status: form.status,
    purchasedAt: form.purchasedAt || undefined,
    ingredients: form.ingredients.trim(),
    shop: normalizeShopName(form.shop) || undefined,
    expiryAt: form.expiryAt || undefined,
    openedAt: form.openedAt || undefined,
    paoMonths: positiveIntOrUndef(form.paoMonths),
    unit: textOrUndef(form.unit),
    // 0 = ยังไม่รู้ขนาดบรรจุ ไม่ใช่ "แพ็คละ 0" — เก็บเป็น undefined ให้ /cost ไปเดาจาก `size` ต่อ
    packAmount: positiveOrUndef(form.packAmount),
    location: textOrUndef(form.location),
    // ว่าง = ไม่ระบุ (ถือว่าเต็มขวด) ต่างจาก 0 ที่แปลว่าขวดที่เปิดอยู่ใช้หมดแล้ว
    openPct: form.openPct.trim() === "" ? undefined : Math.min(100, Math.max(0, Number(form.openPct) || 0)),
    reorderQty: positiveIntOrUndef(form.reorderQty),
    usageLog: item?.usageLog ?? [],
  };
}
