import { endOfMonthISO, monthISO, thaiMonthLabel } from "./date";
import type { PlanLine, PurchasePlan, StockItem } from "./types";
import { uid } from "./uid";

/** ยอดของบรรทัดตาม "งบที่ตั้งไว้" = ราคาต่อชิ้น × จำนวนที่จะซื้อ */
export function lineTotal(line: PlanLine): number {
  return (line.price || 0) * (line.qty || 0);
}

/** ยอดที่จ่ายจริงของบรรทัด — ใช้ราคาที่จ่ายจริงถ้ากรอกไว้ ไม่งั้นถือว่าจ่ายตามงบที่ตั้ง */
export function linePaid(line: PlanLine): number {
  return (line.paidPrice ?? line.price ?? 0) * (line.qty || 0);
}

export interface PlanTotals {
  /** งบที่วางไว้ทั้งแผน (รวมของที่ซื้อไปแล้ว) */
  planned: number;
  /** จ่ายไปแล้วจริง (เฉพาะบรรทัดที่ติ๊กว่าซื้อแล้ว) */
  spent: number;
  /** ยังต้องจ่ายอีก (บรรทัดที่ยังไม่ได้ซื้อ) */
  remaining: number;
  lines: number;
  boughtLines: number;
  qty: number;
  boughtQty: number;
  /** ซื้อไปแล้วกี่ % ของจำนวนรายการ */
  progressPct: number;
  /**
   * ยอดที่คาดว่าจะจ่ายทั้งแผนเมื่อซื้อครบ = จ่ายจริงไปแล้ว + ที่เหลือตามงบ
   * (ต่างจาก `planned` เมื่อของที่ซื้อไปแล้วราคาไม่ตรงกับที่ตั้งงบไว้)
   */
  projected: number;
  /** เงินที่เหลือในงบ (null ถ้าไม่ได้ตั้งงบ) — ติดลบ = จ่ายเกินงบไปแล้ว */
  budgetLeft: number | null;
  /** ส่วนที่คาดว่าจะเกินงบ (null ถ้าไม่ได้ตั้งงบ, 0 = ไม่เกิน) */
  overBudget: number | null;
}

export function planTotals(plan: PurchasePlan): PlanTotals {
  let planned = 0;
  let spent = 0;
  let remaining = 0;
  let qty = 0;
  let boughtQty = 0;
  let boughtLines = 0;

  for (const l of plan.lines) {
    planned += lineTotal(l);
    qty += l.qty || 0;
    if (l.bought) {
      spent += linePaid(l);
      boughtQty += l.qty || 0;
      boughtLines += 1;
    } else {
      remaining += lineTotal(l);
    }
  }

  const projected = spent + remaining;
  const budget = typeof plan.budget === "number" && plan.budget > 0 ? plan.budget : null;

  return {
    planned,
    spent,
    remaining,
    lines: plan.lines.length,
    boughtLines,
    qty,
    boughtQty,
    progressPct: plan.lines.length ? (boughtLines / plan.lines.length) * 100 : 0,
    projected,
    budgetLeft: budget != null ? budget - spent : null,
    overBudget: budget != null ? Math.max(0, projected - budget) : null,
  };
}

/** ซื้อครบทุกรายการแล้ว (แผนที่ยังไม่มีของนับว่ายังไม่เสร็จ) */
export function isPlanDone(plan: PurchasePlan): boolean {
  return plan.lines.length > 0 && plan.lines.every((l) => l.bought);
}

/**
 * เรียงแผน: ที่ยังซื้อไม่ครบมาก่อน → ใกล้ครบกำหนดก่อน → ที่ไม่กำหนดวันไปท้ายสุด
 * ตัวที่เสร็จแล้วเรียงตามวันครบกำหนดล่าสุดขึ้นก่อน (ของที่เพิ่งเสร็จอยู่ใกล้มือ)
 */
export function sortPlans(plans: PurchasePlan[]): PurchasePlan[] {
  return [...plans].sort((a, b) => {
    const doneA = isPlanDone(a);
    const doneB = isPlanDone(b);
    if (doneA !== doneB) return doneA ? 1 : -1;
    if (!a.dueDate !== !b.dueDate) return a.dueDate ? -1 : 1;
    if (a.dueDate && b.dueDate && a.dueDate !== b.dueDate) {
      return doneA ? b.dueDate.localeCompare(a.dueDate) : a.dueDate.localeCompare(b.dueDate);
    }
    return (b.updatedAt ?? "").localeCompare(a.updatedAt ?? "");
  });
}

// ─────────────────────────────────────────────────────────────
// สร้างแผน/บรรทัดใหม่
// ─────────────────────────────────────────────────────────────

export function emptyPlanLine(): PlanLine {
  return { id: uid(), name: "", qty: 1, price: 0, note: "", bought: false };
}

export function emptyPlan(name = "", dueDate?: string): PurchasePlan {
  return {
    id: uid(),
    name,
    note: "",
    dueDate,
    lines: [],
    createdAt: new Date().toISOString(),
  };
}

/**
 * สร้างบรรทัดจากสินค้าในสต็อก — ตั้งราคาจากราคาที่ซื้อครั้งล่าสุด
 * และตั้งจำนวนที่จะซื้อจากส่วนที่ขาดจุดต่ำสุด (เหลือ 1 ขั้นต่ำ 3 ⇒ ซื้อ 2) อย่างน้อย 1
 */
export function planLineFromItem(item: StockItem): PlanLine {
  const short = (item.min || 0) - (item.qty || 0);
  return {
    id: uid(),
    itemId: item.id,
    name: item.name,
    qty: Math.max(1, short),
    price: item.price ?? 0,
    note: "",
    bought: false,
  };
}

/** แผนสำเร็จรูปที่กดสร้างได้ทันที — ชื่อ/วันครบกำหนดคิดจากวันนี้ */
export interface PlanPreset {
  key: string;
  icon: string;
  label: string;
  /** คำอธิบายสั้นๆ ว่าแผนนี้ครบกำหนดเมื่อไร */
  hint: (now?: Date) => string;
  build: (now?: Date) => PurchasePlan;
}

export const PLAN_PRESETS: PlanPreset[] = [
  {
    key: "this-month",
    icon: "🗓️",
    label: "เดือนนี้",
    hint: (now = new Date()) => `ภายใน ${endOfMonthISO(0, now)}`,
    build: (now = new Date()) => emptyPlan(`ของที่ต้องซื้อ ${thaiMonthLabel(monthISO(0, now))}`, endOfMonthISO(0, now)),
  },
  {
    key: "next-month",
    icon: "📅",
    label: "เดือนหน้า",
    hint: (now = new Date()) => `ภายใน ${endOfMonthISO(1, now)}`,
    build: (now = new Date()) => emptyPlan(`ของที่ต้องซื้อ ${thaiMonthLabel(monthISO(1, now))}`, endOfMonthISO(1, now)),
  },
  {
    key: "new-year",
    icon: "🎉",
    label: "ปีใหม่",
    hint: (now = new Date()) => `ภายใน ${now.getFullYear()}-12-31`,
    build: (now = new Date()) =>
      emptyPlan(`ของปีใหม่ ${now.getFullYear() + 1 + 543}`, `${now.getFullYear()}-12-31`),
  },
];

// ─────────────────────────────────────────────────────────────
// ดึงของจากสต็อกมาเข้าแผน
// ─────────────────────────────────────────────────────────────

/** เหตุผลที่ระบบแนะนำให้ซื้อของชิ้นนี้ */
export type SuggestReason = "out" | "low" | "rebuy";

export interface PlanSuggestion {
  item: StockItem;
  reason: SuggestReason;
}

export const SUGGEST_LABELS: Record<SuggestReason, string> = {
  out: "ของหมด",
  low: "ใกล้หมด",
  rebuy: "ทำเครื่องหมายว่าต้องซื้อซ้ำ",
};

/**
 * ของที่น่าใส่ในแผน — หมด/ใกล้หมด/ติดธง "ซื้อซ้ำ" โดยตัดตัวที่อยู่ในแผนแล้วออก
 * เรียงของหมดขึ้นก่อน แล้วค่อยใกล้หมด
 */
export function suggestForPlan(items: StockItem[], plan: PurchasePlan): PlanSuggestion[] {
  const inPlan = new Set(plan.lines.map((l) => l.itemId).filter(Boolean));
  const rank: Record<SuggestReason, number> = { out: 0, low: 1, rebuy: 2 };

  return items
    .filter((i) => !inPlan.has(i.id))
    .map((i): PlanSuggestion | null => {
      if (i.qty <= 0) return { item: i, reason: "out" };
      if (i.min > 0 && i.qty <= i.min) return { item: i, reason: "low" };
      if (i.status === "rebuy") return { item: i, reason: "rebuy" };
      return null;
    })
    .filter((s): s is PlanSuggestion => s !== null)
    .sort((a, b) => rank[a.reason] - rank[b.reason] || a.item.name.localeCompare(b.item.name, "th"));
}

/**
 * เดาว่าบรรทัดนี้ "น่าจะซื้อไปแล้ว" จากของที่นำเข้าสต็อกหลังสร้างแผน — คืนวันที่ซื้อ หรือ null
 *
 * ใช้แค่เตือน ไม่ติ๊กให้เอง เพราะ `purchasedAt` เป็นวันที่ซื้อครั้งล่าสุดของสินค้านั้น
 * ซึ่งอาจเป็นการซื้อรอบอื่นที่ไม่เกี่ยวกับแผนนี้ก็ได้
 */
export function boughtHint(line: PlanLine, item: StockItem | undefined, plan: PurchasePlan): string | null {
  if (line.bought || !item?.purchasedAt) return null;
  const since = (plan.createdAt ?? "").slice(0, 10);
  if (since && item.purchasedAt < since) return null;
  return item.purchasedAt;
}

/** วันที่เริ่มต้นของแผนใหม่ที่ไม่ได้เลือกพรีเซ็ต = สิ้นเดือนนี้ */
export function defaultDueDate(): string {
  return endOfMonthISO(0);
}
