"use client";

import { todayISO } from "@/lib/core/date";
import { csvRows, downloadFile } from "@/lib/core/download";
import type { StockDB } from "@/lib/db";
import { lineTotal, linePaid, planTotals } from "@/lib/domain/plan";
import type { PurchasePlan } from "@/lib/types";
import { uid } from "@/lib/core/uid";

/** ส่งออกแผนเป็น CSV — 1 แถวต่อของ 1 อย่าง แล้วต่อท้ายด้วยสรุปยอด */
function exportPlanCsv(plan: PurchasePlan) {
  const t = planTotals(plan);
  const header = "รายการ,จำนวน,ราคา/ชิ้น,ยอดรวม,สถานะ,วันที่ซื้อ,จ่ายจริง,หมายเหตุ\n";
  const rows = csvRows(
    plan.lines.map((l) => [
      l.name,
      l.qty,
      l.price,
      lineTotal(l).toFixed(2),
      l.bought ? "ซื้อแล้ว" : "ยังไม่ซื้อ",
      l.boughtAt ?? "",
      l.bought ? linePaid(l).toFixed(2) : "",
      l.note,
    ])
  );
  const summary = csvRows([
    ["", "", "", "", "", "", "งบที่วางไว้", t.planned.toFixed(2)],
    ["", "", "", "", "", "", "จ่ายไปแล้ว", t.spent.toFixed(2)],
    ["", "", "", "", "", "", "ยังต้องจ่าย", t.remaining.toFixed(2)],
    ...(plan.budget ? [["", "", "", "", "", "", "งบที่ตั้งไว้", plan.budget]] : []),
  ]);

  downloadFile(`plan-${plan.name || "purchase"}-${todayISO()}.csv`, header + rows + "\n" + summary);
}

/** CRUD ของแผนซื้อของ (เพิ่ม/แก้ไข/ลบ/ทำซ้ำ/ติ๊กว่าซื้อแล้ว/ส่งออก CSV) */
export function usePlanActions(setDb: (updater: (prev: StockDB) => StockDB) => void) {
  const setPlans = (updater: (prev: PurchasePlan[]) => PurchasePlan[]) => {
    setDb((prev) => ({ ...prev, plans: updater(prev.plans ?? []) }));
  };

  const save = (plan: PurchasePlan) => {
    const stamped = { ...plan, updatedAt: new Date().toISOString() };
    setPlans((prev) =>
      prev.some((p) => p.id === plan.id) ? prev.map((p) => (p.id === plan.id ? stamped : p)) : [...prev, stamped]
    );
  };

  const remove = (plan: PurchasePlan) => {
    if (confirm(`ลบแผน "${plan.name}"?`)) {
      setPlans((prev) => prev.filter((p) => p.id !== plan.id));
    }
  };

  const duplicate = (plan: PurchasePlan) => {
    setPlans((prev) => [
      ...prev,
      {
        ...plan,
        id: uid(),
        name: `${plan.name} (สำเนา)`,
        // สำเนาไว้ซื้อรอบใหม่ — ล้างสถานะ "ซื้อแล้ว" ทิ้งทั้งหมด
        lines: plan.lines.map((l) => ({ ...l, id: uid(), bought: false, boughtAt: undefined, paidPrice: undefined })),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ]);
  };

  /** ติ๊ก/ยกเลิก "ซื้อแล้ว" ของรายการเดียว — ติ๊กแล้วลงวันที่ให้เป็นวันนี้ (ยกเลิกแล้วล้างทิ้ง) */
  const toggleBought = (planId: string, lineId: string, boughtAt = todayISO()) => {
    setPlans((prev) =>
      prev.map((p) =>
        p.id !== planId
          ? p
          : {
              ...p,
              updatedAt: new Date().toISOString(),
              lines: p.lines.map((l) =>
                l.id !== lineId
                  ? l
                  : l.bought
                    ? { ...l, bought: false, boughtAt: undefined }
                    : { ...l, bought: true, boughtAt }
              ),
            }
      )
    );
  };

  return { save, remove, duplicate, toggleBought, exportCsv: exportPlanCsv };
}
