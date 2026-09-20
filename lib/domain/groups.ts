/**
 * ตัวช่วยเปิดชื่อกลุ่มจาก `db.groups` — ชื่อกลุ่มเก็บเป็นก้อนกลาง ตัว item ถือแค่ `groupId`
 * (ดู `lib/types.ts` → `StockGroup` และ `CLAUDE.md` หัวข้อกลุ่มสินค้า)
 *
 * ท่านี้เคยถูกก๊อปไว้ 4 ที่ (ProductGrid / forecast page / googleSheets / page.tsx ที่เผลอใช้ `find`)
 * รวมมาที่เดียวเพื่อจะได้เรียกได้เหมือนกันทั้งหน้าที่ต้องโชว์และตอน export
 */
import type { StockGroup } from "@/lib/types";

/** Map<groupId, name> — เรียกครั้งเดียวแล้ววน `.get(id)` แทนการวน `find` ทุกก้อน */
export function groupNameMap(groups: StockGroup[] | undefined): Map<string, string> {
  return new Map((groups ?? []).map((g) => [g.id, g.name]));
}
