"use client";

import { useState } from "react";
import type { StockItem } from "@/lib/types";

/** สูตรต้นทุนกับแผนซื้อของมีรูปร่างเหมือนกันตรงที่ "เป็นก้อนที่มี lines ซึ่งผูกกลับไปที่สินค้าในสต็อก" */
interface TargetLike {
  id: string;
  lines: { itemId?: string }[];
}

interface Options<T extends TargetLike> {
  /** ก้อนที่มีอยู่แล้ว (สูตรทั้งหมด / แผนทั้งหมด) — ไม่มีเลยแปลว่าไม่ต้องถามว่าจะใส่อันไหน */
  targets: T[];
  /** ก้อนเปล่าสำหรับ "สร้างใหม่" */
  emptyTarget: () => T;
  /** แปลงสินค้า 1 ชิ้นเป็น 1 บรรทัดของก้อนนี้ (lineFromItem / planLineFromItem) */
  lineFromItem: (item: StockItem) => T["lines"][number];
  save: (target: T) => void;
}

/**
 * "เอาสินค้าที่เลือกไว้ใส่สูตร/แผนไหน?" — สถานะชุดเดียวกันเป๊ะของทั้ง `RecipeModal` และ `PlanModal`
 * (เดิมเป็นสองก้อนใน `app/page.tsx` ที่ต่างกันแค่ชื่อฟังก์ชันที่เรียก)
 *
 * `draft` คือก้อนที่กำลังเปิดแก้อยู่ (`null` = ปิด) ส่วน `targetItems` คือสินค้าที่รอเลือกปลายทาง
 * (`null` = ไม่ได้เปิดกล่องเลือก) — **ยังไม่บันทึกให้ตอนใส่** เปิดโมดัลให้กรอกก่อนแล้วค่อยกดบันทึกเอง
 */
export function useTargetDraft<T extends TargetLike>({ targets, emptyTarget, lineFromItem, save }: Options<T>) {
  const [draft, setDraft] = useState<T | null>(null);
  const [targetItems, setTargetItems] = useState<StockItem[] | null>(null);

  /** สินค้าที่อยู่ในก้อนนั้นแล้วจะไม่ถูกใส่ซ้ำ — สองบรรทัดที่ผูกสินค้าชิ้นเดียวกันคือยอดก้อนเดียวที่ถูกบวกสองรอบ */
  const withItems = (target: T, items: StockItem[]): T => {
    const already = new Set(target.lines.map((l) => l.itemId).filter(Boolean));
    const chosen = items.filter((i) => !already.has(i.id));
    // spread ของ generic ทำให้ TS มองไม่ออกว่ายังเป็น T อยู่ ทั้งที่แก้แค่ `lines`
    return { ...target, lines: [...target.lines, ...chosen.map(lineFromItem)] } as T;
  };

  /** สร้างก้อนใหม่ที่มีสินค้าชุดนี้อยู่แล้ว */
  const startNewWith = (chosen: StockItem[]) => {
    setTargetItems(null);
    setDraft(withItems(emptyTarget(), chosen));
  };

  /** ยังไม่มีก้อนไหนเลยก็ข้ามไปสร้างใหม่ให้เลย ไม่ต้องเลือก */
  const openAddTo = (chosen: StockItem[]) => {
    if (chosen.length === 0) return;
    if (targets.length === 0) startNewWith(chosen);
    else setTargetItems(chosen);
  };

  const addToExisting = (target: T) => {
    const chosen = targetItems ?? [];
    setTargetItems(null);
    setDraft(withItems(target, chosen));
  };

  const saveDraft = (target: T) => {
    save(target);
    setDraft(null);
  };

  return {
    draft, setDraft,
    targetItems, setTargetItems,
    openAddTo, startNewWith, addToExisting, saveDraft,
    closeDraft: () => setDraft(null),
    closePicker: () => setTargetItems(null),
  };
}
