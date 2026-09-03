"use client";

import { useEffect, useMemo, useState } from "react";
import { MaterialThumb } from "@/components/ui/MaterialLabel";
import ModalShell from "@/components/ui/ModalShell";
import StockPicker, { StockPickerEmpty, StockPickerRow, StockPickerShell } from "@/components/ui/StockPicker";
import {
  fromPlanDraft,
  toPlanDraft,
  fromPlanLineDraft,
  toPlanLineDraft,
  type PlanDraft,
  type PlanLineDraft,
} from "@/lib/forms/planDraft";
import { baht } from "@/lib/domain/cost";
import { todayISO } from "@/lib/core/date";
import {
  SUGGEST_LABELS,
  emptyPlanLine,
  lineTotal,
  planLineFromItem,
  PLAN_PRIORITY_LABELS,
  planTotals,
  suggestDetail,
  suggestForPlan,
} from "@/lib/domain/plan";
import type { PlanPriority, PurchasePlan, StockItem } from "@/lib/types";

interface Props {
  open: boolean;
  plan: PurchasePlan | null;
  items: StockItem[];
  onClose: () => void;
  onSave: (plan: PurchasePlan) => void;
}

export default function PlanModal({ open, plan, items, onClose, onSave }: Props) {
  const [draft, setDraft] = useState<PlanDraft | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [suggestOpen, setSuggestOpen] = useState(false);

  useEffect(() => {
    if (open && plan) setDraft(toPlanDraft(plan));
    setPickerOpen(false);
    setSuggestOpen(false);
  }, [open, plan]);

  const preview = useMemo(() => (draft ? fromPlanDraft(draft) : null), [draft]);
  const totals = useMemo(() => (preview ? planTotals(preview) : null), [preview]);
  const itemById = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);

  const suggestions = useMemo(
    () => (preview ? suggestForPlan(items, preview) : []),
    [items, preview]
  );

  if (!open || !draft || !preview || !totals) return null;

  const usedItemIds = new Set(draft.lines.map((l) => l.itemId).filter(Boolean));

  const patchLine = (id: string, patch: Partial<PlanLineDraft>) =>
    setDraft({ ...draft, lines: draft.lines.map((l) => (l.id === id ? { ...l, ...patch } : l)) });

  const addFromItem = (item: StockItem) =>
    setDraft((d) => (d ? { ...d, lines: [...d.lines, toPlanLineDraft(planLineFromItem(item))] } : d));

  const addAllSuggestions = () =>
    setDraft((d) =>
      d ? { ...d, lines: [...d.lines, ...suggestions.map((s) => toPlanLineDraft(planLineFromItem(s.item)))] } : d
    );

  const addBlankLine = () => setDraft({ ...draft, lines: [...draft.lines, toPlanLineDraft(emptyPlanLine())] });
  const removeLine = (id: string) => setDraft({ ...draft, lines: draft.lines.filter((l) => l.id !== id) });

  /** ติ๊กว่าซื้อแล้ว = ลงวันที่ให้เป็นวันนี้อัตโนมัติ (แก้ทีหลังได้) */
  const toggleBought = (l: PlanLineDraft) =>
    patchLine(l.id, l.bought ? { bought: false } : { bought: true, boughtAt: l.boughtAt || todayISO() });

  const handleSave = () => {
    if (!draft.name.trim()) return;
    onSave(fromPlanDraft(draft));
  };

  return (
    // แผนจากพรีเซ็ตมีชื่อมาให้แล้วแต่ยังไม่เคยบันทึก — ดูที่ updatedAt ที่ usePlanActions.save ประทับให้แทน
    <ModalShell open={open} title={plan?.updatedAt ? "แก้ไขแผนซื้อของ" : "แผนซื้อของใหม่"} onClose={onClose} wide>
        <div className="modal-body">
          <div className="field">
            <label>ชื่อแผน</label>
            <input
              type="text"
              autoFocus
              placeholder="เช่น ของที่ต้องซื้อเดือนหน้า / ของปีใหม่"
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            />
          </div>

          <div className="cost-inline-fields">
            <div className="field">
              <label>ซื้อให้เสร็จภายใน</label>
              <input
                type="date"
                value={draft.dueDate}
                onChange={(e) => setDraft({ ...draft, dueDate: e.target.value })}
              />
            </div>
            <div className="field">
              <label>งบที่ตั้งไว้ (บาท)</label>
              <input
                type="number"
                min="0"
                placeholder="ไม่บังคับ"
                value={draft.budget}
                onChange={(e) => setDraft({ ...draft, budget: e.target.value })}
              />
            </div>
          </div>

          <h3 className="cost-section-title">ของที่ต้องซื้อ</h3>
          <p className="sub sub-tight text-xs">
            เลือกของจากสต็อกเพื่อดึงราคาล่าสุดมาให้อัตโนมัติ หรือกรอกเองก็ได้ — ยอดของแต่ละบรรทัด = ราคาต่อชิ้น × จำนวนที่จะซื้อ
            <br />
            ติ๊ก &quot;ซื้อแล้ว&quot; เมื่อซื้อจริง (ไม่ตัด/เพิ่มสต็อกให้ — สต็อกอัปเดตตอนนำเข้าจาก Shopee)
          </p>

          {draft.lines.length === 0 && (
            <div className="empty" style={{ padding: 20, fontSize: 13 }}>
              ยังไม่มีของในแผน — กด &quot;📦 เลือกจากสต็อก&quot; ด้านล่างเพื่อเพิ่ม
            </div>
          )}

          <div className="plan-lines">
            {draft.lines.map((l) => {
              const line = fromPlanLineDraft(l);
              const linked = l.itemId ? itemById.get(l.itemId) : undefined;
              return (
                <div className={`plan-line ${l.bought ? "is-bought" : ""} plan-line--${l.priority}`} key={l.id}>
                  <div className="plan-line__head">
                    <label className="plan-check" title={l.bought ? "ยกเลิกว่าซื้อแล้ว" : "ทำเครื่องหมายว่าซื้อแล้ว"}>
                      <input type="checkbox" checked={l.bought} onChange={() => toggleBought(l)} />
                    </label>
                    <MaterialThumb item={linked} linked={!!l.itemId} />
                    <input
                      className="plan-line__name"
                      type="text"
                      placeholder="ชื่อของที่จะซื้อ"
                      value={l.name}
                      onChange={(e) => patchLine(l.id, { name: e.target.value })}
                    />
                    <span className="plan-line__total">{baht(lineTotal(line))}</span>
                    <button className="icon-btn del" title="ลบรายการนี้" onClick={() => removeLine(l.id)}>🗑️</button>
                  </div>

                  {l.itemId && (
                    <div className="cost-line__link text-xs">
                      {linked ? (
                        <>
                          📦 ผูกกับ <strong>{linked.name}</strong>
                          {linked.size ? ` · ${linked.size}` : ""}
                          {` · เหลือ ${linked.qty}`}
                          {linked.min > 0 ? ` (ขั้นต่ำ ${linked.min})` : ""}
                          {linked.price != null ? ` · ล่าสุด ฿${linked.price.toLocaleString("th-TH")}` : ""}
                          {linked.link && (
                            <a className="link-icon" href={linked.link} target="_blank" rel="noopener noreferrer" title="เปิดลิงก์สินค้า">🔗</a>
                          )}
                        </>
                      ) : (
                        <span className="cost-line__link--missing">⚠️ ไม่พบสินค้านี้ในสต็อกแล้ว — ใช้ราคาที่บันทึกไว้ในแผน</span>
                      )}
                    </div>
                  )}

                  <div className="plan-line__grid">
                    <label className="cost-num">
                      <span>จะซื้อกี่ชิ้น</span>
                      <input
                        type="number"
                        min="1"
                        value={l.qty}
                        onChange={(e) => patchLine(l.id, { qty: e.target.value })}
                      />
                    </label>
                    <label className="cost-num">
                      <span>ราคาต่อชิ้น (บาท)</span>
                      <input
                        type="number"
                        min="0"
                        placeholder="0"
                        value={l.price}
                        onChange={(e) => patchLine(l.id, { price: e.target.value })}
                      />
                    </label>
                    <label className="cost-num">
                      <span>ความสำคัญ</span>
                      <select
                        value={l.priority}
                        onChange={(e) => patchLine(l.id, { priority: e.target.value as PlanPriority })}
                      >
                        {(Object.keys(PLAN_PRIORITY_LABELS) as PlanPriority[]).map((k) => (
                          <option key={k} value={k}>{PLAN_PRIORITY_LABELS[k]}</option>
                        ))}
                      </select>
                    </label>
                    <label className="cost-num plan-num-wide">
                      <span>หมายเหตุ</span>
                      <input
                        type="text"
                        placeholder="เช่น รอโค้ดส่วนลด / ร้านประจำ"
                        value={l.note}
                        onChange={(e) => patchLine(l.id, { note: e.target.value })}
                      />
                    </label>
                    <label className="cost-num plan-num-wide">
                      <span>
                        ลิงก์สินค้า
                        {(l.link.trim() || linked?.link) && (
                          <a
                            className="link-icon"
                            href={l.link.trim() || linked!.link}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="เปิดลิงก์นี้"
                          >
                            🔗
                          </a>
                        )}
                      </span>
                      <input
                        type="url"
                        placeholder={linked?.link || "วางลิงก์จากร้าน เช่น https://shopee.co.th/..."}
                        value={l.link}
                        onChange={(e) => patchLine(l.id, { link: e.target.value })}
                      />
                    </label>
                  </div>

                  {l.bought && (
                    <div className="plan-line__grid plan-line__grid--bought">
                      <label className="cost-num">
                        <span>วันที่ซื้อ</span>
                        <input
                          type="date"
                          value={l.boughtAt}
                          onChange={(e) => patchLine(l.id, { boughtAt: e.target.value })}
                        />
                      </label>
                      <label className="cost-num">
                        <span>ราคาที่จ่ายจริง/ชิ้น</span>
                        <input
                          type="number"
                          min="0"
                          placeholder={l.price || "ตามราคาที่ตั้งไว้"}
                          value={l.paidPrice}
                          onChange={(e) => patchLine(l.id, { paidPrice: e.target.value })}
                        />
                      </label>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {pickerOpen && (
            <StockPicker
              items={items}
              onPick={addFromItem}
              onClose={() => setPickerOpen(false)}
              emptyStockText="ยังไม่มีสินค้าในสต็อก — กรอกชื่อของเองได้เลย"
              namePrefix={(i) => (usedItemIds.has(i.id) ? "✓ " : null)}
              meta={(i) => (
                <>
                  {i.price != null ? `฿${i.price}` : "ยังไม่ใส่ราคา"} · เหลือ {i.qty}
                </>
              )}
              footer={<p className="text-xs plan-picker__hint">กดเพิ่มได้หลายชิ้นติดกัน — หน้าต่างนี้ไม่ปิดเอง</p>}
            />
          )}

          {suggestOpen && (
            <StockPickerShell
              head={
                <>
                  <strong className="text-xs">ของที่น่าซื้อ ({suggestions.length})</strong>
                  <button className="btn-ghost btn-sm" style={{ marginLeft: "auto" }} onClick={addAllSuggestions}>
                    เพิ่มทั้งหมด
                  </button>
                  <button className="btn-ghost btn-sm" onClick={() => setSuggestOpen(false)}>ปิด</button>
                </>
              }
            >
              {suggestions.map((s) => (
                <StockPickerRow
                  key={s.item.id}
                  img={s.item.img}
                  onClick={() => addFromItem(s.item)}
                  name={s.item.name}
                  meta={
                    <>
                      {SUGGEST_LABELS[s.reason]}
                      {suggestDetail(s) ? ` (${suggestDetail(s)})` : ""} · เหลือ {s.item.qty}
                      {s.item.min > 0 ? `/${s.item.min}` : ""}
                    </>
                  }
                />
              ))}
              {suggestions.length === 0 && (
                <StockPickerEmpty>
                  ไม่มีของที่ใกล้หมด ซื้อบ่อย หรือทำเครื่องหมายว่าต้องซื้อซ้ำ (ที่ยังไม่อยู่ในแผนนี้)
                </StockPickerEmpty>
              )}
            </StockPickerShell>
          )}

          <div className="modal-actions-inline">
            <button className="btn-primary btn-sm" onClick={() => { setPickerOpen(true); setSuggestOpen(false); }}>
              📦 เลือกจากสต็อก
            </button>
            <button className="btn-ghost btn-sm" onClick={() => { setSuggestOpen(true); setPickerOpen(false); }}>
              ⚡ ของที่ใกล้หมด ({suggestions.length})
            </button>
            <button className="btn-ghost btn-sm" onClick={addBlankLine}>✏️ กรอกเอง</button>
          </div>

          <div className="field">
            <label>หมายเหตุของแผน</label>
            <textarea
              rows={2}
              placeholder="ไม่บังคับ เช่น รอเซล 12.12 ค่อยกด"
              value={draft.note}
              onChange={(e) => setDraft({ ...draft, note: e.target.value })}
            />
          </div>

          <div className="cost-summary">
            <div className="cost-summary__row">
              <span>ของในแผน</span>
              <strong>{totals.lines} รายการ · {totals.qty} ชิ้น</strong>
            </div>
            <div className="cost-summary__row">
              <span>ซื้อไปแล้ว ({totals.boughtLines}/{totals.lines})</span>
              <strong>{baht(totals.spent)}</strong>
            </div>
            <div className="cost-summary__row cost-summary__row--main">
              <span>ยังต้องจ่ายอีก</span>
              <strong>{baht(totals.remaining)}</strong>
            </div>
            {totals.mustRemaining !== totals.remaining && (
              <div className="cost-summary__row">
                <span>เฉพาะของที่ &quot;ต้องซื้อ&quot;</span>
                <strong>{baht(totals.mustRemaining)}</strong>
              </div>
            )}
            {totals.maybeRemaining > 0 && (
              <div className="cost-summary__row">
                <span>ตัดออกได้ถ้างบไม่พอ (&quot;ถ้ามีงบ&quot;)</span>
                <strong>−{baht(totals.maybeRemaining)}</strong>
              </div>
            )}
            <div className="cost-summary__row">
              <span>รวมทั้งแผน (ถ้าซื้อครบ)</span>
              <strong>{baht(totals.projected)}</strong>
            </div>
            {totals.budgetLeft != null && (
              <div className={`cost-summary__row ${totals.overBudget! > 0 ? "cost-summary__row--loss" : "cost-summary__row--profit"}`}>
                <span>{totals.overBudget! > 0 ? "เกินงบที่ตั้งไว้" : "เหลือในงบ (หลังซื้อครบ)"}</span>
                <strong>{baht(totals.overBudget! > 0 ? totals.overBudget! : preview.budget! - totals.projected)}</strong>
              </div>
            )}
          </div>
        </div>

        <div className="modal-actions">
          <button className="btn-ghost" onClick={onClose}>ยกเลิก</button>
          <button className="btn-primary" onClick={handleSave} disabled={!draft.name.trim()}>บันทึกแผน</button>
        </div>
    </ModalShell>
  );
}
