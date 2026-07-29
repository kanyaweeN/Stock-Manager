"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useStockDB } from "@/lib/StockDBProvider";
import type { StockItem } from "@/lib/types";

interface RowSummary {
  key: string;
  label: string;
  count: number;
  qty: number;
  value: number;
}

type CatRangeMode = "30d" | "all" | "custom";

// ชุดสีจัดหมวดหมู่ (categorical) ที่ผ่านการตรวจสอบว่าแยกแยะได้ชัดทั้งคนตาปกติและตาบอดสี — ใช้ตามลำดับคงที่
const CAT_COLORS = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#4a3aa7", "#e34948"];

const THAI_MONTHS = [
  "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
  "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม",
];

function monthLabel(key: string) {
  if (key === "unknown") return "ไม่ทราบวันที่";
  const [y, m] = key.split("-").map(Number);
  return `${THAI_MONTHS[m - 1]} ${y + 543}`;
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function daysAgoStr(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

function summarize(items: StockItem[], keyOf: (i: StockItem) => string[], labelOf: (key: string) => string): RowSummary[] {
  const map = new Map<string, RowSummary>();
  for (const i of items) {
    for (const key of keyOf(i)) {
      const cur = map.get(key) || { key, label: labelOf(key), count: 0, qty: 0, value: 0 };
      cur.count += 1;
      cur.qty += i.qty;
      cur.value += (i.price ?? 0) * i.qty;
      map.set(key, cur);
    }
  }
  return [...map.values()];
}

export default function SummaryPage() {
  const { db } = useStockDB();

  const [catRangeMode, setCatRangeMode] = useState<CatRangeMode>("30d");
  const [catFrom, setCatFrom] = useState(daysAgoStr(29));
  const [catTo, setCatTo] = useState(todayStr());
  const [yearFilter, setYearFilter] = useState("all");

  const years = useMemo(() => {
    const set = new Set<string>();
    for (const i of db.items) if (i.purchasedAt) set.add(i.purchasedAt.slice(0, 4));
    return [...set].sort((a, b) => b.localeCompare(a));
  }, [db.items]);

  const catFilteredItems = useMemo(() => {
    if (catRangeMode === "all") return db.items;
    const from = catRangeMode === "30d" ? daysAgoStr(29) : catFrom;
    const to = catRangeMode === "30d" ? todayStr() : catTo;
    return db.items.filter((i) => i.purchasedAt && i.purchasedAt >= from && i.purchasedAt <= to);
  }, [db.items, catRangeMode, catFrom, catTo]);

  const catSummaries = useMemo<RowSummary[]>(
    () =>
      summarize(
        catFilteredItems,
        (i) => (i.cats.length ? i.cats : ["ไม่มีหมวดหมู่"]),
        (key) => key
      ).sort((a, b) => b.value - a.value || b.qty - a.qty),
    [catFilteredItems]
  );

  const monthFilteredItems = useMemo(() => {
    if (yearFilter === "all") return db.items;
    return db.items.filter((i) => i.purchasedAt?.slice(0, 4) === yearFilter);
  }, [db.items, yearFilter]);

  const monthSummaries = useMemo<RowSummary[]>(
    () =>
      summarize(
        monthFilteredItems,
        (i) => [i.purchasedAt ? i.purchasedAt.slice(0, 7) : "unknown"],
        monthLabel
      ).sort((a, b) => {
        if (a.key === "unknown") return 1;
        if (b.key === "unknown") return -1;
        return b.key.localeCompare(a.key);
      }),
    [monthFilteredItems]
  );

  const catTotalQty = catFilteredItems.reduce((s, i) => s + i.qty, 0);
  const catTotalValue = catFilteredItems.reduce((s, i) => s + (i.price ?? 0) * i.qty, 0);

  const renderTable = (rows: RowSummary[], firstColLabel: string, showDot: boolean) => {
    if (rows.length === 0) return <div className="empty">ยังไม่มีข้อมูลในช่วงที่เลือก</div>;
    const maxValue = Math.max(...rows.map((r) => r.value), 1);
    return (
      <table>
        <thead>
          <tr>
            <th>{firstColLabel}</th>
            <th>รายการ</th>
            <th>จำนวนชิ้น</th>
            <th>มูลค่า</th>
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
              <td>{r.count}</td>
              <td>{r.qty}</td>
              <td>
                <div className="summary-bar-cell">
                  <span className="summary-bar-track">
                    <span
                      className="summary-bar-fill"
                      style={{ width: `${(r.value / maxValue) * 100}%` }}
                    />
                  </span>
                  <span className="summary-bar-label">฿{r.value.toLocaleString("th-TH")}</span>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  };

  return (
    <div className="wrap">
      <Link href="/" className="back-link">← กลับหน้าหลัก</Link>
      <h1>📊 สรุปยอด</h1>
      <p className="sub sub-tight text-xs">
        สรุปมูลค่ารวม (จำนวน × ราคา) — รายการที่ไม่ได้กรอกราคา/วันที่ซื้อจะนับจำนวนแต่ไม่มีมูลค่า/ไม่เข้าเงื่อนไขตัวกรองวันที่
      </p>

      <h2 className="summary-section-title">ตามหมวดหมู่</h2>
      <div className="toolbar">
        <select value={catRangeMode} onChange={(e) => setCatRangeMode(e.target.value as CatRangeMode)}>
          <option value="30d">30 วันล่าสุด</option>
          <option value="custom">กำหนดช่วงวันที่เอง</option>
          <option value="all">ทั้งหมด</option>
        </select>
        {catRangeMode === "custom" && (
          <>
            <input type="date" value={catFrom} onChange={(e) => setCatFrom(e.target.value)} />
            <span>ถึง</span>
            <input type="date" value={catTo} onChange={(e) => setCatTo(e.target.value)} />
          </>
        )}
      </div>
      <div className="stats">
        <div className="stat stat--blue"><div className="n">{catFilteredItems.length}</div><div className="l">รายการในช่วงนี้</div></div>
        <div className="stat stat--orange"><div className="n">{catTotalQty}</div><div className="l">จำนวนรวม</div></div>
        <div className="stat stat--green"><div className="n">฿{catTotalValue.toLocaleString("th-TH")}</div><div className="l">มูลค่ารวม</div></div>
      </div>
      {renderTable(catSummaries, "หมวดหมู่", true)}

      <h2 className="summary-section-title">รายเดือน (ตามวันที่ซื้อ)</h2>
      <div className="toolbar">
        <select value={yearFilter} onChange={(e) => setYearFilter(e.target.value)}>
          <option value="all">ทุกปี</option>
          {years.map((y) => (
            <option key={y} value={y}>ปี {Number(y) + 543}</option>
          ))}
        </select>
      </div>
      {renderTable(monthSummaries, "เดือน", false)}
    </div>
  );
}
