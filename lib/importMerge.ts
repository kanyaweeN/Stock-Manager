/**
 * ตรรกะจับคู่/รวมรายการตอนนำเข้าออเดอร์ (ทุกร้าน) — คำนวณล้วนๆ ไม่มี state ไม่มี DOM
 *
 * แยกออกมาจาก `components/ImportModal.tsx` เพราะเป็นตรรกะที่**พลาดแล้วยอดเงินเพี้ยนเงียบๆ**
 * (จับคู่ผิด = จำนวนไปบวกใส่ของผิดชิ้น, หารราคาผิด = ต้นทุนกับยอดสรุปเพี้ยนตามทั้งหมด)
 * แต่ตอนอยู่ในไฟล์ component มันเทสต์ไม่ได้เลย
 */
import { roundBaht } from "./price";
import type { ImportCandidate, StockItem } from "./types";

/** ฟิลด์ที่เลือกได้ว่าจะให้ค่าใหม่ทับของเดิมไหมตอนซื้อซ้ำ */
export type MergeField = "qty" | "price" | "img" | "variant" | "size" | "note" | "status" | "ingredients" | "shop";

export const MERGE_FIELD_LABELS: Record<MergeField, string> = {
  qty: "จำนวน",
  price: "ราคา",
  img: "รูปภาพ",
  variant: "แท็กรอง",
  size: "ขนาด",
  note: "หมายเหตุ",
  status: "สถานะ",
  ingredients: "ส่วนผสม",
  shop: "ร้านค้า",
};

const norm = (s: string | undefined) => (s || "").trim().toLowerCase();

/**
 * เช็คว่าสินค้าที่แยกได้ตรงกับสินค้าที่มีอยู่แล้วไหม (ดูจากลิงก์ก่อน ถ้าไม่มีลิงก์ค่อยดูชื่อ) — เผื่อกรณีซื้อซ้ำ
 * ต้องเช็คตัวเลือกสินค้า (variant) ด้วย ไม่งั้นสินค้าชื่อ/ลิงก์เดียวกันแต่คนละสี/ไซซ์จะถูกมองว่าซื้อซ้ำผิดๆ
 */
export function findExisting(c: ImportCandidate, items: StockItem[]): StockItem | undefined {
  const sameVariant = (i: StockItem) => norm(i.variant) === norm(c.variant);
  if (c.link) {
    const byLink = items.find((i) => i.link && norm(i.link) === norm(c.link) && sameVariant(i));
    if (byLink) return byLink;
  }
  return items.find((i) => norm(i.name) === norm(c.name) && sameVariant(i));
}

/** ค่าใหม่ของฟิลด์นี้จากรายการนำเข้า (เทียบกับของเดิม) ถ้ามีค่าจริงและต่างจากเดิมจึงถือเป็นฟิลด์ที่ "มีค่าใหม่" ให้เลือกอัปเดตได้ */
export function newFieldValue(field: MergeField, c: ImportCandidate, existing: StockItem): string | number | undefined {
  if (field === "qty") return c.qty;
  if (field === "price") return c.price;
  if (field === "img") return c.img && c.img !== existing.img ? c.img : undefined;
  if (field === "variant") return c.variant && c.variant !== existing.variant ? c.variant : undefined;
  if (field === "size") return c.size && c.size !== existing.size ? c.size : undefined;
  if (field === "note") return c.note && c.note !== existing.note ? c.note : undefined;
  if (field === "status") return c.status && c.status !== existing.status ? c.status : undefined;
  if (field === "ingredients") return c.ingredients && c.ingredients !== existing.ingredients ? c.ingredients : undefined;
  if (field === "shop") return c.shop && c.shop !== existing.shop ? c.shop : undefined;
  return undefined;
}

export function oldFieldValue(field: MergeField, existing: StockItem): string | number | undefined {
  if (field === "qty") return existing.qty;
  if (field === "price") return existing.price;
  if (field === "img") return existing.img;
  if (field === "variant") return existing.variant;
  if (field === "size") return existing.size;
  if (field === "note") return existing.note;
  if (field === "status") return existing.status;
  if (field === "ingredients") return existing.ingredients;
  if (field === "shop") return existing.shop;
  return undefined;
}

/** ตั้งค่าเริ่มต้นว่าจะอัปเดตฟิลด์ไหนบ้าง = ทุกฟิลด์ที่มีค่าใหม่จริงๆ */
export function computeMergeFields(c: ImportCandidate, existing: StockItem): NonNullable<ImportCandidate["mergeFields"]> {
  const mergeFields: NonNullable<ImportCandidate["mergeFields"]> = {};
  (Object.keys(MERGE_FIELD_LABELS) as MergeField[]).forEach((f) => {
    mergeFields[f] = newFieldValue(f, c, existing) !== undefined;
  });
  return mergeFields;
}

/**
 * บางครั้ง Shopee แยกสินค้าเดียวกัน (ลิงก์เดียวกัน) ออกเป็นหลาย anchor ในหน้าเดียว
 * (เช่น มีทั้งเวอร์ชัน mobile/desktop ซ้อนกันในหน้าเดียว) — รวมแถวพวกนี้เป็นแถวเดียวก่อนแสดงผล
 * ต้องดูลิงก์ด้วย ไม่ใช่แค่ชื่อ+ตัวเลือกสินค้า เพราะซื้อของเดียวกันจากคนละร้านคือคนละคำสั่งซื้อ ไม่ควรรวมกันเอง
 */
export function mergeWithinBatch(list: ImportCandidate[]): ImportCandidate[] {
  const keyOf = (c: ImportCandidate) => `${norm(c.link)}||${norm(c.name)}||${norm(c.variant)}`;
  const order: string[] = [];
  const merged = new Map<string, ImportCandidate>();
  for (const c of list) {
    const key = keyOf(c);
    const existing = merged.get(key);
    if (existing) {
      const qty = existing.qty + c.qty;
      const lineTotal = (existing.lineTotal ?? 0) + (c.lineTotal ?? 0) || undefined;
      merged.set(key, {
        ...existing,
        qty,
        lineTotal,
        // รวมยอดแล้วหารใหม่ ไม่หยิบราคาเดิมมาดื้อๆ — จำนวนเปลี่ยนไปแล้วราคาต่อชิ้นต้องคิดจากยอดรวมใหม่
        price: lineTotal != null && qty > 0 ? roundBaht(lineTotal / qty) : existing.price ?? c.price,
        img: existing.img || c.img,
        link: existing.link || c.link,
      });
    } else {
      merged.set(key, c);
      order.push(key);
    }
  }
  return order.map((k) => merged.get(k)!);
}

/**
 * คิดช่อง `price` (ต่อชิ้น) ใหม่จากยอดรวมทั้งแถวที่แกะมาได้
 * `perUnit = false` = หน้าที่วางมาโชว์ราคาต่อชิ้นอยู่แล้ว ใช้ตัวเลขนั้นตรงๆ ไม่ต้องหาร
 */
export function applyPriceMode(list: ImportCandidate[], perUnit: boolean): ImportCandidate[] {
  return list.map((c) =>
    c.lineTotal == null ? c : { ...c, price: perUnit && c.qty > 0 ? roundBaht(c.lineTotal / c.qty) : c.lineTotal }
  );
}

/**
 * ยอดรวมของแถวหนึ่งตามโหมดราคาที่เลือกอยู่ — คิดจาก `lineTotal` (ยอดดิบจากหน้าเว็บ)
 * ไม่ใช่ `price` ที่ผู้ใช้แก้ได้ จะได้วัดเฉพาะว่า "แกะครบไหม" ไม่ใช่ "ผู้ใช้พิมพ์อะไรไว้"
 *
 * `perUnit` = หน้านั้นโชว์ยอดรวมทั้งแถว (ต้องหารเป็นราคาต่อชิ้น) ⇒ ยอดดิบคือยอดของทั้งแถวอยู่แล้ว
 * ส่วนหน้าที่โชว์ราคาต่อชิ้น (Lazada/Watsons) ต้องคูณจำนวนกลับก่อนเอาไปเทียบกับยอดบนหน้า
 */
export function rowLineTotal(c: ImportCandidate, perUnit: boolean): number {
  if (c.lineTotal == null) return (c.price ?? 0) * c.qty;
  return perUnit ? c.lineTotal : c.lineTotal * c.qty;
}

/** ผลรวมที่แกะได้กับยอดบนหน้าถือว่าตรงกันเมื่อต่างกันไม่ถึงสตางค์เดียว */
const MONEY_EPS = 0.5;

/**
 * เดาว่าราคาที่หน้านั้นโชว์เป็น "ยอดรวมทั้งแถว" หรือ "ราคาต่อชิ้น" โดยเทียบกับยอด "รวมค่าสินค้า" บนหน้า
 *
 * เดาผิดแล้วราคาต่อชิ้นเพี้ยนเป็นเท่าตัวแบบเงียบๆ (แล้วลามไปทั้งต้นทุนและยอดสรุป) แต่ละร้านโชว์ไม่เหมือนกัน
 * และบางร้านก็เปลี่ยนไปมาระหว่างหน้ารวม/หน้ารายละเอียด — ถ้าหน้านั้นมียอดให้เทียบก็ไม่ต้องเดา
 * ไม่มียอดให้เทียบค่อยใช้ค่าเริ่มต้นของร้านนั้น (ผู้ใช้สลับเองได้อยู่แล้ว)
 */
export function detectPricePerUnit(
  list: ImportCandidate[],
  goodsSubtotal: number | undefined,
  fallback: boolean
): boolean {
  const rows = list.filter((c) => c.lineTotal != null);
  if (goodsSubtotal == null || rows.length === 0) return fallback;
  const sum = (perUnit: boolean) => rows.reduce((s, c) => s + rowLineTotal(c, perUnit), 0);
  if (Math.abs(sum(true) - goodsSubtotal) < MONEY_EPS) return true;
  if (Math.abs(sum(false) - goodsSubtotal) < MONEY_EPS) return false;
  return fallback;
}

/** ออเดอร์ที่กำลังนำเข้าเก่ากว่าครั้งล่าสุดที่บันทึกไว้ = กำลังลงข้อมูลย้อนหลัง */
export function isBackdated(c: ImportCandidate, existing: StockItem): boolean {
  return !!c.purchasedAt && !!existing.purchasedAt && c.purchasedAt < existing.purchasedAt;
}

/**
 * จับคู่รายการที่แกะมาได้กับของในสต็อก แล้วเติมค่าเริ่มต้นของการซื้อซ้ำให้
 *
 * ข้อมูล Shopee ไม่มีหมวดหมู่/หมายเหตุอยู่แล้ว ถ้าเป็นการซื้อซ้ำจึงดึงค่าที่ตั้งไว้ของสินค้าเดิม
 * มาโชว์ก่อนเลย ผู้ใช้จะได้ไม่ต้องเลือกหมวดหมู่ใหม่ทุกครั้งที่ซื้อของเดิมซ้ำ
 */
export function linkToExisting(list: ImportCandidate[], items: StockItem[]): ImportCandidate[] {
  return list.map((c) => {
    const existing = findExisting(c, items);
    if (!existing) return c;
    return {
      ...c,
      cats: existing.cats,
      note: c.note || existing.note,
      existingId: existing.id,
      mergeExisting: true,
      mergeFields: computeMergeFields(c, existing),
    };
  });
}

/**
 * วันที่/ร้านที่จะแปะให้ **ออเดอร์** (ค่าส่ง/ส่วนลด) ของการนำเข้ารอบนี้
 *
 * ต้องดู `chosen` (แถวที่ติ๊กไว้จริง) ก่อนเสมอ — เดิมอ่านจากทุกแถวบนหน้า ทำให้ออเดอร์ได้
 * วันที่/ร้านจากสินค้าที่ผู้ใช้ติ๊กออกไปแล้ว แล้ว `findDuplicateOrder` ก็เทียบผิดตัวตามไปด้วย
 * (ค่าส่งที่ถูกนับสองรอบทำให้ยอดสรุปเกินจริงแบบเงียบๆ)
 *
 * ถ้าแถวที่เลือกไม่มีข้อมูลนี้เลยค่อยถอยไปดูทั้งหน้า — ทุกแถวมาจากหน้าออเดอร์เดียวกันอยู่แล้ว
 * ดีกว่าปล่อยให้ออเดอร์ไม่มีวันที่ (จะตกไปอยู่แถว "ไม่ทราบวันที่" ในหน้าสรุป)
 */
export function orderMetaFrom(
  chosen: ImportCandidate[],
  all: ImportCandidate[]
): { date?: string; shop?: string } {
  return {
    date: chosen.find((c) => c.purchasedAt)?.purchasedAt ?? all.find((c) => c.purchasedAt)?.purchasedAt,
    shop: chosen.find((c) => c.shop)?.shop ?? all.find((c) => c.shop)?.shop,
  };
}
