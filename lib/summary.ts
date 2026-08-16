/**
 * คำนวณยอดสำหรับหน้า `/summary` — คำนวณล้วนๆ ไม่มี state (เทียบเคียง lib/cost.ts, lib/plan.ts)
 *
 * หัวใจคือ **ทุกยอดคิดจาก "ครั้งที่ซื้อ" (`item.priceHistory`) ไม่ใช่ของที่เหลือในสต็อก**
 * ของที่ซื้อเดือนมีนาแล้วใช้หมดไปแล้ว (`qty` เหลือ 0) ต้องยังโผล่เป็นยอดจ่ายของเดือนมีนาอยู่
 * และของที่ซื้อซ้ำ 3 ครั้งต้องกระจายยอดไปตามเดือนที่ซื้อจริง ไม่ใช่กองรวมที่ `purchasedAt` ครั้งล่าสุด
 * "มูลค่าของที่เหลือในสต็อก" (`price × qty`) เป็นคนละยอดกัน — ดู `stockValue`
 */
import { monthISO, thaiMonthLabel } from "./date";
import { priceStats, roundBaht } from "./price";
import type { StockItem } from "./types";

export const UNCATEGORIZED = "ไม่มีหมวดหมู่";
export const UNKNOWN_DATE = "ไม่ทราบวันที่";

/** การซื้อ 1 ครั้ง (1 จุดใน `priceHistory`) — หน่วยเล็กที่สุดที่ทุกยอดในหน้าสรุปคิดมาจากมัน */
export interface SpendEvent {
  itemId: string;
  name: string;
  cats: string[];
  /** `YYYY-MM-DD` — `""` = ไม่ทราบวันที่ (ไม่ถูกนับในยอดรายเดือน/ตัวกรองช่วงวันที่) */
  date: string;
  /** ซื้อกี่แพ็ค/ชิ้นในครั้งนั้น */
  qty: number;
  /** เงินที่จ่ายครั้งนั้น = ราคาต่อแพ็ค × qty */
  spend: number;
}

/**
 * แตกทุกครั้งที่ซื้อของทุกชิ้นออกมาเป็นลิสต์เดียว
 * ของที่ยังไม่มีประวัติราคาแต่กรอกราคาไว้ ถือเป็นการซื้อ 1 ครั้งตาม `buyQty` (ไม่ใช่ `qty` ที่เป็นของคงเหลือ)
 */
export function spendEvents(items: StockItem[]): SpendEvent[] {
  const out: SpendEvent[] = [];
  for (const i of items) {
    const cats = i.cats.length ? i.cats : [UNCATEGORIZED];
    const history = (i.priceHistory ?? []).filter((p) => typeof p?.price === "number" && Number.isFinite(p.price));
    if (history.length > 0) {
      for (const p of history) {
        const qty = p.qty > 0 ? p.qty : 1;
        out.push({ itemId: i.id, name: i.name, cats, date: p.date || i.purchasedAt || "", qty, spend: p.price * qty });
      }
      continue;
    }
    if (typeof i.price === "number" && Number.isFinite(i.price)) {
      const qty = i.buyQty && i.buyQty > 0 ? i.buyQty : 1;
      out.push({ itemId: i.id, name: i.name, cats, date: i.purchasedAt || "", qty, spend: i.price * qty });
    }
  }
  return out;
}

/** กรองเฉพาะที่ซื้อในช่วง `from`–`to` (รวมสองวันปลาย) — ครั้งที่ไม่รู้วันที่ตกไปเองเพราะ `""` เทียบไม่ผ่าน */
export function eventsInRange(events: SpendEvent[], from: string, to: string): SpendEvent[] {
  return events.filter((e) => e.date >= from && e.date <= to);
}

export interface SpendRow {
  key: string;
  label: string;
  /** ซื้อไปกี่ครั้ง */
  times: number;
  /** รวมกี่แพ็ค/ชิ้น */
  qty: number;
  spend: number;
}

/** จัดกลุ่มครั้งที่ซื้อตามคีย์ (1 ครั้งอยู่ได้หลายคีย์ เช่นของที่ติดหลายหมวด) เรียงยอดมาก→น้อย */
export function groupSpend(
  events: SpendEvent[],
  keyOf: (e: SpendEvent) => string[],
  labelOf: (key: string) => string = (k) => k
): SpendRow[] {
  const map = new Map<string, SpendRow>();
  for (const e of events) {
    for (const key of keyOf(e)) {
      const cur = map.get(key) || { key, label: labelOf(key), times: 0, qty: 0, spend: 0 };
      cur.times += 1;
      cur.qty += e.qty;
      cur.spend += e.spend;
      map.set(key, cur);
    }
  }
  return [...map.values()].sort((a, b) => b.spend - a.spend || b.qty - a.qty);
}

/** ยอดตามหมวดหมู่ — ของที่ติดหลายหมวดถูกนับซ้ำในทุกหมวด (ผลรวมทุกแถวจึงมากกว่ายอดจริงได้) */
export function byCategory(events: SpendEvent[]): SpendRow[] {
  return groupSpend(events, (e) => e.cats);
}

/** ยอดรายเดือน เรียงเดือนใหม่→เก่า (กองที่ไม่ทราบวันที่ไว้ท้ายสุด) */
export function byMonth(events: SpendEvent[]): SpendRow[] {
  return groupSpend(
    events,
    (e) => [e.date ? e.date.slice(0, 7) : "unknown"],
    (key) => (key === "unknown" ? UNKNOWN_DATE : thaiMonthLabel(key))
  ).sort((a, b) => {
    if (a.key === "unknown") return 1;
    if (b.key === "unknown") return -1;
    return b.key.localeCompare(a.key);
  });
}

/** ยอดรายชิ้น (รวมทุกครั้งที่ซื้อของชิ้นนั้น) — ใช้ตอบว่า "จ่ายให้ของชิ้นไหนมากที่สุด" */
export function byItem(events: SpendEvent[]): SpendRow[] {
  const nameOf = new Map(events.map((e) => [e.itemId, e.name]));
  return groupSpend(events, (e) => [e.itemId], (id) => nameOf.get(id) || "(ไม่มีชื่อ)");
}

export function totalSpend(events: SpendEvent[]): number {
  return events.reduce((s, e) => s + e.spend, 0);
}

export interface SpendOverview {
  /** ยอดที่จ่ายไปในเดือนปฏิทินนี้ */
  thisMonth: number;
  lastMonth: number;
  /** เปลี่ยนแปลงจากเดือนที่แล้วเป็น % — null ถ้าเดือนที่แล้วไม่มียอด (เทียบไม่ได้) */
  momPct: number | null;
  /** ยอดปีนี้ (ปี ค.ศ. ตามวันที่ซื้อ) */
  thisYear: number;
  /** เฉลี่ยต่อเดือน คิดจากเดือนที่มีการซื้อจริง **ไม่นับเดือนนี้** เพราะเดือนนี้ยังไม่จบ เอามาเฉลี่ยจะดึงค่าลง */
  avgPerMonth: number;
  /** เอาไปคิดค่าเฉลี่ยจากกี่เดือน */
  monthsCounted: number;
  /** ยอดจ่ายรวมทุกครั้งที่บันทึกไว้ */
  total: number;
  /** ซื้อไปทั้งหมดกี่ครั้ง */
  times: number;
  /** มูลค่าของที่ยังเหลือในสต็อกตอนนี้ = ราคาต่อชิ้น × จำนวนคงเหลือ (คนละยอดกับเงินที่จ่ายไป) */
  stockValue: number;
  stockQty: number;
}

export function spendOverview(events: SpendEvent[], items: StockItem[], now: Date = new Date()): SpendOverview {
  const thisKey = monthISO(0, now);
  const lastKey = monthISO(-1, now);
  const yearKey = thisKey.slice(0, 4);

  const perMonth = new Map<string, number>();
  let thisMonth = 0;
  let lastMonth = 0;
  let thisYear = 0;
  let total = 0;
  for (const e of events) {
    total += e.spend;
    if (!e.date) continue;
    const key = e.date.slice(0, 7);
    perMonth.set(key, (perMonth.get(key) || 0) + e.spend);
    if (key === thisKey) thisMonth += e.spend;
    if (key === lastKey) lastMonth += e.spend;
    if (key.slice(0, 4) === yearKey) thisYear += e.spend;
  }

  // เดือนที่ยังไม่จบเอามาเฉลี่ยไม่ได้ แต่ถ้ามีข้อมูลแค่เดือนนี้เดือนเดียวก็ต้องใช้มันไปก่อน
  const past = [...perMonth.entries()].filter(([k]) => k !== thisKey).map(([, v]) => v);
  const base = past.length > 0 ? past : perMonth.has(thisKey) ? [thisMonth] : [];
  const avgPerMonth = base.length > 0 ? roundBaht(base.reduce((s, v) => s + v, 0) / base.length) : 0;

  let stockValue = 0;
  let stockQty = 0;
  for (const i of items) {
    stockQty += i.qty;
    stockValue += (i.price ?? 0) * i.qty;
  }

  return {
    thisMonth: roundBaht(thisMonth),
    lastMonth: roundBaht(lastMonth),
    momPct: lastMonth > 0 ? Math.round(((thisMonth - lastMonth) / lastMonth) * 100) : null,
    thisYear: roundBaht(thisYear),
    avgPerMonth,
    monthsCounted: base.length,
    total: roundBaht(total),
    times: events.length,
    stockValue: roundBaht(stockValue),
    stockQty,
  };
}

export type InsightTone = "info" | "good" | "warn";

/** 1 ประโยคสรุปที่อ่านแล้วรู้เลยว่าต้องทำอะไรต่อ — หน้า `/summary` โชว์เรียงตามลำดับที่คืนมา */
export interface Insight {
  key: string;
  tone: InsightTone;
  text: string;
}

const money = (n: number) => `฿${roundBaht(n).toLocaleString("th-TH", { maximumFractionDigits: 2 })}`;

/**
 * แปลงตัวเลขเป็นประโยคภาษาคน — เดือนนี้จ่ายเท่าไร เกินค่าเฉลี่ยไหม อะไรกินงบ ราคาอะไรขึ้น และข้อมูลไหนยังขาด
 * `rangeEvents`/`rangeLabel` คือช่วงวันที่ที่ผู้ใช้เลือกอยู่บนหน้าจอ (ไม่ใช่ทั้งหมด)
 */
export function summaryInsights(
  items: StockItem[],
  overview: SpendOverview,
  rangeEvents: SpendEvent[],
  rangeLabel: string,
  now: Date = new Date()
): Insight[] {
  const out: Insight[] = [];
  const thisMonthName = thaiMonthLabel(monthISO(0, now));

  if (overview.times === 0) {
    return [{
      key: "empty",
      tone: "info",
      text: "ยังไม่มีประวัติราคาสักรายการ — กรอกราคาในหน้าสินค้า หรือนำเข้าจาก Shopee แล้วยอดทั้งหมดจะคำนวณให้เอง",
    }];
  }

  // 1) เดือนนี้จ่ายไปเท่าไร เทียบเดือนที่แล้ว
  if (overview.momPct == null) {
    out.push({
      key: "month",
      tone: "info",
      text: `เดือน${thisMonthName} จ่ายไปแล้ว ${money(overview.thisMonth)} (เดือนที่แล้วไม่มีรายการซื้อ เลยยังเทียบไม่ได้)`,
    });
  } else {
    const up = overview.momPct >= 0;
    out.push({
      key: "month",
      tone: overview.momPct > 30 ? "warn" : up ? "info" : "good",
      text: `เดือน${thisMonthName} จ่ายไปแล้ว ${money(overview.thisMonth)} — ${up ? "มากกว่า" : "น้อยกว่า"}เดือนที่แล้ว ${Math.abs(overview.momPct)}% (เดือนที่แล้ว ${money(overview.lastMonth)})`,
    });
  }

  // 2) เทียบกับค่าเฉลี่ยต่อเดือน = สัญญาณว่าเดือนนี้ใช้เกินตัวหรือยัง
  if (overview.avgPerMonth > 0 && overview.monthsCounted > 0) {
    const diff = overview.thisMonth - overview.avgPerMonth;
    if (diff > overview.avgPerMonth * 0.2) {
      out.push({
        key: "avg",
        tone: "warn",
        text: `เกินค่าเฉลี่ยต่อเดือน (${money(overview.avgPerMonth)} จาก ${overview.monthsCounted} เดือน) ไปแล้ว ${money(diff)}`,
      });
    } else if (diff < -overview.avgPerMonth * 0.2) {
      out.push({
        key: "avg",
        tone: "good",
        text: `ยังต่ำกว่าค่าเฉลี่ยต่อเดือน (${money(overview.avgPerMonth)}) อยู่ ${money(-diff)}`,
      });
    }
  }

  // 3) อะไรกินงบในช่วงที่เลือกดูอยู่
  const rangeTotal = totalSpend(rangeEvents);
  if (rangeTotal > 0) {
    const topCat = byCategory(rangeEvents)[0];
    if (topCat) {
      out.push({
        key: "cat",
        tone: "info",
        text: `${rangeLabel}: หมวด "${topCat.label}" กินงบมากที่สุด ${money(topCat.spend)} (${Math.round((topCat.spend / rangeTotal) * 100)}% ของ ${money(rangeTotal)})`,
      });
    }
    const topItem = byItem(rangeEvents)[0];
    if (topItem && topItem.spend > 0) {
      out.push({
        key: "item",
        tone: "info",
        text: `ของที่จ่ายให้มากที่สุดคือ "${topItem.label}" ${money(topItem.spend)}${topItem.times > 1 ? ` จากการซื้อ ${topItem.times} ครั้ง` : ""}`,
      });
    }
  }

  // 4) ของที่ราคาขึ้นจากค่าเฉลี่ยเกิน 15% — เตือนก่อนสั่งซ้ำรอบหน้า
  let worst: { name: string; latest: number; avg: number; pct: number } | null = null;
  for (const i of items) {
    const stats = priceStats(i.priceHistory);
    if (!stats || stats.times < 2 || stats.avg <= 0) continue;
    const pct = Math.round(((stats.latest.price - stats.avg) / stats.avg) * 100);
    if (pct >= 15 && (!worst || pct > worst.pct)) {
      worst = { name: i.name, latest: stats.latest.price, avg: stats.avg, pct };
    }
  }
  if (worst) {
    out.push({
      key: "price-up",
      tone: "warn",
      text: `ราคาขึ้น: "${worst.name}" ครั้งล่าสุด ${money(worst.latest)} สูงกว่าราคาเฉลี่ย ${money(worst.avg)} อยู่ ${worst.pct}%`,
    });
  }

  // 5) ข้อมูลที่ยังขาด = เหตุผลว่าทำไมยอดอาจต่ำกว่าความจริง
  const noPrice = items.filter((i) => i.price == null && !(i.priceHistory ?? []).length).length;
  if (noPrice > 0) {
    out.push({
      key: "no-price",
      tone: "warn",
      text: `มี ${noPrice} รายการที่ยังไม่ได้กรอกราคา ยอดจริงจึงสูงกว่าที่เห็น — เติมราคาในหน้าสินค้าแล้วตัวเลขจะครบ`,
    });
  }
  const noDate = new Set(spendEvents(items).filter((e) => !e.date).map((e) => e.itemId)).size;
  if (noDate > 0) {
    out.push({
      key: "no-date",
      tone: "warn",
      text: `มี ${noDate} รายการที่ไม่ทราบวันที่ซื้อ ยอดของมันไปกองอยู่แถว "${UNKNOWN_DATE}" และไม่ถูกนับในช่วงวันที่ที่เลือก`,
    });
  }
  const unverified = items.filter((i) => i.priceUnverified).length;
  if (unverified > 0) {
    out.push({
      key: "unverified",
      tone: "warn",
      text: `มี ${unverified} รายการที่ราคายังไม่ยืนยัน (อาจเป็นยอดรวมทั้งแถวจาก Shopee ไม่ใช่ราคาต่อชิ้น) ยอดอาจสูงเกินจริง`,
    });
  }

  return out;
}
