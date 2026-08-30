"use client";

import type { StockTab } from "@/lib/hooks/useProductFilters";

/** คีย์ของชิป = แท็บสต็อก + "uncategorized" ที่เดิมเป็น toggle แยก ตอนนี้รวมเป็นชุดเดียวเลือกได้ทีละอัน */
export type ChipKey = StockTab | "uncategorized";

export interface ChipCounts {
  all: number;
  totalUnits: number;
  inStock: number;
  low: number;
  outOfStock: number;
  uncategorized: number;
  grouped: number;
  fav: number;
  /** ซื้อซ้ำมาแล้วหลายครั้ง (นับจาก priceHistory ดู lib/domain/price.ts) */
  frequent: number;
  /** หมดอายุแล้ว + ใกล้หมดอายุ (ดู lib/domain/expiry.ts) */
  expiring: number;
  categories: number;
}

interface Props {
  counts: ChipCounts;
  active: ChipKey;
  onSelect: (key: ChipKey) => void;
}

/**
 * แถวตัวเลขที่กดกรองได้ — ยุบ StatsBar (ตัวเลขเฉยๆ) กับ stock-tabs (ปุ่มกรอง) เดิมที่โชว์เลขซ้ำกันให้เหลือแถวเดียว
 * ชิปที่ไม่มี key (รวมทุกชิ้น / หมวดหมู่) เป็นตัวเลขอย่างเดียว กดไม่ได้
 */
export default function FilterChips({ counts, active, onSelect }: Props) {
  const chip = (key: ChipKey, n: number, label: string, tone = "") => (
    <button
      key={key}
      className={`fchip ${tone} ${active === key ? "is-active" : ""}`}
      onClick={() => onSelect(key)}
      aria-pressed={active === key}
    >
      <span className="fchip__n">{n}</span>
      <span className="fchip__l">{label}</span>
    </button>
  );

  return (
    <div className="fchips">
      {chip("all", counts.all, "ทั้งหมด")}
      <div className="fchip fchip--static">
        <span className="fchip__n">{counts.totalUnits}</span>
        <span className="fchip__l">รวมทุกชิ้น</span>
      </div>
      {chip("in-stock", counts.inStock, "มีสินค้า")}
      {chip("low", counts.low, "ใกล้หมด", "fchip--warn")}
      {chip("out-of-stock", counts.outOfStock, "หมดแล้ว", "fchip--danger")}
      {chip("fav", counts.fav, "⭐ ของโปรด", "fchip--fav")}
      {chip("frequent", counts.frequent, "🔁 ซื้อบ่อย", "fchip--repeat")}
      {chip("expiring", counts.expiring, "⏰ ใกล้หมดอายุ", "fchip--expiry")}
      {chip("grouped", counts.grouped, "👥 กลุ่ม", "fchip--violet")}
      {chip("uncategorized", counts.uncategorized, "ไม่มีหมวดหมู่")}
      <div className="fchip fchip--static">
        <span className="fchip__n">{counts.categories}</span>
        <span className="fchip__l">หมวดหมู่</span>
      </div>
    </div>
  );
}
