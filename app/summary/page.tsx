"use client";

import { useMemo, useState } from "react";
import { baht } from "@/lib/cost";
import { daysAgoISO, formatThaiShortDate, todayISO } from "@/lib/date";
import { extrasInRange, orderExtras, orderNet, sortOrders, totalExtras } from "@/lib/orders";
import { useStockDB } from "@/lib/StockDBProvider";
import { useOrderActions } from "@/lib/useOrderActions";
import {
  byCategory,
  byItem,
  byMonth,
  byShop,
  eventsInRange,
  spendEvents,
  spendOverview,
  summaryInsights,
  totalSpend,
  type SpendRow,
} from "@/lib/summary";

type RangeMode = "30d" | "90d" | "year" | "all" | "custom";

/** แท็บของหน้าสรุป — สามตัวใน RANGE_TABS ใช้ตัวเลือก "ช่วงวันที่" ร่วมกัน state จึงอยู่ระดับหน้า ไม่หายตอนสลับแท็บ */
type Tab = "overview" | "category" | "shop" | "item" | "month" | "orders";

const TABS: { id: Tab; label: string }[] = [
  { id: "overview", label: "ภาพรวม" },
  { id: "category", label: "ตามหมวดหมู่" },
  { id: "shop", label: "ตามร้านค้า" },
  { id: "item", label: "รายชิ้น" },
  { id: "month", label: "รายเดือน" },
  { id: "orders", label: "ค่าส่ง/ส่วนลด" },
];

/** แท็บที่คิดยอดจากช่วงวันที่ที่เลือก จึงต้องโชว์แถบเลือกช่วง + ยอดรวมของช่วงนั้นไว้ด้านบนตาราง */
const RANGE_TABS: Tab[] = ["category", "shop", "item"];

// ชุดสีจัดหมวดหมู่ (categorical) ที่ผ่านการตรวจสอบว่าแยกแยะได้ชัดทั้งคนตาปกติและตาบอดสี — ใช้ตามลำดับคงที่
const CAT_COLORS = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#4a3aa7", "#e34948"];

const RANGE_OPTIONS: { value: RangeMode; label: string }[] = [
  { value: "30d", label: "30 วันล่าสุด" },
  { value: "90d", label: "90 วันล่าสุด" },
  { value: "year", label: "ปีนี้" },
  { value: "all", label: "ทั้งหมด" },
  { value: "custom", label: "กำหนดช่วงวันที่เอง" },
];

export default function SummaryPage() {
  const { db, setDb } = useStockDB();
  const orderActions = useOrderActions(setDb);

  const [tab, setTab] = useState<Tab>("overview");
  const [rangeMode, setRangeMode] = useState<RangeMode>("30d");
  const [from, setFrom] = useState(daysAgoISO(29));
  const [to, setTo] = useState(todayISO());
  const [yearFilter, setYearFilter] = useState("all");

  const events = useMemo(() => spendEvents(db.items), [db.items]);
  const extras = useMemo(() => orderExtras(db.orders), [db.orders]);
  const overview = useMemo(() => spendOverview(events, db.items, extras), [events, db.items, extras]);

  const years = useMemo(() => {
    const set = new Set<string>();
    for (const e of events) if (e.date) set.add(e.date.slice(0, 4));
    return [...set].sort((a, b) => b.localeCompare(a));
  }, [events]);

  /** ช่วงวันที่ที่กำลังดูอยู่ — `null` = ทั้งหมด (รวมครั้งที่ไม่ทราบวันที่ด้วย) */
  const range = useMemo<{ from: string; to: string } | null>(() => {
    if (rangeMode === "all") return null;
    if (rangeMode === "30d") return { from: daysAgoISO(29), to: todayISO() };
    if (rangeMode === "90d") return { from: daysAgoISO(89), to: todayISO() };
    if (rangeMode === "year") return { from: `${todayISO().slice(0, 4)}-01-01`, to: todayISO() };
    return { from, to };
  }, [rangeMode, from, to]);

  const rangeEvents = useMemo(
    () => (range ? eventsInRange(events, range.from, range.to) : events),
    [events, range]
  );

  const rangeExtras = useMemo(
    () => (range ? extrasInRange(extras, range.from, range.to) : extras),
    [extras, range]
  );

  const rangeLabel = useMemo(() => {
    if (rangeMode === "custom") return `${formatThaiShortDate(from) || from} – ${formatThaiShortDate(to) || to}`;
    return RANGE_OPTIONS.find((o) => o.value === rangeMode)?.label ?? "";
  }, [rangeMode, from, to]);

  const insights = useMemo(
    () => summaryInsights(db.items, overview, rangeEvents, rangeLabel),
    [db.items, overview, rangeEvents, rangeLabel]
  );

  const catRows = useMemo(() => byCategory(rangeEvents), [rangeEvents]);
  const itemRows = useMemo(() => byItem(rangeEvents).slice(0, 10), [rangeEvents]);
  const shopRows = useMemo(() => byShop(rangeEvents), [rangeEvents]);
  /** ยอด "ค่าสินค้า" ล้วนๆ — ใช้เป็นตัวหารของสัดส่วนในตาราง ค่าส่ง/ส่วนลดไม่มีหมวดหมู่จึงเข้าตารางไม่ได้ */
  const rangeTotal = useMemo(() => totalSpend(rangeEvents), [rangeEvents]);
  const rangeExtrasTotal = useMemo(() => totalExtras(rangeExtras), [rangeExtras]);

  const orders = useMemo(() => sortOrders(db.orders ?? []), [db.orders]);

  const monthRows = useMemo(() => {
    const inYear = (d: string) => yearFilter === "all" || d.slice(0, 4) === yearFilter;
    const scoped = events.filter((e) => inYear(e.date));
    return byMonth(scoped, extras.filter((x) => inYear(x.date)));
  }, [events, extras, yearFilter]);

  const renderTable = (rows: SpendRow[], firstColLabel: string, showDot: boolean, showShare = false) => {
    if (rows.length === 0) return <div className="empty">ยังไม่มีรายการซื้อในช่วงที่เลือก</div>;
    const maxValue = Math.max(...rows.map((r) => r.spend), 1);
    return (
      <table>
        <thead>
          <tr>
            <th>{firstColLabel}</th>
            <th>ครั้งที่ซื้อ</th>
            <th>จำนวนชิ้น</th>
            <th>ยอดที่จ่าย{showShare && rangeTotal > 0 ? " (สัดส่วน)" : ""}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, idx) => (
            <tr key={r.key}>
              <td>
                {showDot && (
                  <span className="summary-dot" style={{ background: CAT_COLORS[idx % CAT_COLORS.length] }} />
                )}
                {r.label}
              </td>
              <td>{r.times}</td>
              <td>{r.qty}</td>
              <td>
                <div className="summary-bar-cell">
                  <span className="summary-bar-track">
                    <span className="summary-bar-fill" style={{ width: `${(r.spend / maxValue) * 100}%` }} />
                  </span>
                  <span className="summary-bar-label">
                    {baht(r.spend)}
                    {showShare && rangeTotal > 0 && (
                      <small className="summary-share"> {Math.round((r.spend / rangeTotal) * 100)}%</small>
                    )}
                  </span>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  };

  return (
    <div className="page">
      <h1>📊 สรุปยอด</h1>

      <div className="tabs">
        {TABS.map((t) => (
          <button
            key={t.id}
            className={`tab-btn ${tab === t.id ? "active" : ""}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {RANGE_TABS.includes(tab) && (
        <>
          <div className="toolbar">
            <select value={rangeMode} onChange={(e) => setRangeMode(e.target.value as RangeMode)}>
              {RANGE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            {rangeMode === "custom" && (
              <>
                <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
                <span>ถึง</span>
                <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
              </>
            )}
          </div>
          <div className="stats">
            <div className="stat stat--blue"><div className="n">{rangeEvents.length}</div><div className="l">ครั้งที่ซื้อ</div></div>
            <div className="stat stat--orange"><div className="n">{rangeEvents.reduce((s, e) => s + e.qty, 0)}</div><div className="l">จำนวนที่ซื้อรวม</div></div>
            <div className="stat stat--green">
              <div className="n">{baht(rangeTotal + rangeExtrasTotal)}</div>
              <div className="l">จ่ายไปในช่วงนี้{rangeExtrasTotal !== 0 ? ` (ค่าสินค้า ${baht(rangeTotal)} + ค่าส่ง/ส่วนลด ${baht(rangeExtrasTotal)})` : ""}</div>
            </div>
            <div className="stat stat--violet">
              <div className="n">{baht(rangeEvents.length ? rangeTotal / rangeEvents.length : 0)}</div>
              <div className="l">เฉลี่ยต่อครั้ง</div>
            </div>
          </div>
        </>
      )}

      {tab === "overview" && (
        <>
          <p className="sub sub-tight text-xs">
            ทุกยอดคิดจาก <b>ประวัติราคาทุกครั้งที่ซื้อ</b> (ราคาต่อแพ็ค × จำนวนที่ซื้อครั้งนั้น) ของที่ใช้หมดไปแล้วก็ยังนับเป็นเงินที่จ่ายในเดือนที่ซื้อ
            — ส่วน &quot;มูลค่าของที่เหลือ&quot; เป็นคนละยอด คิดจากของที่ยังอยู่ในสต็อกตอนนี้
          </p>

          <div className="stats">
            <div className="stat stat--blue">
              <div className="n">{baht(overview.thisMonth)}</div>
              <div className="l">
                จ่ายเดือนนี้
                {overview.momPct != null && (
                  <span className={`summary-delta ${overview.momPct >= 0 ? "is-up" : "is-down"}`}>
                    {overview.momPct >= 0 ? "▲" : "▼"} {Math.abs(overview.momPct)}%
                  </span>
                )}
              </div>
            </div>
            <div className="stat stat--violet">
              <div className="n">{baht(overview.avgPerMonth)}</div>
              <div className="l">เฉลี่ยต่อเดือน{overview.monthsCounted > 0 ? ` (${overview.monthsCounted} เดือน)` : ""}</div>
            </div>
            <div className="stat stat--orange">
              <div className="n">{baht(overview.thisYear)}</div>
              <div className="l">จ่ายไปทั้งปีนี้</div>
            </div>
            <div className="stat stat--green">
              <div className="n">{baht(overview.stockValue)}</div>
              <div className="l">มูลค่าของที่เหลือ ({overview.stockQty} ชิ้น)</div>
            </div>
          </div>

          {(overview.shippingTotal > 0 || overview.discountTotal > 0) && (
            <p className="sub sub-tight text-xs">
              รวมค่าส่ง {baht(overview.shippingTotal)} และหักส่วนลด/โค้ด {baht(overview.discountTotal)} ไว้ในยอดข้างบนแล้ว —
              เงินก้อนนี้ผูกกับ<b>ออเดอร์</b> ไม่ใช่สินค้าชิ้นไหน จึงไม่ปรากฏในแท็บหมวดหมู่/ร้านค้า/รายชิ้น
            </p>
          )}

          {insights.length > 0 && (
            <ul className="insight-list">
              {insights.map((ins) => (
                <li key={ins.key} className={`insight insight--${ins.tone}`}>
                  <span className="insight__icon">{ins.tone === "warn" ? "⚠️" : ins.tone === "good" ? "✅" : "•"}</span>
                  <span>{ins.text}</span>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {tab === "category" && (
        <>
          <p className="sub sub-tight text-xs">ของที่ติดหลายหมวดถูกนับในทุกหมวด ยอดรวมของทุกแถวจึงมากกว่ายอดจริงได้</p>
          {renderTable(catRows, "หมวดหมู่", true, true)}
        </>
      )}

      {tab === "shop" && (
        <>
          <p className="sub sub-tight text-xs">
            คิดจากร้านที่บันทึกไว้ในประวัติราคาแต่ละครั้ง — ครั้งที่ซื้อก่อนมีการเก็บชื่อร้านจะกองอยู่แถว &quot;ไม่ทราบร้าน&quot;
          </p>
          {renderTable(shopRows, "ร้านค้า", true, true)}
        </>
      )}

      {tab === "item" && (
        <>
          <p className="sub sub-tight text-xs">10 อันดับแรกที่จ่ายเงินไปมากที่สุดในช่วงที่เลือก</p>
          {renderTable(itemRows, "สินค้า", false, true)}
        </>
      )}

      {tab === "month" && (
        <>
          <div className="toolbar">
            <select value={yearFilter} onChange={(e) => setYearFilter(e.target.value)}>
              <option value="all">ทุกปี</option>
              {years.map((y) => (
                <option key={y} value={y}>ปี {Number(y) + 543}</option>
              ))}
            </select>
          </div>
          {renderTable(monthRows, "เดือน", false)}
        </>
      )}

      {tab === "orders" && (
        <>
          <p className="sub sub-tight text-xs">
            บันทึกให้ตอนนำเข้าจาก Shopee — แก้ตัวเลขได้ทันที (บันทึกเองอัตโนมัติ ไม่ต้องกดอะไร)
            ถ้าเผลอนำเข้าออเดอร์เดิมซ้ำจนค่าส่งถูกนับสองรอบ ให้ลบก้อนที่เกินทิ้งที่นี่ —
            ลบแล้ว<b>สินค้ากับประวัติราคาไม่หาย</b> หายเฉพาะเงินก้อนนี้
          </p>
          {orders.length === 0 ? (
            <div className="empty">
              ยังไม่มีออเดอร์ที่บันทึกค่าส่ง/ส่วนลดไว้ — กรอกช่อง &quot;ค่าใช้จ่ายของออเดอร์นี้&quot; ตอนนำเข้าจาก Shopee แล้วจะขึ้นที่นี่
            </div>
          ) : (
            <div className="order-list">
              {orders.map((o) => (
                <div className="order-row" key={o.id}>
                  <input
                    type="date"
                    value={o.date}
                    onChange={(e) => orderActions.patchOrder(o.id, { date: e.target.value })}
                  />
                  <input
                    type="text"
                    placeholder="ร้านค้า"
                    value={o.shop || ""}
                    onChange={(e) => orderActions.patchOrder(o.id, { shop: e.target.value })}
                  />
                  <label className="order-row__num">
                    ค่าส่ง
                    <input
                      type="number"
                      min={0}
                      value={o.shipping}
                      onChange={(e) => orderActions.patchOrder(o.id, { shipping: Number(e.target.value) || 0 })}
                    />
                  </label>
                  <label className="order-row__num">
                    ส่วนลด
                    <input
                      type="number"
                      min={0}
                      value={o.discount}
                      onChange={(e) => orderActions.patchOrder(o.id, { discount: Number(e.target.value) || 0 })}
                    />
                  </label>
                  <span className={`order-row__net ${orderNet(o) < 0 ? "is-saving" : ""}`}>
                    {orderNet(o) >= 0 ? "+" : "−"}{baht(Math.abs(orderNet(o)))}
                  </span>
                  <button
                    type="button"
                    className="icon-btn del"
                    title="ลบค่าส่ง/ส่วนลดของออเดอร์นี้"
                    onClick={() => orderActions.removeOrder(o)}
                  >
                    🗑️
                  </button>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
