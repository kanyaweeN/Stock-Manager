"use client";

import { useEffect, useState } from "react";
import { STATUS_OPTIONS } from "@/lib/statusOptions";
import CategoryDatalist from "@/components/CategoryDatalist";
import TextField from "@/components/TextField";
import type { ItemStatus, StockItem } from "@/lib/types";

interface Props {
  open: boolean;
  item: StockItem | null;
  categories: string[];
  onClose: () => void;
  onSave: (data: Omit<StockItem, "id">, editId: string | null) => void;
}

const emptyForm = {
  name: "", cat: "", qty: 0, min: 0, price: "", size: "", note: "", img: "", link: "", status: "" as ItemStatus,
};

export default function ProductModal({ open, item, categories, onClose, onSave }: Props) {
  const [form, setForm] = useState(emptyForm);

  useEffect(() => {
    if (item) {
      setForm({
        name: item.name,
        cat: item.cat,
        qty: item.qty,
        min: item.min,
        price: item.price != null ? String(item.price) : "",
        size: item.size || "",
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
        price: form.price.trim() ? Math.max(0, Number(form.price) || 0) : undefined,
        size: form.size.trim(),
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

        <TextField
          label="ชื่อสินค้า"
          autoFocus
          placeholder="เช่น กระดาษ A4"
          value={form.name}
          onChange={(v) => setForm({ ...form, name: v })}
        />

        <TextField
          label="หมวดหมู่"
          placeholder="เช่น เครื่องเขียน"
          list="catList"
          value={form.cat}
          onChange={(v) => setForm({ ...form, cat: v })}
        />
        <CategoryDatalist id="catList" categories={categories} />

        <TextField
          label="จำนวน"
          type="number"
          value={String(form.qty)}
          onChange={(v) => setForm({ ...form, qty: Number(v) || 0 })}
        />

        <TextField
          label="แจ้งเตือนเมื่อต่ำกว่า"
          type="number"
          value={String(form.min)}
          onChange={(v) => setForm({ ...form, min: Number(v) || 0 })}
        />

        <TextField
          label="ราคา (บาท)"
          type="number"
          placeholder="ไม่บังคับ"
          value={form.price}
          onChange={(v) => setForm({ ...form, price: v })}
        />

        <TextField
          label="ขนาด"
          placeholder="เช่น S, M, L หรือ 10x15 ซม. (ไม่บังคับ)"
          value={form.size}
          onChange={(v) => setForm({ ...form, size: v })}
        />

        <TextField
          label="หมายเหตุ"
          placeholder="ไม่บังคับ"
          value={form.note}
          onChange={(v) => setForm({ ...form, note: v })}
        />

        <TextField
          label="รูปภาพ (URL)"
          placeholder="วางลิงก์รูปภาพ (ไม่บังคับ)"
          value={form.img}
          onChange={(v) => setForm({ ...form, img: v })}
        />
        {form.img && (
          <div className="field">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="img-preview" src={form.img} alt="" />
          </div>
        )}

        <TextField
          label="ลิงก์สินค้า"
          placeholder="วางลิงก์หน้าสินค้า (ไม่บังคับ)"
          value={form.link}
          onChange={(v) => setForm({ ...form, link: v })}
        />

        <div className="field">
          <label>สถานะ</label>
          <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as ItemStatus })}>
            {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
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
