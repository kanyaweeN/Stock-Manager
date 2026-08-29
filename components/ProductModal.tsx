"use client";

import { useEffect, useState } from "react";
import { STATUS_OPTIONS } from "@/lib/statusOptions";
import CategoryMultiSelect from "@/components/CategoryMultiSelect";
import IngredientInput from "@/components/IngredientInput";
import IngredientPanel from "@/components/IngredientPanel";
import ModalShell from "@/components/ModalShell";
import { fromProductForm, toProductForm, type ProductForm } from "@/lib/productForm";
import TextField from "@/components/TextField";
import { baht } from "@/lib/cost";
import { todayISO, formatThaiShortDate } from "@/lib/date";
import { effectiveExpiry, expiryLabel } from "@/lib/expiry";
import { daysUntilEmpty, usageStats } from "@/lib/usage";
import type { SkinProfile } from "@/lib/db";
import { priceStats, pushPricePoint } from "@/lib/price";
import type { ItemStatus, StockItem } from "@/lib/types";

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

export default function ProductModal({ open, item, categories, avoidIngredients, skinProfile, onClose, onSave, onUngroup }: Props) {
  const [form, setForm] = useState<ProductForm>(() => toProductForm(null));

  useEffect(() => setForm(toProductForm(item)), [item, open]);

  const stats = priceStats(form.priceHistory);
  // เตือนตั้งแต่ในฟอร์มว่าวันไหนคือวันที่ "ใช้จริง" — ฉลากกับ PAO มักไม่ตรงกัน (ดู lib/expiry.ts)
  const usage = item ? usageStats(item) : null;
  const runoutDays = item
    ? daysUntilEmpty({
        qty: Number(form.qty) || 0,
        openPct: form.openPct.trim() === "" ? undefined : Number(form.openPct) || 0,
        usageLog: item.usageLog,
      })
    : null;
  const expiryPreview = effectiveExpiry({
    expiryAt: form.expiryAt,
    openedAt: form.openedAt,
    paoMonths: Number(form.paoMonths) || undefined,
  });

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
    if (!form.name.trim()) return;
    onSave(fromProductForm(form, item), item ? item.id : null);
  };

  return (
    <ModalShell open={open} title={item ? "แก้ไขสินค้า" : "เพิ่มสินค้า"} onClose={onClose}>
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
          value={form.qty}
          onChange={(v) => setForm({ ...form, qty: v })}
        />

        <TextField
          label="แจ้งเตือนเมื่อต่ำกว่า"
          type="number"
          value={form.min}
          onChange={(v) => setForm({ ...form, min: v })}
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
          <label>การใช้งาน</label>
          {usage ? (
            <p className="sub text-xs">
              ใช้ไปประมาณวันละ <strong>{usage.perDay.toFixed(2)}</strong> ชิ้น (จาก {usage.used} ชิ้นใน {usage.days} วัน)
              {runoutDays != null && <> — ของที่เหลือพอใช้อีกราว <strong>{runoutDays} วัน</strong></>}
              {form.openPct.trim() !== "" && <> (นับเศษของขวดที่เปิดอยู่แล้ว)</>}
            </p>
          ) : (
            <p className="sub text-xs">
              ยังคำนวณไม่ได้ — ระบบจดให้อัตโนมัติทุกครั้งที่กด ＋/− บนการ์ดสินค้า
              พอมีข้อมูลสัก 2 ครั้งห่างกันเกิน 1 สัปดาห์ จะบอกได้ว่าของจะหมดอีกกี่วัน
            </p>
          )}
        </div>

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
          label="1 แพ็ค/ขวดได้ปริมาณเท่าไร"
          type="number"
          placeholder="ไม่บังคับ — เช่น 1000 (ถ้าไม่กรอก /cost จะเดาจากช่องขนาด)"
          value={form.packAmount}
          onChange={(v) => setForm({ ...form, packAmount: v })}
        />

        <TextField
          label="หน่วย"
          placeholder="เช่น g, ml, ชิ้น"
          value={form.unit}
          onChange={(v) => setForm({ ...form, unit: v })}
        />

        <TextField
          label="ขวด/แพ็คที่เปิดอยู่ เหลือกี่ %"
          type="number"
          placeholder="ไม่บังคับ — ไม่กรอก = ถือว่าเต็มทุกขวด"
          value={form.openPct}
          onChange={(v) => setForm({ ...form, openPct: v })}
        />

        <TextField
          label="ปกติซื้อทีละกี่ชิ้น/แพ็ค"
          type="number"
          placeholder="ไม่บังคับ — ใช้เติมจำนวนให้ตอนใส่ในแผนซื้อของ"
          value={form.reorderQty}
          onChange={(v) => setForm({ ...form, reorderQty: v })}
        />

        <TextField
          label="เก็บไว้ตรงไหน"
          placeholder="เช่น ลิ้นชักบน, ตู้ห้องนอน (ค้นหาเจอด้วยช่องค้นหา)"
          value={form.location}
          onChange={(v) => setForm({ ...form, location: v })}
        />

        <TextField
          label="ร้านที่ซื้อ"
          placeholder="ไม่บังคับ — นำเข้าจาก Shopee จะเติมให้เอง"
          value={form.shop}
          onChange={(v) => setForm({ ...form, shop: v })}
        />

        <div className="field">
          <label>วันหมดอายุ (ตามฉลาก)</label>
          <input
            type="date"
            value={form.expiryAt}
            onChange={(e) => setForm({ ...form, expiryAt: e.target.value })}
          />
        </div>

        <div className="field">
          <label>วันที่เปิดใช้</label>
          <input
            type="date"
            value={form.openedAt}
            onChange={(e) => setForm({ ...form, openedAt: e.target.value })}
          />
        </div>

        <TextField
          label="เปิดแล้วใช้ได้กี่เดือน (PAO)"
          type="number"
          placeholder="ดูสัญลักษณ์กระปุกเปิดฝาข้างขวด เช่น 12M ให้ใส่ 12"
          value={form.paoMonths}
          onChange={(v) => setForm({ ...form, paoMonths: v })}
        />

        {expiryPreview && (
          <div className={`expiry-note ${expiryPreview.expired ? "is-expired" : expiryPreview.soon ? "is-soon" : "is-ok"}`}>
            <span>{expiryPreview.expired ? "⛔" : expiryPreview.soon ? "⏰" : "✅"}</span>
            <span>
              หมดอายุจริง <strong>{formatThaiShortDate(expiryPreview.date) || expiryPreview.date}</strong>{" "}
              ({expiryLabel(expiryPreview)}) —{" "}
              {expiryPreview.source === "pao"
                ? "นับจากวันที่เปิดใช้ ซึ่งมาถึงก่อนวันบนฉลาก"
                : "ตามวันที่บนฉลาก"}
            </span>
          </div>
        )}

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
    </ModalShell>
  );
}
