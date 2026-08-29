"use client";

import ModalShell from "@/components/ModalShell";
import type { StockItem } from "@/lib/types";

interface Props<T> {
  title: string;
  /** สินค้าที่กำลังจะใส่ — โชว์ให้เห็นว่ากดมาจากอะไรบ้างก่อนเลือกปลายทาง */
  items: StockItem[];
  itemLine: (item: StockItem) => React.ReactNode;
  /** ป้ายเหนือรายการปลายทาง เช่น "เลือกแผนที่มีอยู่" */
  pickLabel: string;
  targets: T[];
  targetKey: (target: T) => string;
  targetName: (target: T) => React.ReactNode;
  targetMeta: (target: T) => React.ReactNode;
  onPick: (target: T) => void;
  /** ป้ายปุ่มสร้างปลายทางใหม่ เช่น "+ แผนใหม่" */
  newLabel: string;
  onNew: () => void;
  onClose: () => void;
}

/**
 * "ใส่ของที่เลือกไว้ในสูตร/แผนไหน?" — กล่องเดียวใช้ได้ทั้งสองทาง
 *
 * เดิมเขียนไว้สองก้อนใน `app/page.tsx` ที่ต่างกันแค่คำและข้อความสรุปของแต่ละแถว และทั้งคู่
 * เขียนโครงโมดัลดิบเองแทนที่จะใช้ `ModalShell` จึงไม่มี Escape/กักโฟกัส/aria เหมือนกล่องอื่น
 */
export default function AddToTargetModal<T>({
  title, items, itemLine, pickLabel, targets, targetKey, targetName, targetMeta, onPick, newLabel, onNew, onClose,
}: Props<T>) {
  return (
    <ModalShell open title={title} onClose={onClose}>
      <div className="modal-body">
        <div className="category-list" style={{ marginBottom: 12 }}>
          {items.map((i) => (
            <div className="category-row" key={i.id}><span>{itemLine(i)}</span></div>
          ))}
        </div>
        <label className="text-xs" style={{ color: "var(--muted)" }}>{pickLabel}</label>
        <div className="stock-picker__list">
          {targets.map((t) => (
            <button className="stock-picker__row" key={targetKey(t)} onClick={() => onPick(t)}>
              <span className="stock-picker__name">{targetName(t)}</span>
              <span className="stock-picker__meta">{targetMeta(t)}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="modal-actions">
        <button className="btn-ghost" onClick={onClose}>ยกเลิก</button>
        <button className="btn-primary" onClick={onNew}>{newLabel}</button>
      </div>
    </ModalShell>
  );
}
