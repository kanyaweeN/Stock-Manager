import { describe, expect, it } from "vitest";
import { planLineFromItem, planTotals, priorityOf, suggestDetail, suggestForPlan } from "@/lib/domain/plan";
import type { PlanLine, PurchasePlan, StockItem } from "@/lib/types";

const item = (over: Partial<StockItem> = {}): StockItem => ({
  id: "i", name: "x", cats: [], qty: 1, min: 0, note: "", ...over,
});

const line = (over: Partial<PlanLine> = {}): PlanLine => ({
  id: "l", name: "x", qty: 1, price: 0, note: "", bought: false, ...over,
});

const plan = (lines: PlanLine[], over: Partial<PurchasePlan> = {}): PurchasePlan => ({
  id: "p", name: "แผน", note: "", lines, ...over,
});

describe("planTotals — แยกยอดตามความสำคัญ", () => {
  const t = planTotals(
    plan([
      line({ id: "a", qty: 1, price: 100, priority: "must" }),
      line({ id: "b", qty: 2, price: 50, priority: "maybe" }),
      line({ id: "c", qty: 1, price: 30 }), // ไม่กรอก = ปกติ
      line({ id: "d", qty: 1, price: 999, bought: true, priority: "must" }),
    ])
  );

  it("ยังต้องจ่ายรวม = ทุกบรรทัดที่ยังไม่ได้ซื้อ", () => {
    expect(t.remaining).toBe(230);
  });

  it("mustRemaining = ขั้นต่ำที่ต้องมีเงิน (ไม่นับของที่ซื้อไปแล้ว)", () => {
    expect(t.mustRemaining).toBe(100);
  });

  it("maybeRemaining = ตัดออกได้ก่อนถ้างบไม่พอ", () => {
    expect(t.maybeRemaining).toBe(100);
  });

  it("จ่ายไปแล้วแยกออกจากที่ยังต้องจ่าย", () => {
    expect(t.spent).toBe(999);
    expect(t.projected).toBe(999 + 230);
  });

  it("ไม่กรอก priority = 'normal'", () => {
    expect(priorityOf(line())).toBe("normal");
    expect(priorityOf(line({ priority: "maybe" }))).toBe("maybe");
  });

  it("ไม่ตั้งงบ = เทียบงบไม่ได้", () => {
    expect(planTotals(plan([line({ qty: 1, price: 10 })])).budgetLeft).toBeNull();
    expect(planTotals(plan([line({ qty: 1, price: 10 })])).overBudget).toBeNull();
  });

  it("budgetLeft = งบ − ที่จ่ายไปแล้วจริง ส่วน overBudget เทียบกับยอดถ้าซื้อครบ", () => {
    const t = planTotals(
      plan([line({ id: "a", qty: 1, price: 40, bought: true }), line({ id: "b", qty: 1, price: 80 })], { budget: 100 })
    );
    expect(t.budgetLeft).toBe(60); // จ่ายจริงไป 40
    expect(t.overBudget).toBe(20); // ถ้าซื้อครบจะเป็น 120 = เกินงบ 20
  });
});

describe("planLineFromItem", () => {
  it("ใช้ reorderQty ที่กรอกไว้ก่อนเสมอ (ของบางอย่างซื้อยกแพ็ค)", () => {
    expect(planLineFromItem(item({ qty: 1, min: 3, reorderQty: 6 })).qty).toBe(6);
  });

  it("ไม่มี reorderQty ก็คิดจากส่วนที่ขาดจุดต่ำสุด", () => {
    expect(planLineFromItem(item({ qty: 1, min: 3 })).qty).toBe(2);
  });

  it("อย่างน้อย 1 เสมอ แม้ของยังไม่ขาด", () => {
    expect(planLineFromItem(item({ qty: 10, min: 3 })).qty).toBe(1);
  });

  it("ดึงราคาล่าสุดมาเป็นงบตั้งต้น", () => {
    expect(planLineFromItem(item({ price: 120 })).price).toBe(120);
    expect(planLineFromItem(item({ price: undefined })).price).toBe(0);
  });
});

describe("suggestForPlan", () => {
  const usageLog = [{ date: "2026-08-01", delta: -5 }, { date: "2026-08-21", delta: -10 }];

  it("เรียงของหมด → ใกล้หมด → กำลังจะหมด → ติดธง → ซื้อบ่อย", () => {
    const items = [
      item({ id: "freq", name: "ซื้อบ่อย", qty: 9, priceHistory: [
        { date: "2026-01-01", price: 1, qty: 1 }, { date: "2026-02-01", price: 1, qty: 1 }, { date: "2026-03-01", price: 1, qty: 1 },
      ] }),
      item({ id: "rebuy", name: "ติดธง", qty: 9, status: "rebuy" }),
      item({ id: "soon", name: "กำลังจะหมด", qty: 3, usageLog }),
      item({ id: "low", name: "ใกล้หมด", qty: 1, min: 5 }),
      item({ id: "out", name: "หมด", qty: 0 }),
    ];
    expect(suggestForPlan(items, plan([])).map((s) => s.reason)).toEqual([
      "out", "low", "running-out", "rebuy", "frequent",
    ]);
  });

  it("ของที่อยู่ในแผนแล้วไม่ถูกเสนอซ้ำ", () => {
    const items = [item({ id: "out", qty: 0 })];
    expect(suggestForPlan(items, plan([line({ itemId: "out" })]))).toHaveLength(0);
  });

  it("'กำลังจะหมด' จับของที่ยังไม่ถึงขั้นต่ำได้ — จุดเดียวที่เตือนก่อนของหมดจริง", () => {
    const s = suggestForPlan([item({ id: "a", qty: 3, min: 0, usageLog })], plan([]));
    expect(s[0].reason).toBe("running-out");
    expect(suggestDetail(s[0])).toBe("อีกประมาณ 6 วัน");
  });

  it("เหตุผลอื่นไม่มีคำอธิบายต่อท้าย", () => {
    const s = suggestForPlan([item({ id: "a", qty: 0 })], plan([]));
    expect(suggestDetail(s[0])).toBe("");
  });
});
