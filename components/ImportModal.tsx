"use client";

import { useState } from "react";
import { extractShopeeItems } from "@/lib/shopee";
import { STATUS_OPTIONS } from "@/lib/statusOptions";
import CategoryDatalist from "@/components/CategoryDatalist";
import { PasteIcon } from "@/components/icons";
import type { ImportCandidate, ItemStatus, StockItem } from "@/lib/types";

interface Props {
  open: boolean;
  categories: string[];
  items: StockItem[];
  onClose: () => void;
  onImport: (candidates: ImportCandidate[]) => void;
}

function norm(s: string) {
  return s.trim().toLowerCase();
}

/** เช็คว่าสินค้าที่แยกได้ตรงกับสินค้าที่มีอยู่แล้วไหม (ดูจากลิงก์ก่อน ถ้าไม่มีลิงก์ค่อยดูชื่อ) — เผื่อกรณีซื้อซ้ำ */
function findExisting(c: ImportCandidate, items: StockItem[]): StockItem | undefined {
  if (c.link) {
    const byLink = items.find((i) => i.link && norm(i.link) === norm(c.link));
    if (byLink) return byLink;
  }
  return items.find((i) => norm(i.name) === norm(c.name));
}

export default function ImportModal({ open, categories, items, onClose, onImport }: Props) {
  const [html, setHtml] = useState("");
  const [candidates, setCandidates] = useState<ImportCandidate[]>([]);

  if (!open) return null;

  const handleParse = () => {
    const parsed = extractShopeeItems(html).map((c) => {
      const existing = findExisting(c, items);
      return existing ? { ...c, existingId: existing.id, mergeExisting: true } : c;
    });
    setCandidates(parsed);
  };

  const updateCandidate = (idx: number, patch: Partial<ImportCandidate>) => {
    setCandidates((prev) => prev.map((c, i) => (i === idx ? { ...c, ...patch } : c)));
  };

  const handleClose = () => {
    setHtml("");
    setCandidates([]);
    onClose();
  };

  const pasteHtml = async () => {
    try {
      const text = await navigator.clipboard.readText();
      setHtml(text);
    } catch {
      alert("วางจากคลิปบอร์ดไม่ได้ — เบราว์เซอร์ไม่อนุญาต ลองกด Ctrl+V ในกล่องข้อความแทน");
    }
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
          <button className="btn-ghost btn-icon-label" onClick={pasteHtml}>
            <PasteIcon /> วาง
          </button>
          <button className="btn-primary" onClick={handleParse}>แยกรายการ</button>
        </div>

        <div className="import-list-wrap">
          {candidates.map((c, idx) => {
            const existingItem = c.existingId ? items.find((i) => i.id === c.existingId) : undefined;
            return (
              <div className={`import-row ${existingItem ? "import-row--dup" : ""}`} key={idx}>
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
                  {existingItem && (
                    <label className="dup-note">
                      <input
                        type="checkbox"
                        checked={!!c.mergeExisting}
                        onChange={(e) => updateCandidate(idx, { mergeExisting: e.target.checked })}
                      />
                      🔁 ซื้อซ้ำ — มีอยู่แล้ว {existingItem.qty} ชิ้น {c.mergeExisting ? "(จะรวมจำนวนเข้าเดิม)" : "(จะเพิ่มเป็นรายการใหม่)"}
                    </label>
                  )}
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
                  <input
                    type="text"
                    placeholder="แท็กรอง เช่น ตัวเลือกสินค้า/สี/รุ่น (ไม่บังคับ)"
                    value={c.variant || ""}
                    onChange={(e) => updateCandidate(idx, { variant: e.target.value })}
                  />
                  <div className="import-qty">
                    จำนวน
                    <input
                      type="number"
                      min={0}
                      value={c.qty}
                      onChange={(e) => updateCandidate(idx, { qty: Math.max(0, parseInt(e.target.value) || 0) })}
                    />
                    ราคา
                    <input
                      type="number"
                      min={0}
                      placeholder="฿"
                      value={c.price ?? ""}
                      onChange={(e) => updateCandidate(idx, { price: e.target.value ? Math.max(0, parseFloat(e.target.value)) : undefined })}
                    />
                    <select value={c.status} onChange={(e) => updateCandidate(idx, { status: e.target.value as ItemStatus })}>
                      {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        {candidates.length === 0 && (
          <div className="empty" style={{ padding: 16 }}>ยังไม่พบรายการสินค้า — วางโค้ด HTML แล้วกด &quot;แยกรายการ&quot;</div>
        )}
        <CategoryDatalist id="import-cat-list" categories={categories} />

        <div className="modal-actions">
          <button className="btn-ghost" onClick={handleClose}>ยกเลิก</button>
          <button className="btn-primary" onClick={handleConfirm}>นำเข้ารายการที่เลือก</button>
        </div>
      </div>
    </div>
  );
}
