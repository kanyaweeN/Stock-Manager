"use client";

import { useMemo, useState } from "react";
import PlanModal from "@/components/PlanModal";
import { MaterialThumb } from "@/components/MaterialLabel";
import { baht } from "@/lib/cost";
import { daysUntil, formatThaiShortDate } from "@/lib/date";
import { useStockDB } from "@/lib/StockDBProvider";
import { usePlanActions } from "@/lib/usePlanActions";
import {
  PLAN_PRESETS,
  boughtHint,
  defaultDueDate,
  emptyPlan,
  isPlanDone,
  lineTotal,
  linePaid,
  planTotals,
  sortPlans,
} from "@/lib/plan";
import type { PurchasePlan } from "@/lib/types";

/** ป้ายบอกว่าเหลือเวลาอีกเท่าไร — คืน null ถ้าแผนไม่ได้กำหนดวัน */
function dueBadge(plan: PurchasePlan, done: boolean) {
  if (!plan.dueDate) return null;
  const left = daysUntil(plan.dueDate);
  const when = formatThaiShortDate(plan.dueDate);
  if (done) return { text: `ครบแล้ว · ${when}`, tone: "done" as const };
  if (left == null) return null;
  if (left < 0) return { text: `เลยกำหนด ${-left} วัน · ${when}`, tone: "late" as const };
  if (left === 0) return { text: `ครบกำหนดวันนี้ · ${when}`, tone: "late" as const };
  if (left <= 7) return { text: `เหลือ ${left} วัน · ${when}`, tone: "soon" as const };
  return { text: `เหลือ ${left} วัน · ${when}`, tone: "normal" as const };
}

export default function PlanPage() {
  const { db, setDb } = useStockDB();
  const actions = usePlanActions(setDb);

  const [editing, setEditing] = useState<PurchasePlan | null>(null);

  const plans = useMemo(() => sortPlans(db.plans ?? []), [db.plans]);
  const itemById = useMemo(() => new Map(db.items.map((i) => [i.id, i])), [db.items]);

  /** ยอดรวมทุกแผน — "ยังต้องจ่าย" นับเฉพาะแผนที่ยังซื้อไม่ครบ */
  const overall = useMemo(() => {
    let remaining = 0;
    let spent = 0;
    let openPlans = 0;
    for (const p of plans) {
      const t = planTotals(p);
      spent += t.spent;
      remaining += t.remaining;
      if (!isPlanDone(p)) openPlans += 1;
    }
    return { remaining, spent, openPlans };
  }, [plans]);

  const handleSave = (plan: PurchasePlan) => {
    actions.save(plan);
    setEditing(null);
  };

  return (
    <div className="page">
      <h1>🛒 วางแผนซื้อของ</h1>
      <p className="sub sub-tight text-xs">
        จดไว้ว่าเดือนหน้า/ปีใหม่ต้องซื้ออะไรบ้าง ระบบรวมราคาให้ว่าต้องใช้เงินเท่าไร ซื้อไปแล้วเท่าไร และเหลืออีกเท่าไร
      </p>

      <div className="stats">
        <div className="stat stat--blue"><div className="n">{overall.openPlans}</div><div className="l">แผนที่ยังซื้อไม่ครบ</div></div>
        <div className="stat stat--orange"><div className="n">{baht(overall.remaining)}</div><div className="l">ยังต้องจ่ายรวม</div></div>
        <div className="stat stat--green"><div className="n">{baht(overall.spent)}</div><div className="l">ซื้อไปแล้วรวม</div></div>
      </div>

      <div className="toolbar">
        {PLAN_PRESETS.map((p) => (
          <button key={p.key} className="btn-ghost" title={p.hint()} onClick={() => setEditing(p.build())}>
            {p.icon} แผน{p.label}
          </button>
        ))}
        <button className="btn-primary" onClick={() => setEditing(emptyPlan("", defaultDueDate()))}>
          + แผนใหม่
        </button>
      </div>

      {plans.length === 0 ? (
        <div className="empty">
          ยังไม่มีแผน — กด &quot;📅 แผนเดือนหน้า&quot; หรือ &quot;🎉 แผนปีใหม่&quot; เพื่อเริ่มจดของที่ต้องซื้อ
        </div>
      ) : (
        <div className="recipe-list">
          {plans.map((plan) => {
            const t = planTotals(plan);
            const done = isPlanDone(plan);
            const badge = dueBadge(plan, done);
            return (
              <div className={`recipe-card plan-card ${done ? "plan-card--done" : ""}`} key={plan.id}>
                <div className="recipe-card__head">
                  <div>
                    <h3 className="recipe-card__title">
                      {done && "✅ "}
                      {plan.name || "(ไม่มีชื่อ)"}
                    </h3>
                    <p className="text-xs recipe-card__meta">
                      {t.lines} รายการ · {t.qty} ชิ้น · ซื้อแล้ว {t.boughtLines}/{t.lines}
                      {badge && <> · <span className={`plan-due plan-due--${badge.tone}`}>{badge.text}</span></>}
                    </p>
                  </div>
                  <div className="recipe-card__actions">
                    <button className="btn-ghost btn-sm" onClick={() => setEditing(plan)}>แก้ไข</button>
                    <button className="btn-ghost btn-sm" title="ทำสำเนาไว้ซื้อรอบใหม่ (ล้างสถานะซื้อแล้ว)" onClick={() => actions.duplicate(plan)}>ทำซ้ำ</button>
                    <button className="btn-ghost btn-sm" onClick={() => actions.exportCsv(plan)}>CSV</button>
                    <button className="btn-danger btn-sm" onClick={() => actions.remove(plan)}>ลบ</button>
                  </div>
                </div>

                <div className="recipe-card__figures">
                  <div className="recipe-figure">
                    <div className="recipe-figure__n">{baht(t.remaining)}</div>
                    <div className="recipe-figure__l">ยังต้องจ่ายอีก</div>
                  </div>
                  <div className="recipe-figure recipe-figure--profit">
                    <div className="recipe-figure__n">{baht(t.spent)}</div>
                    <div className="recipe-figure__l">จ่ายไปแล้ว</div>
                  </div>
                  <div className="recipe-figure">
                    <div className="recipe-figure__n">{baht(t.projected)}</div>
                    <div className="recipe-figure__l">รวมทั้งแผน</div>
                  </div>
                  {plan.budget != null && (
                    <div className={`recipe-figure ${t.overBudget! > 0 ? "recipe-figure--loss" : ""}`}>
                      <div className="recipe-figure__n">
                        {t.overBudget! > 0 ? `+${baht(t.overBudget!)}` : baht(plan.budget - t.projected)}
                      </div>
                      <div className="recipe-figure__l">
                        {t.overBudget! > 0 ? `เกินงบ ${baht(plan.budget)}` : `เหลือจากงบ ${baht(plan.budget)}`}
                      </div>
                    </div>
                  )}
                </div>

                {t.lines > 0 && (
                  <div className="plan-progress" title={`ซื้อแล้ว ${t.boughtLines} จาก ${t.lines} รายการ`}>
                    <span className="plan-progress__fill" style={{ width: `${t.progressPct}%` }} />
                  </div>
                )}

                {t.lines === 0 ? (
                  <div className="empty" style={{ padding: 16, fontSize: 12 }}>
                    ยังไม่มีของในแผนนี้ — กด &quot;แก้ไข&quot; เพื่อเพิ่ม
                  </div>
                ) : (
                  <ul className="plan-items">
                    {plan.lines.map((l) => {
                      const item = l.itemId ? itemById.get(l.itemId) : undefined;
                      const hint = boughtHint(l, item, plan);
                      return (
                        <li className={`plan-item ${l.bought ? "is-bought" : ""}`} key={l.id}>
                          <label className="plan-check" title={l.bought ? "ยกเลิกว่าซื้อแล้ว" : "ทำเครื่องหมายว่าซื้อแล้ว"}>
                            <input
                              type="checkbox"
                              checked={l.bought}
                              onChange={() => actions.toggleBought(plan.id, l.id)}
                            />
                          </label>
                          <MaterialThumb item={item} linked={!!l.itemId} />
                          <span className="plan-item__text">
                            <span className="plan-item__name">{l.name || "(ไม่มีชื่อ)"}</span>
                            <small className="plan-item__meta">
                              {l.qty} × {baht(l.price)}
                              {l.bought && l.boughtAt ? ` · ซื้อเมื่อ ${formatThaiShortDate(l.boughtAt)}` : ""}
                              {l.bought && l.paidPrice != null && l.paidPrice !== l.price
                                ? ` · จ่ายจริง ฿${l.paidPrice.toLocaleString("th-TH")}/ชิ้น`
                                : ""}
                              {l.note ? ` · ${l.note}` : ""}
                              {hint && (
                                <span className="plan-item__hint"> · 🛍️ นำเข้าสต็อกแล้วเมื่อ {formatThaiShortDate(hint)} — ซื้อแล้วหรือยัง?</span>
                              )}
                            </small>
                          </span>
                          <span className="plan-item__total">{baht(l.bought ? linePaid(l) : lineTotal(l))}</span>
                        </li>
                      );
                    })}
                  </ul>
                )}

                {plan.note && <p className="text-xs recipe-card__note">{plan.note}</p>}
              </div>
            );
          })}
        </div>
      )}

      <PlanModal
        open={editing !== null}
        plan={editing}
        items={db.items}
        onClose={() => setEditing(null)}
        onSave={handleSave}
      />
    </div>
  );
}
