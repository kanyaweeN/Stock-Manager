/**
 * ถังขยะ — ของที่ลบไปแล้วแต่ยังกู้คืนได้ (คำนวณล้วนๆ ไม่มี state)
 *
 * เดิมการลบเป็นการลบถาวรทันที (`removeMany` ถึงต้องเตือนว่า "ลบแล้วกู้คืนไม่ได้")
 * ซึ่งเป็นการกระทำเดียวในแอปที่พลาดแล้วจบเลย — และเป็นสิ่งที่ย้อนไปแก้ทีหลังไม่ได้จริงๆ
 * เพราะของที่ลบไปก่อนหน้านี้ไม่มีทางเรียกคืน
 *
 * **ออกแบบเป็น "ย้ายออกจาก `db.items` ไปไว้ `db.trash`" ไม่ใช่ติดแฟล็กซ่อนไว้**
 * เพราะทั้งแอปวน `db.items` ตรงๆ อยู่หลายสิบที่ (กรอง/สรุปยอด/สูตร/แผน/ส่งออก)
 * ถ้าใช้แฟล็ก ทุกที่เหล่านั้นต้องจำให้ได้ว่าต้องกรองของที่ลบทิ้งออก ลืมที่ไหนที่หนึ่ง
 * ของที่ "ลบแล้ว" จะโผล่กลับมาในยอดเงียบๆ — วิธีย้ายออกทำให้โค้ดเดิมถูกต้องโดยไม่ต้องแก้
 */
import type { StockItem } from "./types";

/** เก็บของที่ลบไว้ได้มากสุดกี่ชิ้น — เกินแล้วตัวที่ลบนานสุดหลุดออกถาวร */
export const TRASH_MAX = 100;

/** ย้ายของเข้าถังขยะ (ใหม่สุดอยู่ท้าย) แล้วตัดตัวเก่าที่เกินโควตาทิ้ง */
export function pushToTrash(trash: StockItem[] | undefined, items: StockItem[], now = new Date().toISOString()): StockItem[] {
  const next = [...(trash ?? []), ...items.map((i) => ({ ...i, deletedAt: now }))];
  return next.length > TRASH_MAX ? next.slice(next.length - TRASH_MAX) : next;
}

/** ถังขยะเรียงลบล่าสุดขึ้นก่อน — ตัวที่เพิ่งลบพลาดคือตัวที่ผู้ใช้มองหา */
export function sortTrash(trash: StockItem[]): StockItem[] {
  return [...trash].sort((a, b) => (b.deletedAt || "").localeCompare(a.deletedAt || ""));
}

/**
 * เอาของออกจากถังขยะเพื่อกู้คืน — คืนทั้งตัวที่กู้ (ล้าง `deletedAt` แล้ว) และถังที่เหลือ
 *
 * ถ้า id ไปชนกับของที่มีอยู่ในสต็อกแล้ว (กู้คืนไฟล์สำรองทับหลังลบ) จะออก id ใหม่ให้
 * ไม่งั้นจะได้สองแถวที่ id เดียวกัน ซึ่งทำให้ทุกอย่างที่หาโดย id เพี้ยนหมด
 */
export function takeFromTrash(
  trash: StockItem[] | undefined,
  id: string,
  existingIds: Set<string>,
  newId: () => string
): { item: StockItem | null; trash: StockItem[] } {
  const list = trash ?? [];
  const found = list.find((i) => i.id === id);
  if (!found) return { item: null, trash: list };
  const { deletedAt: _deletedAt, ...rest } = found;
  return {
    item: { ...rest, id: existingIds.has(found.id) ? newId() : found.id },
    trash: list.filter((i) => i.id !== id),
  };
}
