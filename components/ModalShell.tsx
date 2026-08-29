"use client";

import { useEffect, useId, useRef } from "react";

interface Props {
  open: boolean;
  /** ข้อความหัวเรื่อง — ผูกเป็น `aria-labelledby` ให้ screen reader อ่านว่ากล่องนี้คืออะไร */
  title: string;
  onClose: () => void;
  /** กล่องกว้าง (`.modal-wide`) สำหรับหน้าที่มีตาราง/หลายคอลัมน์ */
  wide?: boolean;
  /** คลิกพื้นหลังแล้วปิด — เปิดเฉพาะกล่องที่ "ดูเฉยๆ" ไม่ใช่กล่องที่กำลังกรอกฟอร์มค้างอยู่ */
  closeOnBackdrop?: boolean;
  /** ของที่ต้องแทรกในแถบหัวเรื่องก่อนชื่อ (เช่น ปุ่มย้อนกลับ) */
  headerBefore?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}

/** ตัวที่โฟกัสได้ทั้งหมดในกล่อง — ใช้คำนวณขอบของวงโฟกัสตอนกด Tab */
const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * เปลือกของกล่องโมดัลทุกอันในแอป — โครง `.modal-backdrop > .modal > .modal-header`
 * เดิมถูกก๊อปไว้ 5 ไฟล์พร้อม `useEffect` ดักปุ่ม Escape ที่เหมือนกันเป๊ะ
 *
 * รวมมาไว้ที่เดียวแล้วได้ของที่ทุกกล่องขาดไปด้วย:
 * - `role="dialog"` + `aria-modal` + `aria-labelledby` (เดิมเป็น `<div>` เปล่าๆ screen reader
 *   อ่านไม่ออกว่ามีกล่องเปิดอยู่)
 * - **กักโฟกัสไว้ในกล่อง** — เดิมกด Tab แล้วโฟกัสหลุดไปโดนปุ่มที่อยู่หลังฉากมืดได้
 * - **คืนโฟกัสกลับที่เดิมตอนปิด** — เดิมปิดกล่องแล้วโฟกัสหายไปอยู่ที่ `<body>` กด Tab ต่อ
 *   ก็เริ่มใหม่จากบนสุดของหน้า
 */
export default function ModalShell({
  open, title, onClose, wide, closeOnBackdrop, headerBefore, className = "", children,
}: Props) {
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  /** ตัวที่โฟกัสอยู่ก่อนเปิดกล่อง — ไว้คืนโฟกัสให้ตอนปิด */
  const returnFocusRef = useRef<Element | null>(null);

  useEffect(() => {
    if (!open) return;
    returnFocusRef.current = document.activeElement;
    // ถ้าในกล่องมี autoFocus อยู่แล้วก็ปล่อยให้มันทำงาน ไม่แย่งโฟกัสไปที่กรอบ
    const t = setTimeout(() => {
      const panel = panelRef.current;
      if (panel && !panel.contains(document.activeElement)) panel.focus();
    }, 0);
    return () => {
      clearTimeout(t);
      const back = returnFocusRef.current;
      if (back instanceof HTMLElement && document.contains(back)) back.focus();
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key !== "Tab") return;
      const panel = panelRef.current;
      if (!panel) return;
      const targets = [...panel.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => el.offsetParent !== null);
      if (targets.length === 0) return;
      const first = targets[0];
      const last = targets[targets.length - 1];
      // วนกลับหัวท้าย ไม่ให้โฟกัสหลุดออกไปโดนของหลังฉากมืด
      if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      } else if (e.shiftKey && (document.activeElement === first || document.activeElement === panel)) {
        e.preventDefault();
        last.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="modal-backdrop open"
      onClick={closeOnBackdrop ? onClose : undefined}
    >
      <div
        ref={panelRef}
        className={`modal ${wide ? "modal-wide" : ""} ${className}`.trim()}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          {headerBefore}
          <h2 id={titleId}>{title}</h2>
          <button className="modal-close" title="ปิด" aria-label="ปิด" onClick={onClose}>×</button>
        </div>
        {children}
      </div>
    </div>
  );
}
