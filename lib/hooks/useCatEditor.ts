"use client";

import { useMemo, useState } from "react";
import { catsInUse, commonCats, previewCatEdit, type CatEditMode } from "@/lib/core/cats";
import type { StockItem } from "@/lib/types";

/** 3 ทางเลือกของกล่องจัดหมวดหมู่ — คำอธิบายอยู่ในตารางนี้ที่เดียว ทั้งข้อความช่วย ชื่อช่อง และคำบนปุ่มยืนยัน */
export const CAT_EDIT_MODES: { key: CatEditMode; label: string; hint: string; field: string; confirm: string }[] = [
  { key: "add", label: "➕ เพิ่ม", hint: "ติดหมวดหมู่ที่เลือกเพิ่มให้ทุกรายการ — หมวดหมู่เดิมของแต่ละชิ้นยังอยู่ครบ", field: "หมวดหมู่ที่จะเพิ่ม", confirm: "เพิ่มหมวดหมู่" },
  { key: "remove", label: "➖ เอาออก", hint: "เอาเฉพาะหมวดหมู่ที่เลือกออก — หมวดหมู่อื่นของแต่ละชิ้นไม่ถูกแตะ", field: "หมวดหมู่ที่จะเอาออก", confirm: "เอาหมวดหมู่ออก" },
  { key: "replace", label: "🔁 แทนที่ทั้งหมด", hint: "ล้างหมวดหมู่เดิมของทุกรายการทิ้ง แล้วใช้ที่เลือกไว้แทน (ไม่เลือกอะไรเลย = ล้างหมวดหมู่ทิ้งทั้งหมด)", field: "หมวดหมู่ใหม่", confirm: "แทนที่หมวดหมู่" },
];

interface Options {
  /** รายการที่ติ๊กไว้ตอนนี้ — ทั้งตัวอย่างผลลัพธ์และรายการหมวดที่ให้เลือกอิงจากชุดนี้ */
  selectedItems: StockItem[];
  /** หมวดหมู่ทั้งหมดที่ให้เลือก (ใช้ในโหมดเพิ่ม/แทนที่) */
  suggestions: string[];
  apply: (cats: string[], mode: CatEditMode) => void;
  /** เรียกหลังยืนยันสำเร็จ — ปกติคือออกจากโหมดเลือกหลายรายการ */
  onDone: () => void;
}

/**
 * กล่องแก้หมวดหมู่ทีละหลายรายการของหน้าแรก — สถานะ + ตัวอย่างผลลัพธ์ที่ต้องเปลี่ยนพร้อมกันเสมอ
 *
 * ตัวอย่างที่โชว์มาจาก `previewCatEdit` ซึ่งเรียก `applyCatEdit` ตัวเดียวกับที่ตอนบันทึกใช้จริง
 * ที่เห็นกับที่ได้จึงตรงกันเสมอ (ดู `lib/core/cats.ts`)
 */
export function useCatEditor({ selectedItems, suggestions, apply, onDone }: Options) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState<string[]>([]);
  /** เพิ่ม/เอาออก/แทนที่ — ตั้งต้นที่ "เพิ่ม" เพราะเป็นงานที่ทำบ่อยสุดและเป็นทางเดียวที่ไม่ลบหมวดเดิมของใครทิ้ง */
  const [mode, setMode] = useState<CatEditMode>("add");

  const openPrompt = () => {
    setMode("add");
    setValue([]);
    setOpen(true);
  };

  /** สลับโหมดแล้วล้างที่เลือกไว้ทิ้ง เพราะหมวดที่เลือกไว้เพื่อ "เพิ่ม" กลายเป็นหมวดที่จะ "ลบ" ทันทีถ้าเก็บไว้ */
  const changeMode = (next: CatEditMode) => {
    setMode(next);
    // โหมดแทนที่เริ่มจากหมวดที่ทุกชิ้นมีเหมือนกัน จะได้แก้ต่อจากของเดิมแทนที่จะเริ่มจากว่าง
    setValue(next === "replace" ? commonCats(selectedItems.map((i) => i.cats)) : []);
  };

  /** ตัวอย่างผลลัพธ์ของทุกชิ้นที่เลือก */
  const preview = useMemo(
    () => selectedItems.map((item) => ({ item, ...previewCatEdit(item.cats, value, mode) })),
    [selectedItems, value, mode],
  );

  const confirm = () => {
    apply(value, mode);
    setOpen(false);
    onDone();
  };

  return {
    open, openPrompt, close: () => setOpen(false),
    mode, changeMode,
    value, setValue,
    // โหมด "เอาออก" ให้เลือกได้เฉพาะหมวดที่ของกลุ่มนี้ใช้อยู่จริง จะได้ไม่ต้องงมในลิสต์ยาวๆ ที่กดแล้วไม่มีอะไรเกิดขึ้น
    options: mode === "remove" ? catsInUse(selectedItems.map((i) => i.cats)) : suggestions,
    preview,
    changedCount: preview.filter((p) => p.changed).length,
    meta: CAT_EDIT_MODES.find((m) => m.key === mode) ?? CAT_EDIT_MODES[0],
    confirm,
  };
}
