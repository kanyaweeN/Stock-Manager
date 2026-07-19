"use client";

import { useState } from "react";
import { extractShopeeItems } from "@/lib/shopee";
import type { ImportCandidate, ItemStatus } from "@/lib/types";

interface Props {
  open: boolean;
  categories: string[];
  onClose: () => void;
  onImport: (candidates: ImportCandidate[]) => void;
}

const STATUS_OPTIONS: { v: ItemStatus; l: string }[] = [
  { v: "", l: "ไม่ระบุ" },
  { v: "rebuy", l: "ซื้อซ้ำได้" },
  { v: "avoid", l: "ไม่ควรซื้อ" },
  { v: "have", l: "ได้ของอยู่แล้ว" },
];

export default function ImportModal({ open, categories, onClose, onImport }: Props) {
  const [html, setHtml] = useState("");
  const [candidates, setCandidates] = useState<ImportCandidate[]>([]);

  if (!open) return null;

  const handleParse = () => setCandidates(extractShopeeItems(html));

  const updateCandidate = (idx: number, patch: Partial<ImportCandidate>) => {
    setCandidates((prev) => prev.map((c, i) => (i === idx ? { ...c, ...patch } : c)));
  };

  const handleClose = () => {
    setHtml("");
    setCandidates([]);
    onClose();
  };

  const handleConfirm = () => {
    const chosen = candidates.filter((c) => c.include && c.name.trim());
    onImport(chosen);
    handleClose();
  };

  return (
    <div className="modal-backdrop open" onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}>
      <div className="modal modal-wide">
        <h2>นำเข้ารายการจาก Shopee</h2>
        <p className="sub" style={{ marginTop: -8 }}>
          เปิดหน้า &quot;คำสั่งซื้อของฉัน&quot; ใน Shopee กด Ctrl+U หรือคลิกขวา &gt; &quot;ดูซอร์สหน้าเว็บ&quot; (View Page Source)
          แล้วคัดลอกโค้ด HTML ทั้งหมดมาวางในกล่องด้านล่าง ระบบจะพยายามดึงชื่อสินค้า จำนวน และรูปภาพให้อัตโนมัติ —
          กรุณาตรวจสอบและแก้ไขรายการก่อนนำเข้าจริง เพราะโครงสร้างหน้าเว็บของ Shopee อาจไม่แน่นอน
        </p>
        <div className="field">
          <textarea
            className="import-textarea"
            placeholder="วางโค้ด HTML ของหน้าออเดอร์ Shopee ที่นี่..."
            value={html}
            onChange={(e) => setHtml(e.target.value)}
          />
        </div>
        <div className="modal-actions modal-actions-inline">
          <button className="btn-primary" onClick={handleParse}>แยกรายการ</button>
        </div>

        <div className="import-list-wrap">
          {candidates.map((c, idx) => (
            <div className="import-row" key={idx}>
              <input
                type="checkbox"
                checked={c.include}
                onChange={(e) => updateCandidate(idx, { include: e.target.checked })}
              />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={c.img}
                alt=""
                onError={(e) => { (e.currentTarget as HTMLImageElement).style.visibility = "hidden"; }}
              />
              <div className="import-fields">
                <input
                  type="text"
                  placeholder="ชื่อสินค้า"
                  value={c.name}
                  onChange={(e) => updateCandidate(idx, { name: e.target.value })}
                />
                <input
                  type="text"
                  placeholder="หมวดหมู่ (ไม่บังคับ)"
                  list="import-cat-list"
                  value={c.cat}
                  onChange={(e) => updateCandidate(idx, { cat: e.target.value })}
                />
                <div className="import-qty">
                  จำนวน
                  <input
                    type="number"
                    min={0}
                    value={c.qty}
                    onChange={(e) => updateCandidate(idx, { qty: Math.max(0, parseInt(e.target.value) || 0) })}
                  />
                  <select value={c.status} onChange={(e) => updateCandidate(idx, { status: e.target.value as ItemStatus })}>
                    {STATUS_OPTIONS.map((o) => <option key={o.v} value={o.v}>{o.l}</option>)}
                  </select>
                </div>
              </div>
            </div>
          ))}
        </div>
        {candidates.length === 0 && (
          <div className="empty" style={{ padding: 16 }}>ยังไม่พบรายการสินค้า — วางโค้ด HTML แล้วกด &quot;แยกรายการ&quot;</div>
        )}
        <datalist id="import-cat-list">
          {categories.map((c) => <option key={c} value={c} />)}
        </datalist>

        <div className="modal-actions">
          <button className="btn-ghost" onClick={handleClose}>ยกเลิก</button>
          <button className="btn-primary" onClick={handleConfirm}>นำเข้ารายการที่เลือก</button>
        </div>
      </div>
    </div>
  );
}
