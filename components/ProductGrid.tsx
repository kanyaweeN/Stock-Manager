"use client";

import { useState } from "react";
import type { StockItem } from "@/lib/types";
import { STATUS_LABELS } from "@/lib/statusOptions";

interface Props {
  items: StockItem[];
  onInc: (id: string) => void;
  onDec: (id: string) => void;
  onEdit: (item: StockItem) => void;
  onDelete: (item: StockItem) => void;
  selectMode?: boolean;
  selectedIds?: Set<string>;
  onToggleSelect?: (id: string) => void;
}

/** จัดกลุ่มรายการที่มี groupId เดียวกันให้อยู่ติดกัน (เรียงตามตำแหน่งที่เจอตัวแรกของกลุ่ม) เพื่อวางเป็นกองเดียวกันในกริด */
function clusterByGroup(items: StockItem[]): StockItem[][] {
  const seen = new Map<string, StockItem[]>();
  const order: string[] = [];
  const clusters: StockItem[][] = [];
  for (const i of items) {
    if (!i.groupId) {
      clusters.push([i]);
      continue;
    }
    if (!seen.has(i.groupId)) {
      const cluster: StockItem[] = [];
      seen.set(i.groupId, cluster);
      order.push(i.groupId);
      clusters.push(cluster);
    }
    seen.get(i.groupId)!.push(i);
  }
  return clusters;
}

export default function ProductGrid({ items, onInc, onDec, onEdit, onDelete, selectMode, selectedIds, onToggleSelect }: Props) {
  const [openGroupId, setOpenGroupId] = useState<string | null>(null);

  if (items.length === 0) {
    return <div className="empty">ยังไม่มีสินค้าในสต็อก — กด &quot;เพิ่มสินค้า&quot; เพื่อเริ่มต้น</div>;
  }

  const renderCard = (i: StockItem, suppressSelect = false) => {
    const outOfStock = i.qty === 0;
    const low = !outOfStock && i.min > 0 && i.qty <= i.min;
    const selected = !!selectedIds?.has(i.id);
    const interactive = selectMode && !suppressSelect;
    return (
      <div
        className={`product-card ${outOfStock ? "out-of-stock-row" : low ? "low-row" : ""} ${selected ? "product-card--selected" : ""}`}
        key={i.id}
        onClick={interactive ? () => onToggleSelect?.(i.id) : undefined}
      >
        {interactive && (
          <input
            type="checkbox"
            className="product-card__select"
            checked={selected}
            onChange={() => onToggleSelect?.(i.id)}
            onClick={(e) => e.stopPropagation()}
          />
        )}
        <div className="product-card__img-wrap">
          {i.img ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              className="product-card__img"
              src={i.img}
              alt=""
              onError={(e) => { (e.currentTarget as HTMLImageElement).style.visibility = "hidden"; }}
            />
          ) : (
            <div className="product-card__img-placeholder">📦</div>
          )}
          {outOfStock && <span className="badge-out product-card__low-badge">หมดแล้ว</span>}
          {low && <span className="badge-low product-card__low-badge">ใกล้หมด</span>}
          {i.status && (
            <span className={`status-badge status-${i.status} product-card__status-badge`}>
              {STATUS_LABELS[i.status]}
            </span>
          )}
        </div>

        <div className="product-card__body">
          <div className="product-card__title">
            {i.name}
            {i.link && (
              <a className="link-icon" href={i.link} target="_blank" rel="noopener noreferrer" title="เปิดลิงก์สินค้า">
                🔗
              </a>
            )}
          </div>
          <div className="product-card__category">
            {i.cats.length > 0 ? i.cats.join(" · ") : "ไม่มีหมวดหมู่"}
          </div>
          {(i.source === "shopee" || i.variant) && (
            <div className="product-card__tags">
              {i.source === "shopee" && <span className="source-tag">Shopee</span>}
              {i.variant && <span className="variant-tag">{i.variant}</span>}
            </div>
          )}
          <div className="product-card__price-row">
            {i.price != null && <span className="product-card__price">฿{i.price.toLocaleString("th-TH")}</span>}
            {i.size && <span className="product-card__size">ขนาด {i.size}</span>}
          </div>
          {i.note && <div className="product-card__note">📝 {i.note}</div>}

          <div className="product-card__footer" onClick={(e) => e.stopPropagation()}>
            <div className="qty">
              <button className="qty-btn" onClick={() => onDec(i.id)}>−</button>
              <span> {i.qty} </span>
              <button className="qty-btn" onClick={() => onInc(i.id)}>+</button>
              {i.min > 0 && <span className="product-card__min">ขั้นต่ำ {i.min}</span>}
            </div>
            <div className="product-card__actions">
              <button className="icon-btn" title="แก้ไข" onClick={() => onEdit(i)}>✏️</button>
              <button className="icon-btn del" title="ลบ" onClick={() => onDelete(i)}>🗑️</button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const clusters = clusterByGroup(items);
  const openCluster = openGroupId ? clusters.find((c) => c[0].groupId === openGroupId) : undefined;

  /** เลือก/ยกเลิกเลือกสมาชิกทั้งกลุ่มพร้อมกัน กันปัญหาที่เลือกได้แค่การ์ดหน้าสุดของกอง แล้วสมาชิกที่เหลือหลุดออกจากกลุ่มตอนจัดกลุ่มใหม่ */
  const toggleClusterSelect = (cluster: StockItem[]) => {
    const allSelected = cluster.every((i) => selectedIds?.has(i.id));
    cluster.forEach((i) => {
      const isSelected = !!selectedIds?.has(i.id);
      if (allSelected ? isSelected : !isSelected) onToggleSelect?.(i.id);
    });
  };

  return (
    <div className="product-grid">
      {clusters.map((cluster) => {
        if (cluster.length <= 1) return renderCard(cluster[0]);

        const groupId = cluster[0].groupId!;
        const totalQty = cluster.reduce((s, i) => s + i.qty, 0);
        const clusterSelected = selectMode && cluster.every((i) => selectedIds?.has(i.id));

        return (
          <div className="product-group" key={groupId}>
            <button
              className="product-group__label"
              onClick={() => (selectMode ? toggleClusterSelect(cluster) : setOpenGroupId(groupId))}
            >
              👥 {cluster[0].groupName} · รวม {totalQty} ชิ้น · {cluster.length} รายการ
              <span className="product-group__toggle">
                {selectMode ? (clusterSelected ? "✓ เลือกแล้ว" : "แตะเพื่อเลือกทั้งกลุ่ม") : "▼ ดูทั้งหมด"}
              </span>
            </button>
            <div
              className={`product-group__peek ${clusterSelected ? "product-group__peek--selected" : ""}`}
              onClick={() => (selectMode ? toggleClusterSelect(cluster) : setOpenGroupId(groupId))}
            >
              {selectMode && (
                <input
                  type="checkbox"
                  className="product-card__select"
                  checked={clusterSelected}
                  onChange={() => toggleClusterSelect(cluster)}
                  onClick={(e) => e.stopPropagation()}
                />
              )}
              {cluster.slice(0, 2).map((i, idx) => (
                <div className="product-group__peek-card" key={i.id} style={{ zIndex: 2 - idx }}>
                  {renderCard(i, true)}
                </div>
              ))}
            </div>
          </div>
        );
      })}

      {openCluster && (
        <div className="modal-backdrop open" onClick={() => setOpenGroupId(null)}>
          <div className="modal product-group-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>👥 {openCluster[0].groupName} · {openCluster.length} รายการ</h2>
              <button className="modal-close" onClick={() => setOpenGroupId(null)}>×</button>
            </div>
            <div className="product-group__stack">{openCluster.map((i) => renderCard(i))}</div>
          </div>
        </div>
      )}
    </div>
  );
}
