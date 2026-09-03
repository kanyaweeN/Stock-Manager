/**
 * แปลงแผนซื้อของ ↔ ค่าที่กรอกในฟอร์ม — คำนวณล้วนๆ ไม่มี state
 *
 * แยกออกจาก `components/plan/PlanModal.tsx` เพื่อให้เทสต์ได้ เหมือน `lib/forms/recipeDraft.ts`
 * **เพิ่มฟิลด์ใหม่ = แก้ `PlanDraft` + `toPlanDraft` + `fromPlanDraft` เท่านั้น**
 */
import { todayISO } from "@/lib/core/date";
import { priorityOf } from "@/lib/domain/plan";
import type { PlanLine, PlanPriority, PurchasePlan } from "@/lib/types";

/** เก็บตัวเลขเป็นสตริงระหว่างกรอก จะได้ลบให้ว่างได้โดยไม่โดนบังคับเป็น 0 (เหมือน RecipeModal) */
export interface PlanLineDraft {
  id: string;
  itemId?: string;
  name: string;
  qty: string;
  price: string;
  note: string;
  link: string;
  bought: boolean;
  boughtAt: string;
  paidPrice: string;
  priority: PlanPriority;
}

export interface PlanDraft {
  id: string;
  name: string;
  note: string;
  dueDate: string;
  budget: string;
  lines: PlanLineDraft[];
  createdAt?: string;
}

const n = (v: string) => {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
};

export const toPlanLineDraft = (l: PlanLine): PlanLineDraft => ({
  id: l.id,
  itemId: l.itemId,
  name: l.name,
  qty: String(l.qty || 1),
  price: l.price ? String(l.price) : "",
  note: l.note,
  link: l.link ?? "",
  bought: l.bought,
  boughtAt: l.boughtAt ?? "",
  paidPrice: l.paidPrice != null ? String(l.paidPrice) : "",
  priority: priorityOf(l),
});

export const fromPlanLineDraft = (l: PlanLineDraft): PlanLine => ({
  id: l.id,
  itemId: l.itemId,
  name: l.name.trim(),
  // ซื้อ 0 ชิ้นไม่มีความหมายในแผน — บรรทัดที่ยังไม่ได้กรอกจำนวนถือว่า 1
  qty: Math.max(1, n(l.qty) || 1),
  price: n(l.price),
  note: l.note.trim(),
  link: l.link.trim() || undefined,
  bought: l.bought,
  boughtAt: l.bought ? l.boughtAt || todayISO() : undefined,
  paidPrice: l.bought && l.paidPrice.trim() ? n(l.paidPrice) : undefined,
  // "ปกติ" คือค่าเริ่มต้นอยู่แล้ว ไม่ต้องเก็บลงไฟล์ให้ทุกบรรทัดพกไปซิงก์เปล่าๆ
  priority: l.priority === "normal" ? undefined : l.priority,
});

export function toPlanDraft(plan: PurchasePlan): PlanDraft {
  return {
    id: plan.id,
    name: plan.name,
    note: plan.note,
    dueDate: plan.dueDate ?? "",
    budget: plan.budget != null ? String(plan.budget) : "",
    lines: plan.lines.map(toPlanLineDraft),
    createdAt: plan.createdAt,
  };
}

export function fromPlanDraft(d: PlanDraft): PurchasePlan {
  return {
    id: d.id,
    name: d.name.trim(),
    note: d.note.trim(),
    dueDate: d.dueDate || undefined,
    // งบ 0 = ไม่ได้ตั้งงบ (planTotals ก็มองแบบเดียวกัน) จะได้ไม่โชว์การ์ด "เกินงบ ฿0"
    budget: n(d.budget) > 0 ? n(d.budget) : undefined,
    lines: d.lines.map(fromPlanLineDraft).filter((l) => l.name),
    createdAt: d.createdAt,
  };
}
