import { describe, expect, it } from "vitest";
import { fromProductForm, toProductForm } from "@/lib/forms/productForm";
import { fromRecipeDraft, fromRecipeLineDraft, toRecipeDraft } from "@/lib/forms/recipeDraft";
import { fromPlanDraft, toPlanDraft, toPlanLineDraft } from "@/lib/forms/planDraft";
import { todayISO } from "@/lib/core/date";
import type { PurchasePlan, Recipe, StockItem } from "@/lib/types";

/**
 * ตัวแปลง "ของจริง ↔ ค่าที่กรอกในฟอร์ม" ทั้ง 3 ตัว — พลาดตรงนี้แล้วค่าหาย/เพี้ยนแบบเงียบๆ
 * โดยเฉพาะเส้นแบ่งระหว่าง **0 (ตั้งใจกรอก)** กับ **ว่าง (ยังไม่ได้ตั้ง)** ที่ความหมายต่างกัน
 */

const item = (over: Partial<StockItem> = {}): StockItem => ({
  id: "i", name: "สบู่", cats: [], qty: 2, min: 1, note: "", ...over,
});

describe("productForm — ไป-กลับต้องไม่ทำข้อมูลหาย", () => {
  it("แปลงไปแล้วกลับได้ค่าเดิม", () => {
    const original = item({
      price: 120, buyQty: 2, size: "500ml", unit: "ml", packAmount: 500,
      location: "ลิ้นชักบน", shop: "ร้านเอ", openPct: 50, reorderQty: 6,
      expiryAt: "2027-01-01", openedAt: "2026-08-01", paoMonths: 12,
      ingredients: "Water, Glycerin", purchasedAt: "2026-08-01",
      priceHistory: [{ date: "2026-08-01", price: 120, qty: 2 }],
    });
    const back = fromProductForm(toProductForm(original), original);
    expect(back).toMatchObject({
      name: "สบู่", price: 120, buyQty: 2, unit: "ml", packAmount: 500,
      location: "ลิ้นชักบน", shop: "ร้านเอ", openPct: 50, reorderQty: 6,
      expiryAt: "2027-01-01", paoMonths: 12,
    });
    expect(back.priceHistory).toEqual(original.priceHistory);
  });

  it("ราคา ฿0 (ของแถม) ต้องเก็บไว้ ไม่ใช่มองว่าไม่ได้กรอก", () => {
    const back = fromProductForm({ ...toProductForm(null), name: "x", price: "0" }, null);
    expect(back.price).toBe(0);
  });

  it("ช่องที่ 0 ไม่มีความหมาย: 0 กับว่าง = ยังไม่ได้ตั้ง", () => {
    const form = { ...toProductForm(null), name: "x", packAmount: "0", paoMonths: "0", reorderQty: "0" };
    const back = fromProductForm(form, null);
    expect(back.packAmount).toBeUndefined();
    expect(back.paoMonths).toBeUndefined();
    expect(back.reorderQty).toBeUndefined();
  });

  it("openPct: ว่าง = ไม่ระบุ (เต็มขวด) แต่ 0 = ขวดที่เปิดใช้หมดแล้ว", () => {
    expect(fromProductForm({ ...toProductForm(null), name: "x", openPct: "" }, null).openPct).toBeUndefined();
    expect(fromProductForm({ ...toProductForm(null), name: "x", openPct: "0" }, null).openPct).toBe(0);
  });

  it("ชื่อร้านถูกบีบตอนบันทึก", () => {
    expect(fromProductForm({ ...toProductForm(null), name: "x", shop: "  ร้าน   เอ  " }, null).shop).toBe("ร้าน เอ");
  });

  it("ประวัติการใช้ไม่ได้อยู่ในฟอร์ม ต้องพกของเดิมติดไปไม่ให้ถูกล้าง", () => {
    const original = item({ usageLog: [{ date: "2026-08-01", delta: -2 }] });
    expect(fromProductForm(toProductForm(original), original).usageLog).toEqual(original.usageLog);
  });

  it("บันทึกเองแล้วปลดธง 'ราคายังไม่ยืนยัน'", () => {
    const original = item({ priceUnverified: true });
    expect(fromProductForm(toProductForm(original), original).priceUnverified).toBeUndefined();
  });

  it("จำนวน/ขั้นต่ำเป็นสตริง — ลบให้ว่างได้ระหว่างพิมพ์ แล้วตีความเป็น 0 ตอนบันทึก", () => {
    // เดิมเป็น number แล้วเด้งกลับเป็น 0 ทันทีที่ช่องว่าง ต้องไปลบ 0 ทิ้งอีกทีก่อนพิมพ์เลขใหม่
    expect(toProductForm(item({ qty: 2, min: 1 }))).toMatchObject({ qty: "2", min: "1" });
    const back = fromProductForm({ ...toProductForm(null), name: "x", qty: "", min: "" }, null);
    expect(back.qty).toBe(0);
    expect(back.min).toBe(0);
  });

  it("จำนวนติดลบถูกหนีบเป็น 0", () => {
    const back = fromProductForm({ ...toProductForm(null), name: "x", qty: "-5" }, null);
    expect(back.qty).toBe(0);
  });

  it("ฟอร์มเปล่าตั้งวันที่ซื้อเป็นวันนี้", () => {
    expect(toProductForm(null).purchasedAt).toBe(todayISO());
  });
});

const recipe = (over: Partial<Recipe> = {}): Recipe => ({
  id: "r", name: "สูตร", note: "", lines: [], yieldQty: 10, yieldUnit: "ก้อน", laborCost: 0, otherCost: 0, ...over,
});

describe("recipeDraft", () => {
  it("แปลงไป-กลับได้ค่าเดิม", () => {
    const original = recipe({
      lines: [{ id: "l", name: "น้ำมัน", buyPrice: 100, packAmount: 1000, unit: "g", usedAmount: 500 }],
      laborCost: 50, otherCost: 20, sellPrice: 39,
    });
    expect(fromRecipeDraft(toRecipeDraft(original))).toEqual(original);
  });

  it("packAmount ว่าง = 0 (ยังไม่รู้) ห้าม fallback เป็น 1", () => {
    // ถ้าเป็น 1 เงียบๆ ต้นทุนจะพุ่งเป็น "ราคาเต็ม × ปริมาณที่ใช้"
    const line = fromRecipeLineDraft({ id: "l", name: "x", buyPrice: "100", packAmount: "", unit: "g", usedAmount: "50" });
    expect(line.packAmount).toBe(0);
  });

  it("packAmount = 0 ในสูตรถูกแปลงเป็นช่องว่างให้กรอกเอง", () => {
    expect(toRecipeDraft(recipe({ lines: [{ id: "l", name: "x", buyPrice: 0, packAmount: 0, unit: "g", usedAmount: 0 }] })).lines[0].packAmount).toBe("");
  });

  it("จำนวนที่ทำได้ต่อรอบอย่างน้อย 1 เสมอ (หารด้วยศูนย์ไม่ได้)", () => {
    expect(fromRecipeDraft({ ...toRecipeDraft(recipe()), yieldQty: "0" }).yieldQty).toBe(1);
    expect(fromRecipeDraft({ ...toRecipeDraft(recipe()), yieldQty: "" }).yieldQty).toBe(1);
  });

  it("ไม่กรอกหน่วย = ชิ้น", () => {
    expect(fromRecipeDraft({ ...toRecipeDraft(recipe()), yieldUnit: "  " }).yieldUnit).toBe("ชิ้น");
  });

  it("บรรทัดเปล่าถูกทิ้ง แต่บรรทัดที่ใส่ปริมาณไว้แล้วยังอยู่", () => {
    const d = toRecipeDraft(recipe());
    const out = fromRecipeDraft({
      ...d,
      lines: [
        { id: "a", name: "", buyPrice: "", packAmount: "", unit: "g", usedAmount: "" },
        { id: "b", name: "", buyPrice: "", packAmount: "", unit: "g", usedAmount: "5" },
        { id: "c", name: "น้ำมัน", buyPrice: "", packAmount: "", unit: "g", usedAmount: "" },
      ],
    });
    expect(out.lines.map((l) => l.id)).toEqual(["b", "c"]);
  });

  it("ราคาขายว่าง = ไม่ตั้งราคา (ไม่ใช่ ฿0)", () => {
    expect(fromRecipeDraft({ ...toRecipeDraft(recipe()), sellPrice: "" }).sellPrice).toBeUndefined();
    expect(fromRecipeDraft({ ...toRecipeDraft(recipe()), sellPrice: "0" }).sellPrice).toBe(0);
  });

  it("ตัวเลขที่พิมพ์มั่วไม่ทำให้ค่ากลายเป็น NaN", () => {
    expect(fromRecipeDraft({ ...toRecipeDraft(recipe()), laborCost: "abc" }).laborCost).toBe(0);
  });
});

const plan = (over: Partial<PurchasePlan> = {}): PurchasePlan => ({
  id: "p", name: "แผน", note: "", lines: [], ...over,
});

describe("planDraft", () => {
  it("แปลงไป-กลับได้ค่าเดิม", () => {
    const original = plan({
      dueDate: "2026-09-30", budget: 1000,
      lines: [{ id: "l", name: "สบู่", qty: 2, price: 100, note: "", link: "https://shopee.co.th/x", bought: false, priority: "must" }],
    });
    expect(fromPlanDraft(toPlanDraft(original))).toEqual(original);
  });

  it("งบ 0 = ไม่ได้ตั้งงบ (จะได้ไม่โชว์การ์ด 'เกินงบ ฿0')", () => {
    expect(fromPlanDraft({ ...toPlanDraft(plan()), budget: "0" }).budget).toBeUndefined();
    expect(fromPlanDraft({ ...toPlanDraft(plan()), budget: "500" }).budget).toBe(500);
  });

  it("จำนวนอย่างน้อย 1 เสมอ", () => {
    const d = toPlanDraft(plan({ lines: [{ id: "l", name: "x", qty: 1, price: 0, note: "", bought: false }] }));
    expect(fromPlanDraft({ ...d, lines: [{ ...d.lines[0], qty: "0" }] }).lines[0].qty).toBe(1);
  });

  it("'ปกติ' ไม่ถูกเก็บลงไฟล์ (ทุกบรรทัดจะได้ไม่พกไปซิงก์เปล่าๆ)", () => {
    const d = toPlanDraft(plan({ lines: [{ id: "l", name: "x", qty: 1, price: 0, note: "", bought: false }] }));
    expect(d.lines[0].priority).toBe("normal");
    expect(fromPlanDraft(d).lines[0].priority).toBeUndefined();
  });

  it("ติ๊กว่าซื้อแล้วโดยไม่ระบุวัน = ลงวันนี้ให้", () => {
    const d = toPlanDraft(plan({ lines: [{ id: "l", name: "x", qty: 1, price: 0, note: "", bought: false }] }));
    const out = fromPlanDraft({ ...d, lines: [{ ...d.lines[0], bought: true, boughtAt: "" }] });
    expect(out.lines[0].boughtAt).toBe(todayISO());
  });

  it("ยังไม่ได้ซื้อ = ไม่เก็บวันที่ซื้อ/ราคาที่จ่ายจริง", () => {
    const d = toPlanDraft(plan({ lines: [{ id: "l", name: "x", qty: 1, price: 0, note: "", bought: false }] }));
    const out = fromPlanDraft({ ...d, lines: [{ ...d.lines[0], bought: false, boughtAt: "2026-08-01", paidPrice: "99" }] });
    expect(out.lines[0].boughtAt).toBeUndefined();
    expect(out.lines[0].paidPrice).toBeUndefined();
  });

  it("ลิงก์ว่าง = ไม่เก็บลงไฟล์", () => {
    const d = toPlanDraft(plan({ lines: [{ id: "l", name: "x", qty: 1, price: 0, note: "", bought: false }] }));
    expect(d.lines[0].link).toBe("");
    expect(fromPlanDraft(d).lines[0].link).toBeUndefined();
    expect(fromPlanDraft({ ...d, lines: [{ ...d.lines[0], link: "  https://shopee.co.th/x  " }] }).lines[0].link)
      .toBe("https://shopee.co.th/x");
  });

  it("บรรทัดที่ไม่มีชื่อถูกทิ้ง", () => {
    const d = toPlanDraft(plan());
    const blank = toPlanLineDraft({ id: "a", name: "", qty: 1, price: 0, note: "", bought: false });
    expect(fromPlanDraft({ ...d, lines: [blank] }).lines).toHaveLength(0);
  });
});
