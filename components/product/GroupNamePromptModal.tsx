"use client";

import { useEffect, useState } from "react";
import ModalShell from "@/components/ui/ModalShell";

interface Props {
  open: boolean;
  title: string;
  /** ค่าเริ่มต้นของช่องชื่อกลุ่ม — ว่างสำหรับการสร้างใหม่, ชื่อเดิมสำหรับการแก้ */
  initialValue?: string;
  /** ปุ่มยืนยัน (default: "บันทึก") — ตอนสร้างกลุ่มใช้ "จัดกลุ่ม" */
  saveLabel?: string;
  /** ส่วน UI เสริมด้านบนช่อง input (เช่น ลิสต์ของที่จะจัดกลุ่ม) — ตอนแก้ชื่อไม่ต้องมี */
  children?: React.ReactNode;
  onSave: (name: string) => void;
  onClose: () => void;
}

/**
 * โมดัลกรอกชื่อกลุ่มสินค้า — ใช้ทั้งตอนสร้างกลุ่มใหม่ (พร้อมลิสต์รายการเป็น children) และตอนแก้ชื่อกลุ่มเดิม
 * เดิมโค้ดโมดัลเหมือนกันเป๊ะ 2 ที่ (page.tsx + ProductGrid) รวมมาที่นี่จะได้ปรับ UX ครั้งเดียวมีผลทั้งคู่
 */
export default function GroupNamePromptModal({ open, title, initialValue = "", saveLabel = "บันทึก", children, onSave, onClose }: Props) {
  const [value, setValue] = useState(initialValue);
  // รีเซ็ตค่าทุกครั้งที่เปิดโมดัลใหม่ — ไม่งั้นตอนเปิดครั้งถัดไปจะเห็นค่าเก่าค้าง
  useEffect(() => { if (open) setValue(initialValue); }, [open, initialValue]);

  if (!open) return null;
  const trimmed = value.trim();
  const submit = () => { if (trimmed) onSave(value); };

  return (
    <ModalShell open title={title} onClose={onClose}>
      <div className="modal-body">
        {children}
        <div className="field">
          <label>ชื่อกลุ่ม</label>
          <input
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
            autoFocus
          />
        </div>
      </div>
      <div className="modal-actions">
        <button className="btn-ghost" onClick={onClose}>ยกเลิก</button>
        <button className="btn-primary" disabled={!trimmed} onClick={submit}>{saveLabel}</button>
      </div>
    </ModalShell>
  );
}
