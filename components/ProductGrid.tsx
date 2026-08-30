"use client";

import { useEffect, useMemo, useState } from "react";
import type { StockItem } from "@/lib/types";
import { STATUS_LABELS } from "@/lib/statusOptions";
import { analyzeIngredients, analyzeSkinCompat, COMPAT_META, TAG_META, type IngredientTag } from "@/lib/ingredients";
import { formatThaiShortDate } from "@/lib/date";
import ModalShell from "@/components/ModalShell";
import { effectiveExpiry, expiryLabel, type ExpiryInfo } from "@/lib/expiry";
import { isLow, isOutOfStock } from "@/lib/stock";
import { daysUntilEmpty, RUNOUT_SOON_DAYS } from "@/lib/usage";
import { buyTimes, priceStats, FREQUENT_MIN_TIMES } from "@/lib/price";
import { shopKey } from "@/lib/orders";
import { sourceLabel } from "@/lib/importSites";
import { amountText, bahtPerUnit, perUnitPrice, totalPieces, type PerUnitPrice, type PieceCount } from "@/lib/cost";
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
  /** ปัก/เอาดาวของโปรดออก — โชว์เป็นปุ่มดาวบนการ์ด และกรองด้วยชิป "⭐ ของโปรด" */
  onToggleFav?: (id: string) => void;
  /** เพิ่มสินค้าชิ้นนี้เป็นวัตถุดิบในสูตรต้นทุน (ดู lib/cost.ts) */
  onAddToRecipe?: (item: StockItem) => void;
  /** จดสินค้าชิ้นนี้ไว้ในแผนซื้อของ (ดู lib/plan.ts) */
  onAddToPlan?: (item: StockItem) => void;
  /** กดแท็ก 🏪 บนการ์ดแล้วกรองเฉพาะร้านนั้น (ไม่ส่งมา = แท็กเป็นข้อความเฉยๆ เหมือนเดิม) */
  onFilterShop?: (shop: string) => void;
  /** `shopKey` ของร้านที่กรองอยู่ — ไว้ไฮไลต์แท็กที่กำลังกรอง */
  activeShopKey?: string;
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

export default function ProductGrid({ items, avoidIngredients, skinProfile, onInc, onDec, onEdit, onDelete, onToggleFav, onAddToRecipe, onAddToPlan, onFilterShop, activeShopKey, selectMode, selectedIds, onToggleSelect }: Props) {
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
   * ข้อมูลจากประวัติการซื้อที่จะโชว์บนการ์ด (จำนวนครั้งที่ซื้อ + ราคาเฉลี่ย) —
   * คิดล่วงหน้าทีเดียวต่อการเปลี่ยนของ items เดิมคิดใหม่ทุกใบทุกครั้งที่ re-render
   * (เปิด/ปิดเมนู ⋯ ก็คิดใหม่ทั้งกริด)
   *
   * ราคาเฉลี่ยโชว์เฉพาะตอนซื้อมาหลายครั้งแล้วราคาไม่เท่ากัน ไม่งั้นเป็นตัวเลขซ้ำเปล่าๆ
   */
  const buyInfoById = useMemo(() => {
    const map = new Map<string, { times: number; avg?: { text: string; title: string } }>();
    for (const i of items) {
      const stats = priceStats(i.priceHistory);
      // เทียบแบบมีช่วงคลาด: avg ปัดเหลือ 2 ตำแหน่งแล้ว แต่ price ที่ผู้ใช้กรอกอาจละเอียดกว่า
      const showAvg = !!stats && stats.times >= 2 && Math.abs(stats.avg - (i.price ?? 0)) >= 0.01;
      const times = buyTimes(i);
      if (!showAvg && times === 0) continue;
      map.set(i.id, {
        times,
        avg: showAvg && stats
          ? {
              text: `เฉลี่ย ฿${stats.avg.toLocaleString("th-TH")}`,
              title: `ซื้อ ${stats.times} ครั้ง · ราคาเฉลี่ยถ่วงน้ำหนักตามจำนวน`,
            }
          : undefined,
      });
    }
    return map;
  }, [items]);

  /**
   * ราคาต่อชิ้นย่อยของของที่ขายเป็นแพ็ค — ราคาตัวใหญ่บนการ์ดเป็นราคาต่อ 1 แพ็ค (ดู lib/cost.ts)
   * คิดล่วงหน้าเหมือนกัน เพราะ `perUnitPrice` ต้องแกะข้อความ `size` ด้วย regex เมื่อไม่ได้กรอกขนาดแพ็คไว้
   */
  const perUnitById = useMemo(() => {
    const map = new Map<string, PerUnitPrice>();
    for (const i of items) {
      const pu = perUnitPrice(i);
      if (pu) map.set(i.id, pu);
    }
    return map;
  }, [items]);

  /**
   * "เหลือกี่ชิ้น" ของของที่ขายยกแพ็ค — ตัวเลขข้างปุ่ม −/+ นับเป็นแพ็ค (ดู lib/stock.ts)
   * คิดล่วงหน้าด้วยเหตุผลเดียวกับ `perUnitById`: ต้องแกะข้อความ `size` เมื่อไม่ได้กรอกขนาดแพ็คไว้
   */
  const piecesById = useMemo(() => {
    const map = new Map<string, PieceCount>();
    for (const i of items) {
      const pc = totalPieces(i);
      if (pc) map.set(i.id, pc);
    }
    return map;
  }, [items]);

  /**
   * วันหมดอายุที่ใช้จริงของแต่ละใบ — เก็บเฉพาะตัวที่ต้องเตือน (หมดแล้ว/ใกล้หมด)
   * ของที่ยังอีกนานไม่ต้องมีป้าย ไม่งั้นการ์ดเต็มไปด้วยป้ายที่ไม่ต้องทำอะไร
   */
  const expiryById = useMemo(() => {
    const map = new Map<string, ExpiryInfo>();
    for (const i of items) {
      const info = effectiveExpiry(i);
      if (info && (info.expired || info.soon)) map.set(i.id, info);
    }
    return map;
  }, [items]);

  /** เหลือพอใช้อีกกี่วัน — โชว์เฉพาะตัวที่ใกล้จะหมด ของที่ยังอีกนานไม่ต้องรก */
  const runoutById = useMemo(() => {
    const map = new Map<string, number>();
    for (const i of items) {
      const left = daysUntilEmpty(i);
      if (left != null && left <= RUNOUT_SOON_DAYS) map.set(i.id, left);
    }
    return map;
  }, [items]);

  const clusters = useMemo(() => clusterByGroup(items), [items]);

  if (items.length === 0) {
    return <div className="empty">ยังไม่มีสินค้าในสต็อก — กด &quot;เพิ่มสินค้า&quot; เพื่อเริ่มต้น</div>;
  }

  const renderCard = (i: StockItem, suppressSelect = false) => {
    const outOfStock = isOutOfStock(i);
    const low = isLow(i);
    const selected = !!selectedIds?.has(i.id);
    const interactive = selectMode && !suppressSelect;
    const ing = ingredientInfo.get(i.id);
    const buy = buyInfoById.get(i.id);
    const avg = buy?.avg;
    const frequent = (buy?.times ?? 0) >= FREQUENT_MIN_TIMES;
    const boughtLabel = formatThaiShortDate(i.purchasedAt);
    const perUnit = perUnitById.get(i.id);
    const pieces = piecesById.get(i.id);
    const exp = expiryById.get(i.id);
    const runout = runoutById.get(i.id);
    return (
      <div
        className={`product-card ${outOfStock ? "out-of-stock-row" : low ? "low-row" : ""} ${selected ? "product-card--selected" : ""} ${i.fav ? "product-card--fav" : ""}`}
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
          {(outOfStock || low || frequent || exp || runout != null || i.status) && (
            <div className="product-card__flags">
              {outOfStock && <span className="badge-out">หมดแล้ว</span>}
              {low && <span className="badge-low">ใกล้หมด{i.min > 0 ? ` · ขั้นต่ำ ${i.min}` : ""}</span>}
              {frequent && (
                <span className="badge-frequent" title="นับจากประวัติราคา — ซื้อซ้ำหลายครั้งแล้ว">
                  🔁 ซื้อ {buy?.times} ครั้ง
                </span>
              )}
              {runout != null && !outOfStock && (
                <span className="badge-runout" title="ประมาณจากอัตราการใช้ย้อนหลัง (ดู lib/usage.ts)">
                  📉 หมดใน ~{runout} วัน
                </span>
              )}
              {exp && (
                <span
                  className={`badge-expiry ${exp.expired ? "badge-expiry--gone" : ""}`}
                  title={`หมดอายุ ${exp.date}${exp.source === "pao" ? " (นับจากวันที่เปิดใช้)" : " (ตามฉลาก)"}`}
                >
                  {exp.expired ? "⛔" : "⏰"} {expiryLabel(exp)}
                </span>
              )}
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
          {(sourceLabel(i.source) || i.variant || i.shop) && (
            <div className="product-card__tags">
              {sourceLabel(i.source) && <span className="source-tag">{sourceLabel(i.source)}</span>}
              {i.shop && (onFilterShop ? (
                <button
                  type="button"
                  className={`shop-tag shop-tag--btn ${activeShopKey && shopKey(i.shop) === activeShopKey ? "is-active" : ""}`}
                  title={`ดูเฉพาะของจากร้าน ${i.shop} (กดซ้ำเพื่อเลิกกรอง)`}
                  onClick={(e) => { e.stopPropagation(); onFilterShop(i.shop!); }}
                >
                  🏪 {i.shop}
                </button>
              ) : (
                <span className="shop-tag" title="ร้านที่ซื้อครั้งล่าสุด">🏪 {i.shop}</span>
              ))}
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
            {perUnit && (
              <span
                className="product-card__per-unit"
                title={`฿${i.price?.toLocaleString("th-TH")} ÷ ${amountText(perUnit.amount)} ${perUnit.unit} ต่อ 1 แพ็ค`}
              >
                = {bahtPerUnit(perUnit.perUnit)}/{perUnit.unit}
              </span>
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
          {i.location && (
            <div className="product-card__location" title="เก็บไว้ตรงไหน">📍 {i.location}</div>
          )}
          {i.note && <div className="product-card__note">📝 {i.note}</div>}

          <div className="product-card__footer" onClick={(e) => e.stopPropagation()}>
            <div className="qty">
              <button className="qty-btn" onClick={() => onDec(i.id)}>−</button>
              <span> {i.qty} </span>
              <button className="qty-btn" onClick={() => onInc(i.id)}>+</button>
            </div>
            {/* ตัวเลขข้างปุ่ม −/+ นับเป็นแพ็ค — ของที่แพ็คละหลายชิ้นจึงบอก "รวมกี่ชิ้น" ต่อท้ายให้ */}
            {pieces && (
              <span
                className="product-card__pieces"
                title={`${amountText(pieces.packs)} แพ็ค × ${amountText(pieces.amount)} ${pieces.unit} ต่อแพ็ค`}
              >
                = {amountText(pieces.pieces)} {pieces.unit}
              </span>
            )}
            {/* ตอนใกล้หมดมีป้าย "ใกล้หมด · ขั้นต่ำ n" อยู่แล้ว ไม่ต้องบอกซ้ำ */}
            {i.openPct != null && i.qty > 0 && (
              <span className="product-card__open" title="ขวด/แพ็คที่เปิดอยู่เหลืออยู่เท่าไร">
                เปิดแล้ว {i.openPct}%
              </span>
            )}
            {i.min > 0 && !low && <span className="product-card__min">ขั้นต่ำ {i.min}</span>}
            {onToggleFav && (
              <button
                className={`icon-btn fav-btn ${i.fav ? "fav-btn--on" : ""}`}
                title={i.fav ? "เอาออกจากของโปรด" : "เพิ่มเป็นของโปรด"}
                aria-pressed={!!i.fav}
                onClick={() => onToggleFav(i.id)}
              >
                {i.fav ? "★" : "☆"}
              </button>
            )}
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
                  {onAddToPlan && (
                    <button className="menu__item" onClick={() => { setMenuId(null); onAddToPlan(i); }}>
                      <i>🛒</i> ใส่ในแผนซื้อของ
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
              {renderCard(cluster[0], true)}
            </div>
          </div>
        );
      })}

      {openCluster && (
        <ModalShell
          open
          title={`👥 ${openCluster[0].groupName} · ${openCluster.length} รายการ`}
          onClose={() => setOpenGroupId(null)}
          className="product-group-modal"
          closeOnBackdrop
        >
          <div className="product-group__stack">{openCluster.map((i) => renderCard(i))}</div>
        </ModalShell>
      )}
    </div>
  );
}
