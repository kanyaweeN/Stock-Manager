"use client";

import { useEffect, useMemo, useState } from "react";
import ModalShell from "@/components/ui/ModalShell";
import StockPicker from "@/components/ui/StockPicker";
import { formatThaiShortDate } from "@/lib/core/date";
import { buyTimes } from "@/lib/domain/price";
import { repurchaseStats, sortByDueSoonest, type RepurchaseStats } from "@/lib/domain/repurchase";
import { useStockDB } from "@/lib/hooks/StockDBProvider";
import type { StockItem } from "@/lib/types";

/**
 * หน้าคาดคะเนวันซื้ออีกครั้ง — ผู้ใช้ **เลือกเอง**ว่าจะติดตามชิ้นไหน
 *
 * ไม่ประมวลผลทุกชิ้นในสต็อกเพราะบางบัญชีมี 1000+ ชิ้น การ์ดคาดคะเนที่โผล่บนทุกการ์ด
 * จะทำให้หน้าแรก render ช้า — ที่นี่คำนวณเฉพาะ id ที่อยู่ในลิสต์ที่เลือก
 *
 * รายการที่เลือกเก็บใน `db.forecastItemIds` เพื่อซิงก์ข้ามเครื่องผ่าน Drive
 * (เวอร์ชันก่อนหน้าเก็บใน localStorage — ยังอ่านย้ายเข้า db ให้อัตโนมัติครั้งเดียวตอนเปิดหน้า)
 */
const LEGACY_STORAGE_KEY = "stock_manager_forecast_ids";

function loadLegacyIds(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(LEGACY_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((s) => typeof s === "string") : [];
  } catch {
    return [];
  }
}

function clearLegacyStorage() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(LEGACY_STORAGE_KEY);
  } catch {
    // เงียบดีกว่าค้าง
  }
}

export default function ForecastPage() {
  const { db, setDb } = useStockDB();

  const [picking, setPicking] = useState(false);

  // `?? []` สร้างอาร์เรย์ใหม่ทุก render — memoize เพื่อไม่ให้ useMemo ที่ตาม deps นี้เพี้ยน
  const ids = useMemo(() => db.forecastItemIds ?? [], [db.forecastItemIds]);

  // ย้ายข้อมูลจาก localStorage เข้า db ครั้งเดียวตอนเปิดหน้า — เฉพาะเมื่อ db ยังว่างจริงๆ
  // ถ้าเครื่องนี้เพิ่งซิงก์มาแล้วมี id อยู่แล้วก็ปล่อยไว้ ไม่ทับ (ของบน Drive น่าเชื่อถือกว่า)
  useEffect(() => {
    if (ids.length > 0) return;
    const legacy = loadLegacyIds();
    if (legacy.length === 0) return;
    setDb((prev) => ({ ...prev, forecastItemIds: [...new Set(legacy)] }));
    clearLegacyStorage();
    // เจตนา: รันเฉพาะครั้งแรกที่หน้าเปิด — deps ตั้งใจว่าง (React จะเตือน แต่ตรงกับที่ต้องการ)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const itemById = useMemo(() => new Map(db.items.map((i) => [i.id, i])), [db.items]);

  /** ของที่เลือกและยังอยู่ในสต็อกจริง — id ที่ชี้ไปของที่ลบแล้วถูกฟิลเตอร์ทิ้งใน `normalizeDB` แล้ว */
  const selectedItems = useMemo(
    () => ids.map((id) => itemById.get(id)).filter((x): x is StockItem => !!x),
    [ids, itemById],
  );

  /** คำนวณสถิติแค่ของที่เลือก — ไม่วนทั้งสต็อก (นี่คือจุดที่ช่วยเรื่องประสิทธิภาพ) */
  const statsById = useMemo(() => {
    const map = new Map<string, RepurchaseStats | null>();
    for (const item of selectedItems) map.set(item.id, repurchaseStats(item));
    return map;
  }, [selectedItems]);

  const sorted = useMemo(() => sortByDueSoonest(selectedItems, statsById), [selectedItems, statsById]);

  const addId = (id: string) => {
    setDb((prev) => {
      const current = prev.forecastItemIds ?? [];
      if (current.includes(id)) return prev;
      return { ...prev, forecastItemIds: [...current, id] };
    });
  };

  const removeId = (id: string) => {
    setDb((prev) => {
      const current = prev.forecastItemIds ?? [];
      if (!current.includes(id)) return prev;
      return { ...prev, forecastItemIds: current.filter((x) => x !== id) };
    });
  };

  const pickableItems = useMemo(
    () => db.items.filter((i) => !ids.includes(i.id)),
    [db.items, ids],
  );

  return (
    <div className="page">
      <h1>🔮 คาดคะเนวันซื้ออีกครั้ง</h1>
      <p className="sub sub-tight text-xs">
        เลือกสินค้าที่อยากติดตาม แล้วระบบจะเดาวันซื้อครั้งถัดไปจาก <b>ช่วงห่างของประวัติการซื้อ</b> (ต้องมีอย่างน้อย 2 ครั้ง)
        · เหมาะกับของที่ไม่ได้กด +/− ทุกวัน เช่น อาหารสัตว์ ผงซักฟอก แชมพู
        · รายการที่เลือกจะซิงก์ข้ามเครื่องผ่าน Google Drive ให้อัตโนมัติ
      </p>

      <div className="toolbar">
        <button className="btn-primary" onClick={() => setPicking(true)}>+ เลือกสินค้ามาติดตาม</button>
        {ids.length > 0 && (
          <span className="text-xs" style={{ color: "var(--muted)", alignSelf: "center" }}>
            กำลังติดตาม {selectedItems.length} รายการ
          </span>
        )}
      </div>

      {sorted.length === 0 ? (
        <div className="empty">
          ยังไม่ได้เลือกสินค้า — กด &quot;+ เลือกสินค้ามาติดตาม&quot; เพื่อเริ่ม
        </div>
      ) : (
        <div className="forecast-list">
          {sorted.map((item) => (
            <ForecastCard
              key={item.id}
              item={item}
              stats={statsById.get(item.id) ?? null}
              onRemove={() => removeId(item.id)}
            />
          ))}
        </div>
      )}

      <ModalShell open={picking} title="เลือกสินค้ามาติดตาม" onClose={() => setPicking(false)}>
        <div className="modal-body">
          <StockPicker
            items={pickableItems}
            onPick={(item) => {
              addId(item.id);
              setPicking(false);
            }}
            onClose={() => setPicking(false)}
            emptyStockText="สต็อกว่างเปล่า"
            meta={(i) => {
              const times = buyTimes(i);
              return times >= 2
                ? <span style={{ color: "var(--muted)" }}>ซื้อ {times} ครั้ง</span>
                : <span style={{ color: "var(--muted)" }}>ประวัติไม่พอ ({times || 0} ครั้ง)</span>;
            }}
          />
        </div>
      </ModalShell>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// การ์ดคาดคะเน 1 ชิ้น
// ─────────────────────────────────────────────────────────────

function ForecastCard({
  item,
  stats,
  onRemove,
}: {
  item: StockItem;
  stats: RepurchaseStats | null;
  onRemove: () => void;
}) {
  return (
    <div className={`forecast-card ${forecastToneClass(stats)}`}>
      <div className="forecast-card__head">
        {item.img ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="forecast-card__thumb" src={item.img} alt="" />
        ) : (
          <span className="forecast-card__thumb forecast-card__thumb--empty">📦</span>
        )}
        <div className="forecast-card__title">
          <div className="forecast-card__name">{item.name}</div>
          {item.variant && <div className="forecast-card__variant">{item.variant}</div>}
        </div>
        <button className="btn-ghost btn-sm" onClick={onRemove} title="ลบออกจากการติดตาม">ลบ</button>
      </div>

      {stats ? <ForecastBody stats={stats} /> : <ForecastEmpty item={item} />}
    </div>
  );
}

function ForecastBody({ stats }: { stats: RepurchaseStats }) {
  const { daysUntilNext, nextDate, lastDate, lastQty, daysPerPack, purchases, confidence } = stats;

  const headline = headlineForDays(daysUntilNext);
  const daysPerPackText =
    daysPerPack >= 30
      ? `~${(daysPerPack / 30).toFixed(1)} เดือน/แพ็ค`
      : `~${Math.round(daysPerPack)} วัน/แพ็ค`;

  return (
    <>
      <div className={`forecast-card__headline forecast-card__headline--${headline.tone}`}>
        <span className="forecast-card__headline-main">{headline.text}</span>
        <span className="forecast-card__headline-date">{formatThaiShortDate(nextDate)}</span>
      </div>

      <ul className="forecast-card__facts">
        <li>ซื้อไปแล้ว <b>{purchases}</b> ครั้ง · เฉลี่ย <b>{daysPerPackText}</b></li>
        <li>ครั้งล่าสุด: {formatThaiShortDate(lastDate)} · จำนวน {lastQty} แพ็ค</li>
        {confidence === "low" && (
          <li className="forecast-card__warn">
            ⚠️ ข้อมูลยังไม่มากพอ ตัวเลขเป็นการเดาแบบคร่าวๆ — ยิ่งซื้อบ่อยขึ้นจะยิ่งแม่น
          </li>
        )}
      </ul>
    </>
  );
}

function ForecastEmpty({ item }: { item: StockItem }) {
  const times = buyTimes(item);
  return (
    <div className="forecast-card__empty">
      ยังซื้อไม่ถึง 2 ครั้ง (ตอนนี้ {times || 0} ครั้ง) — คาดคะเนไม่ได้
      <br />
      <small>ข้อมูลจะเริ่มพร้อมใช้เมื่อนำเข้าออเดอร์ครั้งที่ 2 ของสินค้าชิ้นนี้</small>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// การแปลตัวเลข → ประโยค + โทน
// ─────────────────────────────────────────────────────────────

function headlineForDays(days: number): { text: string; tone: "late" | "soon" | "normal" | "far" } {
  if (days < -1) return { text: `เลยกำหนดมา ${-days} วัน`, tone: "late" };
  if (days <= 0) return { text: "ควรซื้อได้แล้ววันนี้", tone: "late" };
  if (days <= 7) return { text: `อีก ${days} วัน`, tone: "soon" };
  if (days <= 30) return { text: `อีก ${days} วัน`, tone: "normal" };
  if (days <= 90) return { text: `อีก ~${Math.round(days / 7)} สัปดาห์`, tone: "far" };
  return { text: `อีก ~${(days / 30).toFixed(1)} เดือน`, tone: "far" };
}

function forecastToneClass(stats: RepurchaseStats | null): string {
  if (!stats) return "forecast-card--muted";
  if (stats.daysUntilNext <= 0) return "forecast-card--late";
  if (stats.daysUntilNext <= 7) return "forecast-card--soon";
  return "";
}
