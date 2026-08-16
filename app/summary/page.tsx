"use client";

import { useMemo, useState } from "react";
import { baht } from "@/lib/cost";
import { daysAgoISO, formatThaiShortDate, todayISO } from "@/lib/date";
import { useStockDB } from "@/lib/StockDBProvider";
import {
  byCategory,
  byItem,
  byMonth,
  eventsInRange,
  spendEvents,
  spendOverview,
  summaryInsights,
  totalSpend,
  type SpendRow,
} from "@/lib/summary";

type RangeMode = "30d" | "90d" | "year" | "all" | "custom";

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
  const { db } = useStockDB();

  const [rangeMode, setRangeMode] = useState<RangeMode>("30d");
  const [from, setFrom] = useState(daysAgoISO(29));
  const [to, setTo] = useState(todayISO());
  const [yearFilter, setYearFilter] = useState("all");

  const events = useMemo(() => spendEvents(db.items), [db.items]);
  const overview = useMemo(() => spendOverview(events, db.items), [events, db.items]);

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
  const rangeTotal = useMemo(() => totalSpend(rangeEvents), [rangeEvents]);

  const monthRows = useMemo(() => {
    const scoped = yearFilter === "all" ? events : events.filter((e) => e.date.slice(0, 4) === yearFilter);
    return byMonth(scoped);
  }, [events, yearFilter]);

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

      <h2 className="summary-section-title">ยอดตามช่วงเวลา</h2>
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
        <div className="stat stat--green"><div className="n">{baht(rangeTotal)}</div><div className="l">จ่ายไปในช่วงนี้</div></div>
        <div className="stat stat--violet">
          <div className="n">{baht(rangeEvents.length ? rangeTotal / rangeEvents.length : 0)}</div>
          <div className="l">เฉลี่ยต่อครั้ง</div>
        </div>
      </div>

      <h3 className="summary-sub-title">แยกตามหมวดหมู่</h3>
      <p className="sub sub-tight text-xs">ของที่ติดหลายหมวดถูกนับในทุกหมวด ยอดรวมของทุกแถวจึงมากกว่ายอดจริงได้</p>
      {renderTable(catRows, "หมวดหมู่", true, true)}

      <h3 className="summary-sub-title">จ่ายให้ของชิ้นไหนมากที่สุด</h3>
      {renderTable(itemRows, "สินค้า", false, true)}

      <h2 className="summary-section-title">ยอดรายเดือน</h2>
      <div className="toolbar">
        <select value={yearFilter} onChange={(e) => setYearFilter(e.target.value)}>
          <option value="all">ทุกปี</option>
          {years.map((y) => (
            <option key={y} value={y}>ปี {Number(y) + 543}</option>
          ))}
        </select>
      </div>
      {renderTable(monthRows, "เดือน", false)}
    </div>
  );
}
