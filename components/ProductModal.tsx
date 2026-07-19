"use client";

import { useEffect, useState } from "react";
import type { ItemStatus, StockItem } from "@/lib/types";

interface Props {
  open: boolean;
  item: StockItem | null;
  categories: string[];
  onClose: () => void;
  onSave: (data: Omit<StockItem, "id">, editId: string | null) => void;
}

const emptyForm = { name: "", cat: "", qty: 0, min: 0, note: "", img: "", link: "", status: "" as ItemStatus };

export default function ProductModal({ open, item, categories, onClose, onSave }: Props) {
  const [form, setForm] = useState(emptyForm);

  useEffect(() => {
    if (item) {
      setForm({
        name: item.name,
        cat: item.cat,
        qty: item.qty,
        min: item.min,
        note: item.note,
        img: item.img || "",
        link: item.link || "",
        status: item.status || "",
      });
    } else {
      setForm(emptyForm);
    }
  }, [item, open]);

  if (!open) return null;

  const handleSave = () => {
    const name = form.name.trim();
    if (!name) return;
    onSave(
      {
        name,
        cat: form.cat.trim(),
        qty: Math.max(0, Number(form.qty) || 0),
        min: Math.max(0, Number(form.min) || 0),
        note: form.note.trim(),
        img: form.img.trim(),
        link: form.link.trim(),
        status: form.status,
      },
      item ? item.id : null
    );
  };

  return (
    <div className="modal-backdrop open" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal">
        <h2>{item ? "แก้ไขสินค้า" : "เพิ่มสินค้า"}</h2>
        <div className="field">
          <label>ชื่อสินค้า</label>
          <input
            autoFocus
            type="text"
            placeholder="เช่น กระดาษ A4"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
        </div>
        <div className="field">
          <label>หมวดหมู่</label>
          <input
            type="text"
            placeholder="เช่น เครื่องเขียน"
            list="catList"
            value={form.cat}
            onChange={(e) => setForm({ ...form, cat: e.target.value })}
          />
          <datalist id="catList">
            {categories.map((c) => <option key={c} value={c} />)}
          </datalist>
        </div>
        <div className="field">
          <label>จำนวน</label>
          <input type="number" value={form.qty} onChange={(e) => setForm({ ...form, qty: Number(e.target.value) })} />
        </div>
        <div className="field">
          <label>แจ้งเตือนเมื่อต่ำกว่า</label>
          <input type="number" value={form.min} onChange={(e) => setForm({ ...form, min: Number(e.target.value) })} />
        </div>
        <div className="field">
          <label>หมายเหตุ</label>
          <input type="text" placeholder="ไม่บังคับ" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
        </div>
        <div className="field">
          <label>รูปภาพ (URL)</label>
          <input
            type="text"
            placeholder="วางลิงก์รูปภาพ (ไม่บังคับ)"
            value={form.img}
            onChange={(e) => setForm({ ...form, img: e.target.value })}
          />
        </div>
        {form.img && (
          <div className="field">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="img-preview" src={form.img} alt="" />
          </div>
        )}
        <div className="field">
          <label>ลิงก์สินค้า</label>
          <input
            type="text"
            placeholder="วางลิงก์หน้าสินค้า (ไม่บังคับ)"
            value={form.link}
            onChange={(e) => setForm({ ...form, link: e.target.value })}
          />
        </div>
        <div className="field">
          <label>สถานะ</label>
          <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as ItemStatus })}>
            <option value="">ไม่ระบุ</option>
            <option value="rebuy">ซื้อซ้ำได้</option>
            <option value="avoid">ไม่ควรซื้อ</option>
            <option value="have">ได้ของอยู่แล้ว</option>
          </select>
        </div>
        <div className="modal-actions">
          <button className="btn-ghost" onClick={onClose}>ยกเลิก</button>
          <button className="btn-primary" onClick={handleSave}>บันทึก</button>
        </div>
      </div>
    </div>
  );
}
