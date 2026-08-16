"use client";

import { useEffect, useState } from "react";
import { STATUS_OPTIONS } from "@/lib/statusOptions";
import CategoryMultiSelect from "@/components/CategoryMultiSelect";
import IngredientInput from "@/components/IngredientInput";
import IngredientPanel from "@/components/IngredientPanel";
import TextField from "@/components/TextField";
import { baht } from "@/lib/cost";
import { todayISO } from "@/lib/date";
import type { SkinProfile } from "@/lib/db";
import { priceStats, pushPricePoint } from "@/lib/price";
import type { ItemStatus, PricePoint, StockItem } from "@/lib/types";

interface Props {
  open: boolean;
  item: StockItem | null;
  categories: string[];
  avoidIngredients?: string[];
  skinProfile?: SkinProfile;
  onClose: () => void;
  onSave: (data: Omit<StockItem, "id">, editId: string | null) => void;
  onUngroup: (id: string) => void;
}

const todayStr = () => todayISO();

const emptyForm = {
  name: "", cats: [] as string[], qty: 0, min: 0, price: "", buyQty: "", size: "", note: "", img: "", link: "", status: "" as ItemStatus,
  purchasedAt: todayStr(), ingredients: "", priceHistory: [] as PricePoint[],
};

export default function ProductModal({ open, item, categories, avoidIngredients, skinProfile, onClose, onSave, onUngroup }: Props) {
  const [form, setForm] = useState(emptyForm);

  useEffect(() => {
    if (item) {
      setForm({
        name: item.name,
        cats: item.cats,
        qty: item.qty,
        min: item.min,
        price: item.price != null ? String(item.price) : "",
        buyQty: item.buyQty != null ? String(item.buyQty) : "",
        size: item.size || "",
        note: item.note,
        img: item.img || "",
        link: item.link || "",
        status: item.status || "",
        purchasedAt: item.purchasedAt || "",
        ingredients: item.ingredients || "",
        priceHistory: item.priceHistory || [],
      });
    } else {
      setForm({ ...emptyForm, purchasedAt: todayStr() });
    }
  }, [item, open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const stats = priceStats(form.priceHistory);

  const removePricePoint = (idx: number) => {
    setForm((f) => ({ ...f, priceHistory: f.priceHistory.filter((_, i) => i !== idx) }));
  };

  /** จดราคาที่กรอกอยู่ตอนนี้ลงประวัติ — ใช้ตอนกรอกสินค้าเองโดยไม่ได้นำเข้าจาก Shopee */
  const logCurrentPrice = () => {
    const price = Number(form.price);
    if (!form.price.trim() || !Number.isFinite(price)) return;
    setForm((f) => ({
      ...f,
      priceHistory: pushPricePoint(f.priceHistory, {
        date: f.purchasedAt || todayStr(),
        price: Math.max(0, price),
        qty: Math.max(1, Number(f.buyQty) || 1),
      }),
    }));
  };

  const handleSave = () => {
    const name = form.name.trim();
    if (!name) return;
    onSave(
      {
        name,
        cats: form.cats,
        qty: Math.max(0, Number(form.qty) || 0),
        min: Math.max(0, Number(form.min) || 0),
        price: form.price.trim() ? Math.max(0, Number(form.price) || 0) : undefined,
        buyQty: form.buyQty.trim() ? Math.max(0, Number(form.buyQty) || 0) : undefined,
        priceHistory: form.priceHistory,
        // บันทึกเอง = ผู้ใช้ตรวจราคาแล้ว ปลดธง "ยังไม่ยืนยัน" ของข้อมูลเก่าทิ้ง
        priceUnverified: undefined,
        size: form.size.trim(),
        note: form.note.trim(),
        img: form.img.trim(),
        link: form.link.trim(),
        status: form.status,
        purchasedAt: form.purchasedAt || undefined,
        ingredients: form.ingredients.trim(),
      },
      item ? item.id : null
    );
  };

  return (
    <div className="modal-backdrop open">
      <div className="modal">
        <div className="modal-header">
          <h2>{item ? "แก้ไขสินค้า" : "เพิ่มสินค้า"}</h2>
          <button className="modal-close" title="ปิด" onClick={onClose}>×</button>
        </div>

        <div className="modal-body">
        <TextField
          label="ชื่อสินค้า"
          autoFocus
          placeholder="เช่น กระดาษ A4"
          value={form.name}
          onChange={(v) => setForm({ ...form, name: v })}
        />

        <div className="field">
          <label>หมวดหมู่</label>
          <CategoryMultiSelect
            categories={categories}
            selected={form.cats}
            onChange={(cats) => setForm({ ...form, cats })}
            allowCreate
            emptyLabel="ไม่มีหมวดหมู่"
          />
        </div>

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

        <div className="field">
          <label>วันที่ซื้อ</label>
          <input
            type="date"
            value={form.purchasedAt}
            onChange={(e) => setForm({ ...form, purchasedAt: e.target.value })}
          />
        </div>

        {item?.priceUnverified && (
          <div className="price-unverified">
            <span>⚠️</span>
            <span>
              ราคานี้นำเข้าจาก Shopee ด้วยเวอร์ชันเก่า ที่เก็บ<strong>ยอดรวมทั้งแถว</strong>ไว้ในช่องราคา
              ถ้าตอนนั้นซื้อมามากกว่า 1 ชิ้น ให้หารด้วยจำนวนที่ซื้อก่อน แล้วกดบันทึก — คำเตือนนี้จะหายไปเอง
              (มูลค่าสต็อกในหน้าสรุปและต้นทุนในสูตรคิดจากราคา<strong>ต่อชิ้น</strong>)
            </span>
          </div>
        )}

        <TextField
          label="ราคาต่อ 1 ชิ้น/แพ็ค (บาท)"
          type="number"
          placeholder="ไม่บังคับ"
          value={form.price}
          onChange={(v) => setForm({ ...form, price: v })}
        />

        <TextField
          label="ซื้อครั้งล่าสุดกี่ชิ้น/แพ็ค"
          type="number"
          placeholder="ไม่บังคับ — ใช้โชว์ยอดที่จ่ายจริง"
          value={form.buyQty}
          onChange={(v) => setForm({ ...form, buyQty: v })}
        />

        <div className="field">
          <label>ประวัติราคา</label>
          {stats ? (
            <>
              <div className="price-stats">
                <span className="price-stats__avg">เฉลี่ย <strong>{baht(stats.avg)}</strong> /ชิ้น</span>
                {stats.min !== stats.max && <span>ต่ำสุด {baht(stats.min)} · สูงสุด {baht(stats.max)}</span>}
                <span>ซื้อ {stats.times} ครั้ง · รวม {stats.totalQty} ชิ้น · จ่ายไป {baht(stats.totalSpent)}</span>
              </div>
              <ul className="price-history">
                {form.priceHistory.map((p, idx) => (
                  <li className="price-history__row" key={`${p.date}-${idx}`}>
                    <span className="price-history__date">{p.date || "ไม่ทราบวันที่"}</span>
                    <span className="price-history__price">{baht(p.price)}/ชิ้น</span>
                    <span className="price-history__qty">× {p.qty}</span>
                    <span className="price-history__total">= {baht(p.price * p.qty)}</span>
                    <button
                      type="button"
                      className="icon-btn del"
                      title="ลบรายการนี้ออกจากประวัติ"
                      onClick={() => removePricePoint(idx)}
                    >
                      🗑️
                    </button>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="sub text-xs">ยังไม่มีประวัติ — ระบบจะจดให้อัตโนมัติทุกครั้งที่นำเข้าจาก Shopee</p>
          )}
          <button
            type="button"
            className="btn-ghost btn-sm"
            disabled={!form.price.trim()}
            onClick={logCurrentPrice}
          >
            ＋ จดราคาที่กรอกไว้ลงประวัติ
          </button>
        </div>

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

        <IngredientInput
          value={form.ingredients}
          onChange={(v) => setForm({ ...form, ingredients: v })}
        />
        <IngredientPanel ingredients={form.ingredients} avoidIngredients={avoidIngredients} skinProfile={skinProfile} />

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

        {item?.groupId && (
          <div className="field">
            <label>กลุ่มสินค้า</label>
            <div className="category-row">
              <span>👥 {item.groupName}</span>
              <button className="icon-btn" onClick={() => onUngroup(item.id)}>ออกจากกลุ่ม</button>
            </div>
          </div>
        )}

        </div>
        <div className="modal-actions">
          <button className="btn-ghost" onClick={onClose}>ยกเลิก</button>
          <button className="btn-primary" onClick={handleSave}>บันทึก</button>
        </div>
      </div>
    </div>
  );
}
