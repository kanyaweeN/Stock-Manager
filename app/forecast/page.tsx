"use client";

import { useEffect, useMemo, useState } from "react";
import ModalShell from "@/components/ui/ModalShell";
import StockPicker from "@/components/ui/StockPicker";
import { formatThaiShortDate } from "@/lib/core/date";
import { baht } from "@/lib/domain/cost";
import { buyTimes } from "@/lib/domain/price";
import { repurchaseStats, sortByDueSoonest, type RepurchaseStats } from "@/lib/domain/repurchase";
import { spendRate, type SpendRate } from "@/lib/domain/spendRate";
import { buildForecastClusters, type ForecastCluster } from "@/lib/domain/forecast";
import { useStockDB } from "@/lib/hooks/StockDBProvider";
import { useProductActions } from "@/lib/hooks/useProductActions";

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
  const actions = useProductActions(setDb);

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

  /**
   * ของที่เลือกและยังอยู่ในสต็อกจริง + **สมาชิกใหม่ของกลุ่มที่ถูกติดตาม**
   *
   * `forecastItemIds` เก็บ id ตรงๆ ไม่ใช่ groupId เพื่อเลี่ยงปัญหา cascade delete ตอนสลาย/ลบกลุ่ม
   * แต่พอ user เอาสินค้าตัวใหม่มาใส่กลุ่มที่ติดตามอยู่ (เช่นซื้ออาหารแมวยี่ห้อ C มาเพิ่มในกลุ่มที่มี A+B)
   * ตัวใหม่ก็ควรเข้าคาดคะเนอัตโนมัติ — user บอกไปแล้วว่ามันคือของประเภทเดียวกัน
   *
   * id ที่ชี้ไปของที่ลบแล้วถูกฟิลเตอร์ทิ้งใน `normalizeDB` ให้แล้ว
   */
  const selectedItems = useMemo(() => {
    const idSet = new Set(ids);
    const trackedGroupIds = new Set<string>();
    for (const item of db.items) {
      if (item.groupId && idSet.has(item.id)) trackedGroupIds.add(item.groupId);
    }
    return db.items.filter((i) => idSet.has(i.id) || (i.groupId && trackedGroupIds.has(i.groupId)));
  }, [ids, db.items]);

  /**
   * จัดกลุ่มของที่ติดตามเป็น "ก้อน" 1 การ์ด — สินค้าคนละยี่ห้อ/ร้านที่ผู้ใช้จัดกลุ่มไว้ว่าเป็นตัวเดียวกัน
   * (`groupId` เดียวกัน) รวมประวัติซื้อ/ใช้เข้าด้วยกัน ไม่งั้นแยกเป็นสองการ์ดที่ข้อมูลแต่ละก้อนไม่พอเดา
   */
  const clusters = useMemo(() => buildForecastClusters(selectedItems), [selectedItems]);

  /** คำนวณสถิติทีละก้อน — ไม่วนทั้งสต็อก (นี่คือจุดที่ช่วยเรื่องประสิทธิภาพ) */
  const statsByKey = useMemo(() => {
    const map = new Map<string, RepurchaseStats | null>();
    for (const c of clusters) map.set(c.key, repurchaseStats(c.merged));
    return map;
  }, [clusters]);

  const spendByKey = useMemo(() => {
    const map = new Map<string, SpendRate | null>();
    for (const c of clusters) map.set(c.key, spendRate(c.merged));
    return map;
  }, [clusters]);

  const sorted = useMemo(() => sortByDueSoonest(clusters.map((c) => ({ ...c, id: c.key })), statsByKey), [clusters, statsByKey]);

  /**
   * ซ่อนสมาชิกของกลุ่มที่ถูกติดตามอยู่แล้วออกจากตัวเลือก — ไม่งั้นจะเห็นซ้ำ (พี่คนแรกถูกเลือกไปแล้ว
   * น้องยังโผล่ทุกคน) แถวเดียวก็พอเพราะ `toggleForecast` ขยายให้ทั้งกลุ่มอัตโนมัติ
   */
  const trackedGroupIds = useMemo(() => {
    const set = new Set<string>();
    for (const i of selectedItems) if (i.groupId) set.add(i.groupId);
    return set;
  }, [selectedItems]);

  const pickableItems = useMemo(
    () => db.items.filter((i) => !ids.includes(i.id) && !(i.groupId && trackedGroupIds.has(i.groupId))),
    [db.items, ids, trackedGroupIds],
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
          {sorted.map((c) => (
            <ForecastCard
              key={c.key}
              cluster={c}
              stats={statsByKey.get(c.key) ?? null}
              spend={spendByKey.get(c.key) ?? null}
              onRemove={() => actions.toggleForecast(c.members[0].id)}
            />
          ))}
        </div>
      )}

      <ModalShell open={picking} title="เลือกสินค้ามาติดตาม" onClose={() => setPicking(false)}>
        <div className="modal-body">
          <StockPicker
            items={pickableItems}
            onPick={(item) => {
              actions.toggleForecast(item.id);
              setPicking(false);
            }}
            onClose={() => setPicking(false)}
            emptyStockText="สต็อกว่างเปล่า"
            meta={(i) => {
              const times = buyTimes(i);
              const timesText = times >= 2 ? `ซื้อ ${times} ครั้ง` : `ประวัติไม่พอ (${times || 0} ครั้ง)`;
              // ถ้าเป็นสมาชิกของกลุ่ม บอกให้ผู้ใช้รู้ว่าจะติดตามทั้งกลุ่ม ไม่ใช่แค่ยี่ห้อเดียว
              return (
                <span style={{ color: "var(--muted)" }}>
                  {i.groupId && i.groupName ? `👥 ${i.groupName} · ` : ""}
                  {timesText}
                </span>
              );
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
  cluster,
  stats,
  spend,
  onRemove,
}: {
  cluster: ForecastCluster;
  stats: RepurchaseStats | null;
  spend: SpendRate | null;
  onRemove: () => void;
}) {
  const isGroup = cluster.members.length > 1;
  // สำหรับกลุ่ม: บรรทัดรองย่อเหลือ "👥 N ยี่ห้อ" — รายชื่อสมาชิกฉบับเต็มไปอยู่ใน title (hover ดูได้)
  // ก่อนหน้านี้กระจายชื่อทุกยี่ห้อในบรรทัดเดียว การ์ดกลุ่มที่มีสมาชิก 4-5 ตัวยาวจนอ่านยาก
  const subtitle = isGroup ? `👥 ${cluster.members.length} ยี่ห้อ` : cluster.subtitle;
  const memberList = isGroup ? cluster.members.map((m) => m.name).join(", ") : undefined;
  return (
    <div className={`forecast-card ${forecastToneClass(stats)}`}>
      <div className="forecast-card__head">
        {cluster.img ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="forecast-card__thumb" src={cluster.img} alt="" />
        ) : (
          <span className="forecast-card__thumb forecast-card__thumb--empty">{isGroup ? "👥" : "📦"}</span>
        )}
        <div className="forecast-card__title">
          <div className="forecast-card__name" title={memberList}>{cluster.name}</div>
          {subtitle && <div className="forecast-card__variant" title={memberList}>{subtitle}</div>}
        </div>
        <button
          className="btn-ghost btn-sm"
          onClick={onRemove}
          title={isGroup ? "ลบทั้งกลุ่มออกจากการติดตาม" : "ลบออกจากการติดตาม"}
        >
          ลบ
        </button>
      </div>

      {stats ? <ForecastBody cluster={cluster} stats={stats} spend={spend} /> : <ForecastEmpty cluster={cluster} />}
    </div>
  );
}

function ForecastBody({
  cluster,
  stats,
  spend,
}: {
  cluster: ForecastCluster;
  stats: RepurchaseStats;
  spend: SpendRate | null;
}) {
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

      {/* ข้อมูลรอง — เดิมยัดหลายอย่างต่อบรรทัด อ่านยาก ตอนนี้เป็นชิปเรียงเป็นแถวเดียวขึ้นบรรทัดใหม่เอง */}
      <div className="forecast-card__stats">
        <span className="forecast-card__stat" title={`ค่าเฉลี่ยจากช่วงห่างการซื้อ ${purchases} ครั้ง`}>
          📈 {daysPerPackText}
        </span>
        <span className="forecast-card__stat" title="วันที่ซื้อครั้งล่าสุด">
          🗓️ {formatThaiShortDate(lastDate)}
        </span>
        {spend && (
          <span className="forecast-card__stat" title={`ตกวันละ ${baht(spend.bahtPerDay)}`}>
            💸 {baht(spend.bahtPerMonth)}/เดือน
          </span>
        )}
      </div>

      {confidence === "low" && (
        <div className="forecast-card__warn">⚠️ ข้อมูลยังน้อย ตัวเลขเป็นการเดาคร่าวๆ</div>
      )}

      <PurchaseTimeline cluster={cluster} stats={stats} lastQty={lastQty} daysPerPack={daysPerPack} />
    </>
  );
}

/**
 * แผงประวัติที่ใช้คำนวณ — พับเก็บอยู่ กดขยายเพื่อดู
 *
 * ผู้ใช้เห็นแค่ "อีก 15 วัน" ไม่รู้ว่าตัวเลขมาจากไหน กดขยายจะเห็นทุกครั้งที่เคยซื้อ
 * (วันไหน · จำนวน · ราคา · ยี่ห้อไหน สำหรับกลุ่ม) + สูตรที่เอาไปคูณเป็นวันที่ทำนาย
 */
function PurchaseTimeline({
  cluster,
  stats,
  lastQty,
  daysPerPack,
}: {
  cluster: ForecastCluster;
  stats: RepurchaseStats;
  lastQty: number;
  daysPerPack: number;
}) {
  const isGroup = cluster.members.length > 1;
  const rows = useMemo(() => {
    // แผ่ประวัติของทุกสมาชิกเข้าด้วยกัน พร้อมชื่อยี่ห้อ — เรียงใหม่→เก่า (บนสุดคือครั้งล่าสุด)
    const out = cluster.members.flatMap((m) =>
      (m.priceHistory ?? [])
        .filter((p) => /^\d{4}-\d{2}-\d{2}$/.test(p.date))
        .map((p) => ({ date: p.date, qty: p.qty, price: p.price, shop: p.shop, memberName: m.name }))
    );
    return out.sort((a, b) => b.date.localeCompare(a.date));
  }, [cluster.members]);

  return (
    <details className="forecast-card__details">
      <summary className="forecast-card__details-head">
        ดูประวัติที่ใช้คำนวณ · {stats.purchases} ครั้ง
      </summary>
      <div className="forecast-card__formula">
        เฉลี่ย <b>{Math.round(daysPerPack)}</b> วัน/แพ็ค × <b>{lastQty}</b> แพ็คของครั้งล่าสุด
        = อีก <b>{Math.round(daysPerPack * lastQty)}</b> วันจาก {formatThaiShortDate(stats.lastDate)}
      </div>
      <ul className="forecast-card__log">
        {rows.map((r, i) => (
          <li key={i}>
            <span className="forecast-card__log-date">{formatThaiShortDate(r.date)}</span>
            {isGroup && <span className="forecast-card__log-brand">{r.memberName}</span>}
            <span className="forecast-card__log-qty">
              {r.qty} แพ็ค{r.price != null ? ` × ${baht(r.price)}` : ""}
            </span>
            {r.shop && <span className="forecast-card__log-shop">🏪 {r.shop}</span>}
          </li>
        ))}
      </ul>
    </details>
  );
}

function ForecastEmpty({ cluster }: { cluster: ForecastCluster }) {
  // นับรวมทั้งกลุ่ม — สมาชิกแต่ละคนอาจซื้อครั้งเดียว แต่พอรวมกันแล้วอาจถึงเกณฑ์
  const times = cluster.members.reduce((s, m) => s + buyTimes(m), 0);
  const isGroup = cluster.members.length > 1;
  return (
    <div className="forecast-card__empty">
      ยังซื้อไม่ถึง 2 ครั้ง (ตอนนี้ {times || 0} ครั้ง) — คาดคะเนไม่ได้
      <br />
      <small>
        {isGroup
          ? "ข้อมูลจะเริ่มพร้อมใช้เมื่อสมาชิกในกลุ่มถูกซื้อรวมกันครบ 2 ครั้ง"
          : "ข้อมูลจะเริ่มพร้อมใช้เมื่อนำเข้าออเดอร์ครั้งที่ 2 ของสินค้าชิ้นนี้"}
      </small>
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
