import type { PriceRounding, PricingSettings } from "./types";

/**
 * คิดราคาขายจากต้นทุนต่อชิ้น — "ควรขายเท่าไรถึงจะได้กำไรตามที่อยากได้"
 *
 * นิยามที่ใช้ตลอดไฟล์นี้ (สำคัญ เพราะคนละนิยามได้ตัวเลขคนละเรื่อง):
 * - **กำไร % (margin)** = กำไร ÷ **ราคาขาย** — ตัวนี้คือตัวที่ใช้ตั้งเป้า เพราะเทียบกับยอดที่ลูกค้าจ่ายจริง
 * - **บวกจากทุน % (markup)** = กำไร ÷ **ต้นทุน** — ตัวที่คนมักพูดว่า "บวกสองเท่า"
 *   ทุน ฿50 ขาย ฿100 = margin 50% แต่ markup 100% เลข 2 ตัวนี้ไม่เท่ากันเสมอ จึงโชว์คู่กันบน UI
 */

export const DEFAULT_PRICING: PricingSettings = {
  targetMarginPct: 40,
  feePct: 0,
  feePerUnit: 0,
  rounding: "9",
};

/** เป้ากำไรมาตรฐานที่เอาไว้โชว์เป็นตาราง "ถ้าอยากได้กำไรเท่านี้ ต้องขายเท่านี้" */
export const MARGIN_LADDER = [20, 30, 40, 50, 60];

export const ROUNDING_OPTIONS: { value: PriceRounding; label: string }[] = [
  { value: "9", label: "ลงท้ายด้วย 9 (39, 49, 199)" },
  { value: "1", label: "จำนวนเต็มบาท" },
  { value: "5", label: "ปัดขึ้นทีละ 5" },
  { value: "10", label: "ปัดขึ้นทีละ 10" },
  { value: "none", label: "ไม่ปัด (เอาเลขจริง)" },
];

export const ROUNDING_VALUES = ROUNDING_OPTIONS.map((o) => o.value);

/**
 * ราคาขายที่ทำให้ได้กำไรตามเป้า **หลังหักค่าธรรมเนียมแล้ว**
 *
 * ราคา × (1 − ค่าธรรมเนียม%) − ค่าใช้จ่ายต่อชิ้น − ต้นทุน = กำไรที่อยากได้% × ราคา
 * ⇒ ราคา = (ต้นทุน + ค่าใช้จ่ายต่อชิ้น) ÷ (1 − ค่าธรรมเนียม% − กำไรที่อยากได้%)
 *
 * คืน `null` เมื่อตัวหาร ≤ 0 คือ ค่าธรรมเนียม + กำไรที่อยากได้ ≥ 100% — กรณีนี้ตั้งราคาสูงแค่ไหนก็ไม่มีวันถึงเป้า
 * (ค่าธรรมเนียมโตตามราคาไปด้วย) ต้องลดเป้าลงอย่างเดียว ห้ามคืนเลขมั่วให้ผู้ใช้เชื่อ
 */
export function priceForMargin(cost: number, marginPct: number, s: PricingSettings): number | null {
  const denom = 1 - (s.feePct + marginPct) / 100;
  if (denom <= 0) return null;
  const price = (cost + s.feePerUnit) / denom;
  return Number.isFinite(price) && price > 0 ? price : null;
}

/**
 * ปัดราคาให้สวย — **ปัดขึ้นเสมอ** เพื่อไม่ให้กำไรตกต่ำกว่าเป้าที่ตั้งไว้
 * โหมด "9" = ดันขึ้นไปหาเลขลงท้าย 9 ตัวถัดไป (42 → 49, 39 → 39, 150 → 159)
 */
export function roundPrice(price: number, mode: PriceRounding): number {
  if (mode === "none") return Math.round(price * 100) / 100;
  if (mode === "9") {
    const base = Math.ceil(price);
    const rem = (((base - 9) % 10) + 10) % 10;
    return rem === 0 ? base : base + (10 - rem);
  }
  const step = Number(mode) || 1;
  return Math.ceil(price / step) * step;
}

export interface PriceOutcome {
  price: number;
  /** ค่าธรรมเนียม + ค่าใช้จ่ายต่อชิ้นที่โดนหักจากราคานี้ */
  fee: number;
  /** เงินที่เหลือเข้ากระเป๋า (ก่อนหักต้นทุนของ) */
  net: number;
  profit: number;
  /** กำไร % ของราคาขาย */
  marginPct: number;
  /** บวกจากต้นทุนกี่ % */
  markupPct: number;
  /** ราคาขายเป็นกี่เท่าของต้นทุน */
  multiple: number;
}

/** ตั้งราคานี้แล้วได้อะไรกลับมาบ้าง — ใช้ทั้งกับราคาแนะนำและราคาที่ผู้ใช้ตั้งเองไว้แล้ว */
export function priceOutcome(price: number, cost: number, s: PricingSettings): PriceOutcome {
  const fee = (price * s.feePct) / 100 + s.feePerUnit;
  const net = price - fee;
  const profit = net - cost;
  return {
    price,
    fee,
    net,
    profit,
    marginPct: price > 0 ? (profit / price) * 100 : 0,
    markupPct: cost > 0 ? (profit / cost) * 100 : 0,
    multiple: cost > 0 ? price / cost : 0,
  };
}

/** ราคาที่ขายแล้วเท่าทุนพอดี (ต่ำกว่านี้ = ขาดทุน) — รวมค่าธรรมเนียมแล้ว */
export function breakEvenPrice(cost: number, s: PricingSettings): number | null {
  return priceForMargin(cost, 0, s);
}

export interface PriceOption {
  /** เป้ากำไรของแถวนี้ (% ของราคาขาย) */
  targetMarginPct: number;
  /** ราคาที่คำนวณได้ก่อนปัด */
  raw: number;
  /** ราคาที่ปัดแล้ว = ราคาที่แนะนำให้ตั้งจริง */
  price: number;
  /** ผลลัพธ์จริงของราคาที่ปัดแล้ว (กำไรจะสูงกว่าเป้านิดหน่อยเพราะปัดขึ้น) */
  outcome: PriceOutcome;
}

function optionFor(cost: number, marginPct: number, s: PricingSettings): PriceOption | null {
  const raw = priceForMargin(cost, marginPct, s);
  if (raw == null) return null;
  const price = roundPrice(raw, s.rounding);
  return { targetMarginPct: marginPct, raw, price, outcome: priceOutcome(price, cost, s) };
}

/** ราคาที่แนะนำ = ราคาตามเป้ากำไรที่ตั้งไว้ใน settings (ปัดแล้ว) */
export function suggestPrice(cost: number, s: PricingSettings): PriceOption | null {
  return optionFor(cost, s.targetMarginPct, s);
}

/**
 * ตาราง "อยากได้กำไรกี่ % → ต้องขายเท่าไร"
 * ใส่เป้าที่ผู้ใช้ตั้งไว้เข้าไปด้วยเสมอ จะได้เห็นแถวของตัวเองในตารางเทียบกับช่วงอื่น
 */
export function priceLadder(cost: number, s: PricingSettings, targets: number[] = MARGIN_LADDER): PriceOption[] {
  const all = [...new Set([...targets, s.targetMarginPct])].sort((a, b) => a - b);
  return all.map((m) => optionFor(cost, m, s)).filter((o): o is PriceOption => o !== null);
}

/** แสดง % แบบสั้นๆ ไม่เอาทศนิยมรุงรัง */
export function pct(n: number): string {
  return `${Math.round(n)}%`;
}

/** ตัวเลขเงินในประโยค (ไม่มี ฿ นำหน้า เพราะประโยคใส่เอง) */
const round2 = (n: number) => (Math.round(n * 100) / 100).toLocaleString("th-TH", { maximumFractionDigits: 2 });

/**
 * แปลตัวเลขเป็นประโยคไทยที่อ่านแล้วตัดสินใจได้เลย — **เพิ่มประโยคใหม่ที่นี่ที่เดียว**
 * (คู่กับ summaryInsights ใน lib/summary.ts ที่ทำแบบเดียวกันกับหน้าสรุปยอด)
 */
export function pricingNotes(cost: number, s: PricingSettings, sellPrice?: number): string[] {
  const notes: string[] = [];
  if (!(cost > 0)) {
    notes.push("ยังไม่รู้ต้นทุนต่อชิ้น — กรอกวัตถุดิบกับจำนวนที่ทำได้ให้ครบก่อน ถึงจะคิดราคาขายให้ได้");
    return notes;
  }

  const be = breakEvenPrice(cost, s);
  if (be != null) {
    notes.push(
      s.feePct > 0 || s.feePerUnit > 0
        ? `ขายต่ำกว่า ฿${round2(be)} = ขาดทุน (เท่าทุนพอดีหลังโดนหักค่าธรรมเนียมแล้ว)`
        : `ขายต่ำกว่า ฿${round2(be)} = ขาดทุน`
    );
  }

  const suggested = suggestPrice(cost, s);
  if (!suggested) {
    notes.push(
      `ค่าธรรมเนียม ${pct(s.feePct)} + กำไรที่อยากได้ ${pct(s.targetMarginPct)} รวมกันเกิน 100% แล้ว — ตั้งราคาสูงแค่ไหนก็ไม่ถึงเป้า เพราะค่าธรรมเนียมขึ้นตามราคาไปด้วย ต้องลดเป้ากำไรลง`
    );
    return notes;
  }

  if (sellPrice != null && sellPrice > 0) {
    const cur = priceOutcome(sellPrice, cost, s);
    if (cur.profit < 0) {
      notes.push(
        `ราคาที่ตั้งไว้ ฿${round2(sellPrice)} ขาดทุนชิ้นละ ฿${round2(-cur.profit)} — ต้องขายอย่างน้อย ฿${round2(be ?? 0)} ถึงจะเท่าทุน`
      );
    } else if (cur.marginPct + 0.5 < s.targetMarginPct) {
      notes.push(
        `ราคาที่ตั้งไว้ ฿${round2(sellPrice)} ได้กำไร ${pct(cur.marginPct)} ยังไม่ถึงเป้า ${pct(s.targetMarginPct)} — ถ้าจะให้ถึงต้องขาย ฿${round2(suggested.price)}`
      );
    } else {
      notes.push(
        `ราคาที่ตั้งไว้ ฿${round2(sellPrice)} ได้กำไร ${pct(cur.marginPct)} (ชิ้นละ ฿${round2(cur.profit)}) ถึงเป้าที่ตั้งไว้แล้ว`
      );
    }
  }

  if (s.feePct > 0 || s.feePerUnit > 0) {
    const o = suggested.outcome;
    notes.push(
      `ขาย ฿${round2(o.price)} โดนหักค่าธรรมเนียม ฿${round2(o.fee)} เหลือเข้ากระเป๋า ฿${round2(o.net)} หักทุน ฿${round2(cost)} แล้วได้กำไร ฿${round2(o.profit)}`
    );
  }

  notes.push(
    `ราคาแนะนำ ฿${round2(suggested.price)} = ${suggested.outcome.multiple.toFixed(1)} เท่าของต้นทุน (บวกจากทุน ${pct(suggested.outcome.markupPct)})`
  );

  return notes;
}
