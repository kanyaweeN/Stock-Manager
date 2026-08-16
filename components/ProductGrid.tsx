"use client";

import { useEffect, useMemo, useState } from "react";
import type { StockItem } from "@/lib/types";
import { STATUS_LABELS } from "@/lib/statusOptions";
import { analyzeIngredients, analyzeSkinCompat, COMPAT_META, TAG_META, type IngredientTag } from "@/lib/ingredients";
import { formatThaiShortDate } from "@/lib/date";
import { priceStats } from "@/lib/price";
import type { SkinProfile } from "@/lib/db";

/** จำนวนแท็กส่วนผสมสูงสุดที่โชว์บนการ์ด (ที่เหลือย่อเป็น +n) */
const CARD_TAG_LIMIT = 3;

interface Props {
  items: StockItem[];
  avoidIngredients?: string[];
  skinProfile?: SkinProfile;
  onInc: (id: string) => void;
  onDec: (id: string) => void;
  onEdit: (item: StockItem) => void;
  onDelete: (item: StockItem) => void;
  /** เพิ่มสินค้าชิ้นนี้เป็นวัตถุดิบในสูตรต้นทุน (ดู lib/cost.ts) */
  onAddToRecipe?: (item: StockItem) => void;
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

export default function ProductGrid({ items, avoidIngredients, skinProfile, onInc, onDec, onEdit, onDelete, onAddToRecipe, selectMode, selectedIds, onToggleSelect }: Props) {
  const [openGroupId, setOpenGroupId] = useState<string | null>(null);
  /** id ของการ์ดที่เปิดเมนู ⋯ อยู่ (เปิดได้ทีละใบ) */
  const [menuId, setMenuId] = useState<string | null>(null);

  useEffect(() => {
    if (!menuId) return;
    const close = (e: MouseEvent) => {
      const el = e.target as HTMLElement | null;
      if (!el?.closest?.(".card-menu")) setMenuId(null);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [menuId]);

  const ingredientInfo = useMemo(() => {
    const map = new Map<string, { tags: IngredientTag[]; warnCount: number; skinScore?: number; skinLevel?: string }>();
    for (const i of items) {
      if (!i.ingredients?.trim()) continue;
      const a = analyzeIngredients(i.ingredients, avoidIngredients);
      const compat = analyzeSkinCompat(i.ingredients, skinProfile);
      map.set(i.id, {
        tags: a.tags,
        warnCount: a.warnings.filter((w) => w.level === "warn").length,
        skinScore: compat?.score,
        skinLevel: compat?.level,
      });
    }
    return map;
  }, [items, avoidIngredients, skinProfile]);

  /**
   * ราคาเฉลี่ยที่จะโชว์บนการ์ด — คิดล่วงหน้าทีเดียวต่อการเปลี่ยนของ items
   * เดิมคิดใหม่ทุกใบทุกครั้งที่ re-render (เปิด/ปิดเมนู ⋯ ก็คิดใหม่ทั้งกริด)
   * โชว์เฉพาะตอนซื้อมาหลายครั้งแล้วราคาไม่เท่ากัน ไม่งั้นเป็นตัวเลขซ้ำเปล่าๆ
   */
  const avgPriceById = useMemo(() => {
    const map = new Map<string, { text: string; title: string }>();
    for (const i of items) {
      const stats = priceStats(i.priceHistory);
      // เทียบแบบมีช่วงคลาด: avg ปัดเหลือ 2 ตำแหน่งแล้ว แต่ price ที่ผู้ใช้กรอกอาจละเอียดกว่า
      if (!stats || stats.times < 2 || Math.abs(stats.avg - (i.price ?? 0)) < 0.01) continue;
      map.set(i.id, {
        text: `เฉลี่ย ฿${stats.avg.toLocaleString("th-TH")}`,
        title: `ซื้อ ${stats.times} ครั้ง · ราคาเฉลี่ยถ่วงน้ำหนักตามจำนวน`,
      });
    }
    return map;
  }, [items]);

  const clusters = useMemo(() => clusterByGroup(items), [items]);

  if (items.length === 0) {
    return <div className="empty">ยังไม่มีสินค้าในสต็อก — กด &quot;เพิ่มสินค้า&quot; เพื่อเริ่มต้น</div>;
  }

  const renderCard = (i: StockItem, suppressSelect = false) => {
    const outOfStock = i.qty === 0;
    const low = !outOfStock && i.min > 0 && i.qty <= i.min;
    const selected = !!selectedIds?.has(i.id);
    const interactive = selectMode && !suppressSelect;
    const ing = ingredientInfo.get(i.id);
    const avg = avgPriceById.get(i.id);
    const boughtLabel = formatThaiShortDate(i.purchasedAt);
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
        </div>

        <div className="product-card__body">
          {/* ป้ายสถานะ — จอกว้างลอยทับรูป, จอมือถือไหลมาเป็นชิปบรรทัดแรกของเนื้อหา (ดู .product-card__flags) */}
          {(outOfStock || low || i.status) && (
            <div className="product-card__flags">
              {outOfStock && <span className="badge-out">หมดแล้ว</span>}
              {low && <span className="badge-low">ใกล้หมด{i.min > 0 ? ` · ขั้นต่ำ ${i.min}` : ""}</span>}
              {i.status && (
                <span className={`status-badge status-${i.status}`}>{STATUS_LABELS[i.status]}</span>
              )}
            </div>
          )}
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
          {ing && ing.tags.length > 0 && (
            <div className="product-card__tags">
              {ing.skinScore != null && ing.skinLevel && (
                <span className={`skin-score skin-score--${ing.skinLevel}`} title={`ความเหมาะกับผิว ${ing.skinScore}/100`}>
                  {COMPAT_META[ing.skinLevel as keyof typeof COMPAT_META]?.emoji} {ing.skinScore}
                </span>
              )}
              {ing.warnCount > 0 && (
                <span className="ing-tag ing-tag--caution" title="มีส่วนผสมที่ควรระวังหรือตีกัน">
                  ⚠️ ควรระวัง {ing.warnCount}
                </span>
              )}
              {ing.tags.slice(0, CARD_TAG_LIMIT).map((t) => (
                <span className={`ing-tag ing-tag--${TAG_META[t].level}`} key={t}>
                  {TAG_META[t].emoji} {TAG_META[t].label}
                </span>
              ))}
              {ing.tags.length > CARD_TAG_LIMIT && (
                <span className="variant-tag">+{ing.tags.length - CARD_TAG_LIMIT}</span>
              )}
            </div>
          )}
          <div className="product-card__price-row">
            {i.price != null && <span className="product-card__price">฿{i.price.toLocaleString("th-TH")}</span>}
            {i.priceUnverified && (
              <span className="product-card__price-warn" title="ราคานี้อาจเป็นยอดรวมทั้งแถวจากการนำเข้าเวอร์ชันเก่า — เปิดแก้ไขเพื่อตรวจสอบ">⚠️</span>
            )}
            {avg && <span className="product-card__avg" title={avg.title}>{avg.text}</span>}
            {i.size && <span className="product-card__size">ขนาด {i.size}</span>}
          </div>
          {/*
            โชว์วันที่ซื้อเสมอ — เป็นคีย์ที่ลิสต์เรียงตามค่าเริ่มต้น ("ซื้อล่าสุด")
            ถ้าไม่โชว์ ผู้ใช้จะดูไม่ออกว่าทำไมของเรียงลำดับแบบนี้ โดยเฉพาะตอนนำเข้าออเดอร์เก่าย้อนหลัง
            ที่ของเพิ่งเข้าระบบวันนี้แต่วันที่ซื้อเป็นปีก่อนๆ
          */}
          {boughtLabel && (
            <div className="product-card__bought" title={`ซื้อล่าสุด ${i.purchasedAt}`}>
              🗓️ ซื้อ {boughtLabel}
            </div>
          )}
          {i.note && <div className="product-card__note">📝 {i.note}</div>}

          <div className="product-card__footer" onClick={(e) => e.stopPropagation()}>
            <div className="qty">
              <button className="qty-btn" onClick={() => onDec(i.id)}>−</button>
              <span> {i.qty} </span>
              <button className="qty-btn" onClick={() => onInc(i.id)}>+</button>
            </div>
            {/* ตอนใกล้หมดมีป้าย "ใกล้หมด · ขั้นต่ำ n" อยู่แล้ว ไม่ต้องบอกซ้ำ */}
            {i.min > 0 && !low && <span className="product-card__min">ขั้นต่ำ {i.min}</span>}
            <div className="card-menu">
              <button
                className="icon-btn card-menu__btn"
                title="เพิ่มเติม"
                aria-expanded={menuId === i.id}
                onClick={() => setMenuId((cur) => (cur === i.id ? null : i.id))}
              >
                ⋯
              </button>
              {menuId === i.id && (
                <div className="menu__panel card-menu__panel">
                  <button className="menu__item" onClick={() => { setMenuId(null); onEdit(i); }}><i>✏️</i> แก้ไข</button>
                  {onAddToRecipe && (
                    <button className="menu__item" onClick={() => { setMenuId(null); onAddToRecipe(i); }}>
                      <i>🧮</i> ใส่ในสูตรต้นทุน
                    </button>
                  )}
                  {i.link && (
                    <a className="menu__item" href={i.link} target="_blank" rel="noopener noreferrer" onClick={() => setMenuId(null)}>
                      <i>🔗</i> เปิดลิงก์สินค้า
                    </a>
                  )}
                  <div className="menu__sep" />
                  <button className="menu__item menu__item--danger" onClick={() => { setMenuId(null); onDelete(i); }}>
                    <i>🗑️</i> ลบสินค้า
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

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
