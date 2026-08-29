/**
 * ค้นสินค้าในสต็อกสำหรับกล่อง "เลือกจากสต็อก" — คำนวณล้วนๆ ไม่มี state
 *
 * เดิมตรรกะก้อนนี้ถูกก๊อปไว้เหมือนกันเป๊ะใน `RecipeModal` กับ `PlanModal` (ทั้งฟิลด์ที่ค้น
 * การเรียง และเพดานจำนวนแถว) — อยู่ในไฟล์ component จึงเทสต์ไม่ได้ และเวลาเพิ่มฟิลด์ที่ค้นได้
 * ต้องไล่แก้สองที่ ลืมที่ใดที่หนึ่งแล้วกล่องสองกล่องหาของเจอไม่เท่ากันแบบเงียบๆ
 */
import type { StockItem } from "./types";

/** เพดานจำนวนแถวที่โชว์ — กันรายการยาวเป็นพันแถวตอนยังไม่ได้พิมพ์ค้นอะไร */
export const PICKER_MAX_RESULTS = 50;

/**
 * ค้นจากชื่อ / หมวดหมู่ / รุ่นย่อย (`variant`) แบบไม่สนตัวพิมพ์ใหญ่เล็ก
 *
 * คำค้นว่าง = คืนทั้งหมด (ตัดตามเพดาน) เรียงตามชื่อแบบภาษาไทยเสมอ ไม่ใช่ลำดับใน `db.items`
 * เพราะกล่องนี้ใช้ "หาของที่รู้ชื่ออยู่แล้ว" ไม่ใช่ "ดูของที่เพิ่งเพิ่ม"
 */
export function searchStockItems(
  items: StockItem[],
  query: string,
  limit: number = PICKER_MAX_RESULTS
): StockItem[] {
  const q = query.trim().toLowerCase();
  return [...items]
    .filter(
      (i) =>
        !q ||
        i.name.toLowerCase().includes(q) ||
        i.cats.some((c) => c.toLowerCase().includes(q)) ||
        (i.variant ?? "").toLowerCase().includes(q)
    )
    .sort((a, b) => a.name.localeCompare(b.name, "th"))
    .slice(0, limit);
}
