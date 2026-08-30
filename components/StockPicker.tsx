"use client";

import { useState } from "react";
import { searchStockItems } from "@/lib/domain/stockSearch";
import type { StockItem } from "@/lib/types";

/**
 * กล่อง "เลือกจากสต็อก" ที่ใช้ร่วมกันทุกที่ — โครง `.stock-picker` เดิมถูกก๊อปไว้ 4 ชุด
 * (สูตรต้นทุน, แผนซื้อของ, รายการที่แนะนำในแผน, กล่องเลือกสูตร/แผนในหน้าแรก) พร้อม
 * ท่ารูปย่อ + `eslint-disable` ของ `<img>` ที่เหมือนกันเป๊ะ
 *
 * แถวของกล่องพวกนี้ต่างกันแค่ "ข้อความด้านขวา" (`meta`) เท่านั้น ตัวโครงจึงรวมมาไว้ที่เดียว
 */

/** แถว 1 แถวในกล่องเลือก — รูปย่อ + ชื่อ + ข้อความสรุปด้านขวา */
export function StockPickerRow({
  img, name, meta, onClick,
}: {
  img?: string;
  name: React.ReactNode;
  meta: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button className="stock-picker__row" onClick={onClick}>
      {img ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img className="stock-picker__thumb" src={img} alt="" />
      ) : (
        <span className="stock-picker__thumb stock-picker__thumb--empty">📦</span>
      )}
      <span className="stock-picker__name">{name}</span>
      <span className="stock-picker__meta">{meta}</span>
    </button>
  );
}

/** ข้อความตอนไม่มีแถวให้เลือก — ขนาด/ระยะห่างเท่ากันทุกกล่อง */
export function StockPickerEmpty({ children }: { children: React.ReactNode }) {
  return <div className="empty" style={{ padding: 14, fontSize: 12 }}>{children}</div>;
}

/** เปลือกของกล่องเลือก — แถบหัว (ช่องค้นหา/ปุ่ม) + รายการที่เลื่อนได้ */
export function StockPickerShell({
  head, children, footer,
}: {
  head: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div className="stock-picker">
      <div className="stock-picker__head">{head}</div>
      <div className="stock-picker__list">{children}</div>
      {footer}
    </div>
  );
}

interface Props {
  items: StockItem[];
  onPick: (item: StockItem) => void;
  onClose: () => void;
  /** ข้อความสรุปด้านขวาของแต่ละแถว — แต่ละหน้าสนใจคนละอย่าง (ขนาดบรรจุ / ขั้นต่ำ) */
  meta: (item: StockItem) => React.ReactNode;
  /** ของที่แปะไว้หน้าชื่อ เช่น ✓ ของที่อยู่ในแผนนี้แล้ว */
  namePrefix?: (item: StockItem) => React.ReactNode;
  /** ข้อความตอน "สต็อกว่างเปล่า" — ต่างจาก "ค้นแล้วไม่เจอ" ตรงที่ทางออกคนละทาง */
  emptyStockText: string;
  footer?: React.ReactNode;
}

/**
 * กล่องค้นหาสินค้าในสต็อก — **ถือคำค้นไว้เอง** ผู้เรียกจึงไม่ต้องมี state คำค้น
 * กับตัวรีเซ็ตมันตอนเปิด/ปิดกล่องอีก (ปิดกล่อง = ตัวนี้ถูกถอด คำค้นหายไปเอง)
 */
export default function StockPicker({
  items, onPick, onClose, meta, namePrefix, emptyStockText, footer,
}: Props) {
  const [query, setQuery] = useState("");
  const results = searchStockItems(items, query);

  return (
    <StockPickerShell
      footer={footer}
      head={
        <>
          <input
            type="text"
            autoFocus
            placeholder="ค้นหาชื่อสินค้าในสต็อก / หมวดหมู่..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <button className="btn-ghost btn-sm" onClick={onClose}>ปิด</button>
        </>
      }
    >
      {results.map((i) => (
        <StockPickerRow
          key={i.id}
          img={i.img}
          onClick={() => onPick(i)}
          name={
            <>
              {namePrefix?.(i)}
              {i.name}
              {i.variant && <small> · {i.variant}</small>}
            </>
          }
          meta={meta(i)}
        />
      ))}
      {results.length === 0 && (
        <StockPickerEmpty>{items.length === 0 ? emptyStockText : "ไม่เจอสินค้าที่ค้นหา"}</StockPickerEmpty>
      )}
    </StockPickerShell>
  );
}
