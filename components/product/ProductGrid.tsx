"use client";

import { useEffect, useMemo, useState } from "react";
import type { StockGroup, StockItem } from "@/lib/types";
import { STATUS_LABELS } from "@/lib/core/statusOptions";
import { analyzeIngredients, analyzeSkinCompat, COMPAT_META, TAG_META, type IngredientTag } from "@/lib/domain/ingredients";
import { formatThaiShortDate } from "@/lib/core/date";
import { groupNameMap } from "@/lib/domain/groups";
import ModalShell from "@/components/ui/ModalShell";
import GroupNamePromptModal from "@/components/product/GroupNamePromptModal";
import { effectiveExpiry, expiryLabel, type ExpiryInfo } from "@/lib/domain/expiry";
import { isLow, isOutOfStock } from "@/lib/domain/stock";
import { daysUntilEmpty, RUNOUT_SOON_DAYS } from "@/lib/domain/usage";
import { buyTimes, priceStats, FREQUENT_MIN_TIMES } from "@/lib/domain/price";
import { shopKey } from "@/lib/domain/orders";
import { sourceLabel } from "@/lib/import/sites";
import { amountText, bahtPerUnit, perUnitPrice, totalPieces, type PerUnitPrice, type PieceCount } from "@/lib/domain/cost";
import type { SkinProfile } from "@/lib/db";

/** จำนวนแท็กส่วนผสมสูงสุดที่โชว์บนการ์ด (ที่เหลือย่อเป็น +n) */
const CARD_TAG_LIMIT = 3;

/**
 * ปุ่ม −/+ พร้อมตัวเลข — ใช้ได้ทั้งชุดหลัก (แพ็ค) และชุดรอง (ชิ้น)
 * แยกออกมาเพราะโครง `<button/><span/><button/>` เดียวกันเป๊ะ ส่วนที่ต่างจริงคือ
 * ค่าที่โชว์ ตัว handler และธีมสี (`variant="pieces"` = โทน accent อ่อน)
 */
function QtyControl({
  value, variant, title, onDec, onInc, decLabel, incLabel,
}: {
  value: React.ReactNode;
  /** ปุ่มระดับชิ้น = ธีมรอง (โทน accent อ่อน) ค่าอื่น = ธีมหลัก (พื้นเทา) */
  variant?: "pieces";
  title?: string;
  onDec: () => void;
  onInc: () => void;
  decLabel?: string;
  incLabel?: string;
}) {
  return (
    <div className={variant === "pieces" ? "qty qty--pieces" : "qty"} title={title}>
      <button className="qty-btn" onClick={onDec} aria-label={decLabel}>−</button>
      <span>{value}</span>
      <button className="qty-btn" onClick={onInc} aria-label={incLabel}>+</button>
    </div>
  );
}

/** ตัวเลข + ป้ายหน่วยเบาๆ ("แพ็ค"/"ชิ้น") ใช้เป็นค่าใน `QtyControl` */
function QtyValue({ value, unit }: { value: React.ReactNode; unit?: string }) {
  return (
    <>
      {value}
      {unit && <em className="qty__unit"> {unit}</em>}
    </>
  );
}

interface Props {
  items: StockItem[];
  avoidIngredients?: string[];
  skinProfile?: SkinProfile;
  onInc: (id: string) => void;
  onDec: (id: string) => void;
  /** ปรับจำนวนทีละ**ชิ้นย่อย** ของของที่ขายยกแพ็ค (แพ็คละ 10 ชิ้น กด −1 ชิ้น เหลือ 9 ชิ้น) — ไม่ส่ง = ไม่โชว์ปุ่ม */
  onIncPiece?: (id: string) => void;
  onDecPiece?: (id: string) => void;
  onEdit: (item: StockItem) => void;
  onDelete: (item: StockItem) => void;
  /** ปัก/เอาดาวของโปรดออก — โชว์เป็นปุ่มดาวบนการ์ด และกรองด้วยชิป "⭐ ของโปรด" */
  onToggleFav?: (id: string) => void;
  /** เพิ่มสินค้าชิ้นนี้เป็นวัตถุดิบในสูตรต้นทุน (ดู lib/domain/cost.ts) */
  onAddToRecipe?: (item: StockItem) => void;
  /** จดสินค้าชิ้นนี้ไว้ในแผนซื้อของ (ดู lib/domain/plan.ts) */
  onAddToPlan?: (item: StockItem) => void;
  /** สลับติดตามในหน้าคาดคะเนซื้อ (ดู app/forecast/page.tsx) — เมนูจะสลับคำระหว่าง "ติดตาม" กับ "เลิกติดตาม" ตาม `forecastIds` */
  onToggleForecast?: (item: StockItem) => void;
  /** เซ็ต id ที่ถูกติดตามอยู่ — ไว้สลับคำในเมนู ⋯ ไม่ต้องส่งถ้าไม่ใช้ `onToggleForecast` */
  forecastIds?: Set<string>;
  /** กดแท็ก 🏪 บนการ์ดแล้วกรองเฉพาะร้านนั้น (ไม่ส่งมา = แท็กเป็นข้อความเฉยๆ เหมือนเดิม) */
  onFilterShop?: (shop: string) => void;
  /** `shopKey` ของร้านที่กรองอยู่ — ไว้ไฮไลต์แท็กที่กำลังกรอง */
  activeShopKey?: string;
  /** กดชื่อหมวดหมู่บนการ์ดแล้วกรองเฉพาะหมวดนั้น (ไม่ส่งมา = หมวดเป็นข้อความเฉยๆ เหมือนเดิม) */
  onFilterCat?: (cat: string) => void;
  /** รายชื่อหมวดที่กำลังกรอง — ไว้ไฮไลต์ชื่อหมวดที่กำลังกรอง */
  activeCats?: string[];
  selectMode?: boolean;
  selectedIds?: Set<string>;
  onToggleSelect?: (id: string) => void;
  /** กลุ่มสินค้า (จาก `db.groups`) — ใช้หาชื่อกลุ่มมาโชว์บนหัวก้อน */
  groups?: StockGroup[];
  /** เปลี่ยนชื่อกลุ่ม — ไม่ส่ง = ซ่อนปุ่มแก้ชื่อกลุ่ม */
  onRenameGroup?: (groupId: string, name: string) => void;
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

export default function ProductGrid({ items, avoidIngredients, skinProfile, onInc, onDec, onIncPiece, onDecPiece, onEdit, onDelete, onToggleFav, onAddToRecipe, onAddToPlan, onToggleForecast, forecastIds, onFilterShop, activeShopKey, onFilterCat, activeCats, selectMode, selectedIds, onToggleSelect, groups, onRenameGroup }: Props) {
  const [openGroupId, setOpenGroupId] = useState<string | null>(null);
  /** id + ชื่อเดิมของกลุ่มที่กำลังแก้ชื่ออยู่ — เก็บชื่อเดิมไว้ให้ modal ใช้เป็น initialValue เพราะกลุ่มอาจถูกลบ/rename ระหว่างเปิด modal */
  const [renaming, setRenaming] = useState<{ id: string; initial: string } | null>(null);
  /** id ของการ์ดที่เปิดเมนู ⋯ อยู่ (เปิดได้ทีละใบ) */
  const [menuId, setMenuId] = useState<string | null>(null);

  const groupNameById = useMemo(() => groupNameMap(groups), [groups]);
  /** ชื่อกลุ่มที่จะโชว์ — ไม่มีในลิสต์ (ข้อมูลเพี้ยน) fallback เป็นชื่อสมาชิกตัวแรกกันโชว์ว่าง */
  const groupLabel = (cluster: StockItem[]) => groupNameById.get(cluster[0].groupId!) || cluster[0].name;

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
   * ราคาต่อชิ้นย่อยของของที่ขายเป็นแพ็ค — ราคาตัวใหญ่บนการ์ดเป็นราคาต่อ 1 แพ็ค (ดู lib/domain/cost.ts)
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
   * "เหลือกี่ชิ้น" ของของที่ขายยกแพ็ค — ตัวเลขข้างปุ่ม −/+ นับเป็นแพ็ค (ดู lib/domain/stock.ts)
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
                <span className="badge-runout" title="ประมาณจากอัตราการใช้ย้อนหลัง (ดู lib/domain/usage.ts)">
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
            {i.cats.length === 0 && "ไม่มีหมวดหมู่"}
            {i.cats.flatMap((c, idx) => [
              idx > 0 && <span key={`sep-${idx}`} className="product-card__category-sep"> · </span>,
              onFilterCat ? (
                <button
                  key={c}
                  type="button"
                  className={`cat-tag ${activeCats?.includes(c) ? "is-active" : ""}`}
                  title={`ดูเฉพาะของในหมวด ${c} (กดซ้ำเพื่อเลิกกรอง)`}
                  onClick={(e) => { e.stopPropagation(); onFilterCat(c); }}
                >
                  {c}
                </button>
              ) : (
                <span key={c}>{c}</span>
              ),
            ])}
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
            {/*
              คู่ปุ่ม −/+ ของของที่ขายยกแพ็ค: ตัวซ้าย = ระดับแพ็ค (ซื้อเพิ่ม/ใช้หมดแพ็ค),
              ตัวขวา = ระดับชิ้น (ใช้/เพิ่ม 1 ชิ้น แอบปรับ openPct ให้)
              ห่อเป็น .qty-stack เพื่อให้เกาะกันเป็นก้อนเดียว ไม่แตกออกจากกันเวลามีป้ายอื่นแทรก
              ป้ายหน่วย ("แพ็ค"/"ชิ้น") โผล่เฉพาะตอนมีปุ่มสองชุด ไม่งั้นเป็นข้อมูลซ้ำเปล่าๆ
            */}
            <div className="qty-stack">
              <QtyControl
                value={<QtyValue value={i.qty} unit={pieces ? "แพ็ค" : undefined} />}
                title={pieces ? "ปรับทีละแพ็ค (ซื้อเพิ่ม/ใช้หมดทั้งแพ็ค)" : undefined}
                onDec={() => onDec(i.id)}
                onInc={() => onInc(i.id)}
                decLabel="ลดจำนวน"
                incLabel="เพิ่มจำนวน"
              />
              {pieces && (onIncPiece && onDecPiece ? (
                <QtyControl
                  variant="pieces"
                  value={<QtyValue value={amountText(pieces.pieces)} unit={pieces.unit} />}
                  title={`ปรับทีละชิ้น (${amountText(pieces.packs)} แพ็ค × ${amountText(pieces.amount)} ${pieces.unit} ต่อแพ็ค)`}
                  onDec={() => onDecPiece(i.id)}
                  onInc={() => onIncPiece(i.id)}
                  decLabel="ใช้ 1 ชิ้น"
                  incLabel="เพิ่ม 1 ชิ้น"
                />
              ) : (
                <span
                  className="product-card__pieces"
                  title={`${amountText(pieces.packs)} แพ็ค × ${amountText(pieces.amount)} ${pieces.unit} ต่อแพ็ค`}
                >
                  = {amountText(pieces.pieces)} {pieces.unit}
                </span>
              ))}
            </div>
            {/*
              เปิดแล้ว % — โชว์เฉพาะตอนไม่มีปุ่มระดับชิ้น (ไม่งั้นข้อมูลซ้ำกับตัวเลข "N ชิ้น" ที่เห็นอยู่)
              และตอนใกล้หมดมีป้าย "ใกล้หมด · ขั้นต่ำ n" อยู่แล้วก็ไม่ต้องบอกซ้ำ
            */}
            {i.openPct != null && i.qty > 0 && !pieces && (
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
                  {onToggleForecast && (
                    <button className="menu__item" onClick={() => { setMenuId(null); onToggleForecast(i); }}>
                      <i>🔮</i> {forecastIds?.has(i.id) ? "เลิกติดตามคาดคะเนซื้อ" : "ติดตามคาดคะเนซื้อ"}
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
              👥 {groupLabel(cluster)} · รวม {totalQty} ชิ้น · {cluster.length} รายการ
              {onRenameGroup && !selectMode && (() => {
                // เปิดโมดัลแก้ชื่อ — ยัดเป็น <span role="button"> เพราะซ้อนใน <button> ของหัวก้อนแล้ว nested <button> ไม่ valid
                const startRename = () => setRenaming({ id: groupId, initial: groupLabel(cluster) });
                return (
                  <span
                    role="button"
                    tabIndex={0}
                    className="product-group__rename"
                    title="แก้ชื่อกลุ่ม"
                    onClick={(e) => { e.stopPropagation(); startRename(); }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        e.stopPropagation();
                        startRename();
                      }
                    }}
                  >
                    ✏️
                  </span>
                );
              })()}
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
          title={`👥 ${groupLabel(openCluster)} · ${openCluster.length} รายการ`}
          onClose={() => setOpenGroupId(null)}
          className="product-group-modal"
          closeOnBackdrop
        >
          <div className="product-group__stack">{openCluster.map((i) => renderCard(i))}</div>
        </ModalShell>
      )}

      {renaming && onRenameGroup && (
        <GroupNamePromptModal
          open
          title="แก้ชื่อกลุ่ม"
          initialValue={renaming.initial}
          onSave={(name) => { onRenameGroup(renaming.id, name); setRenaming(null); }}
          onClose={() => setRenaming(null)}
        />
      )}
    </div>
  );
}
