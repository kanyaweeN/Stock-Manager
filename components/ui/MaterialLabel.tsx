"use client";

import type { RecipeLine, StockItem } from "@/lib/types";

/**
 * รูปย่อของวัตถุดิบ 1 อย่าง — ดึงจากสินค้าในสต็อกที่ผูกไว้ (RecipeLine.itemId)
 * ถ้าไม่ได้ผูกกับสต็อกจะเป็นไอคอน ✏️ ถ้าผูกไว้แต่หาสินค้าไม่เจอแล้วจะเป็น ⚠️
 */
export function MaterialThumb({ item, linked }: { item?: StockItem; linked: boolean }) {
  if (item?.img) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        className="mat-thumb"
        src={item.img}
        alt=""
        title={item.name}
        onError={(e) => { (e.currentTarget as HTMLImageElement).style.visibility = "hidden"; }}
      />
    );
  }
  if (item) return <span className="mat-thumb mat-thumb--empty" title={item.name}>📦</span>;
  if (linked) return <span className="mat-thumb mat-thumb--missing" title="ไม่พบสินค้านี้ในสต็อกแล้ว">⚠️</span>;
  return <span className="mat-thumb mat-thumb--empty" title="วัตถุดิบที่กรอกเอง (ไม่ได้ผูกกับสต็อก)">✏️</span>;
}

/** ชื่อวัตถุดิบพร้อมรูปและข้อมูลจากสต็อก (ขนาด/คงเหลือ) — กดที่ชื่อเพื่อเปิดลิงก์สินค้าถ้ามี */
export default function MaterialLabel({ line, item }: { line: RecipeLine; item?: StockItem }) {
  const name = item?.name || line.name || "(ไม่มีชื่อ)";
  const linked = !!line.itemId;
  return (
    <div className="mat-label">
      <MaterialThumb item={item} linked={linked} />
      <span className="mat-label__text">
        <span className="mat-label__name">
          {name}
          {item?.link && (
            <a className="link-icon" href={item.link} target="_blank" rel="noopener noreferrer" title="เปิดลิงก์สินค้า">
              🔗
            </a>
          )}
        </span>
        <small className="mat-label__meta">
          {item ? (
            <>
              {item.variant ? `${item.variant} · ` : ""}
              {item.size ? `${item.size} · ` : ""}
              เหลือ {item.qty}
              {item.price != null ? ` · ฿${item.price.toLocaleString("th-TH")}` : ""}
            </>
          ) : linked ? (
            "⚠️ ไม่พบในสต็อกแล้ว (ใช้ราคาที่บันทึกไว้ในสูตร)"
          ) : (
            "กรอกเอง"
          )}
        </small>
      </span>
    </div>
  );
}
