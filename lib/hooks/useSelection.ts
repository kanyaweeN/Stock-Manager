"use client";

import { useMemo, useState } from "react";
import type { StockItem } from "@/lib/types";

/**
 * โหมด "เลือกหลายอัน" ของหน้าแรก — เก็บว่าเปิดโหมดอยู่ไหมและเลือกอะไรไว้บ้าง
 *
 * แยกออกมาจาก `app/page.tsx` เพราะสถานะชุดนี้ (โหมด + เซ็ต id + เลือกทั้งหมด + ออกจากโหมด)
 * ต้องเปลี่ยนพร้อมกันเป็นชุดเสมอ ปนอยู่กับ state ของกล่องโมดัลอีก 6 ตัวแล้วอ่านยาก
 * และพลาดง่าย — เช่นลืม `setSelectedIds(new Set())` ตอนปิดโหมด แล้วของที่เลือกไว้ค้าง
 *
 * `items` = ทั้งสต็อก ใช้แปลง id กลับเป็นสินค้า · `filtered` = ที่มองเห็นอยู่ตอนนี้
 */
export function useSelection(items: StockItem[], filtered: StockItem[]) {
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  /**
   * เลือกทั้งหมด = เฉพาะรายการที่มองเห็นอยู่ตอนนี้ (ผ่านตัวกรอง/คำค้นแล้ว) ไม่ใช่ทั้งสต็อก
   * จะได้ใช้คู่กับตัวกรองเพื่อ "ลบทั้งหมดในหมวดนี้" ได้ และไม่เผลอลบของที่มองไม่เห็น
   */
  const allFilteredSelected = filtered.length > 0 && filtered.every((i) => selectedIds.has(i.id));
  const toggleSelectAllFiltered = () => {
    setSelectedIds(allFilteredSelected ? new Set() : new Set(filtered.map((i) => i.id)));
  };

  const exitSelectMode = () => {
    setSelectMode(false);
    setSelectedIds(new Set());
  };

  /** เลือกไว้แล้วเป็นสินค้าตัวไหนบ้าง — เรียงตามลำดับใน `items` ไม่ใช่ลำดับที่กดเลือก */
  const selectedItems = useMemo(() => items.filter((i) => selectedIds.has(i.id)), [items, selectedIds]);

  return {
    selectMode,
    setSelectMode,
    selectedIds,
    selectedItems,
    toggleSelect,
    allFilteredSelected,
    toggleSelectAllFiltered,
    exitSelectMode,
  };
}
