"use client";

import { useEffect, useMemo, useState } from "react";
import ModalShell from "@/components/ModalShell";
import StockPicker from "@/components/StockPicker";
import {
  fromRecipeDraft,
  toRecipeDraft,
  fromRecipeLineDraft,
  toRecipeLineDraft,
  type RecipeDraft,
  type RecipeLineDraft,
} from "@/lib/recipeDraft";
import { amountText, baht, emptyLine, lineCost, lineFromItem, lineIssue, productionSummary, recipeTotals, unitCost } from "@/lib/cost";
import { formatThaiShortDate, todayISO } from "@/lib/date";
import { MaterialThumb } from "@/components/MaterialLabel";
import PriceAdvisor from "@/components/PriceAdvisor";
import { usePricingSettings } from "@/lib/usePricingSettings";
import type { ProductionRun, Recipe, StockItem } from "@/lib/types";

interface Props {
  open: boolean;
  recipe: Recipe | null;
  items: StockItem[];
  onClose: () => void;
  onSave: (recipe: Recipe) => void;
  /**
   * ประวัติการผลิต**สดจาก db** — ต้องรับแยกจาก `recipe`
   *
   * `recipe` เป็นสแนปช็อตที่ผู้เรียกจับไว้ตอนเปิดหน้าต่าง (และ `useEffect` ใช้มันรีเซ็ต
   * ฟอร์ม) ถ้าอัปเดตตัวมันให้สดตาม db ทุกครั้ง ฟอร์มจะถูกรีเซ็ตทิ้งกลางคันทุกครั้งที่จดรอบ
   * — จึงแยกเฉพาะส่วนที่ต้องสดออกมาเป็น prop ของตัวเอง
   *
   * `undefined` = สูตรนี้ยังไม่ถูกบันทึกลง db (สูตรใหม่ที่ยังไม่กดบันทึก) จึงยังจดรอบไม่ได้
   */
  runs?: ProductionRun[];
  /**
   * จดว่าทำสูตรนี้ไปแล้ว — แยกจาก `onSave` เพราะเขียนลง `db.recipes` ทันทีโดยไม่ต้องรอ
   * กดบันทึกสูตร (ไม่งั้นกดจดแล้วปิดหน้าต่างไปเลย = หาย) และ**ไม่ตัดสต็อกวัตถุดิบ**
   */
  onLogRun?: (recipeId: string, run: { date: string; batches: number; note: string }) => void;
  onRemoveRun?: (recipeId: string, runId: string) => void;
}

export default function RecipeModal({ open, recipe, items, runs, onClose, onSave, onLogRun, onRemoveRun }: Props) {
  const [draft, setDraft] = useState<RecipeDraft | null>(null);
  /** กำลังเลือกสินค้าจากสต็อกให้บรรทัดไหน — "new" = เพิ่มบรรทัดใหม่, null = ไม่ได้เปิดตัวเลือก */
  const [pickerFor, setPickerFor] = useState<"new" | string | null>(null);

  useEffect(() => {
    if (open && recipe) setDraft(toRecipeDraft(recipe));
    setPickerFor(null);
  }, [open, recipe]);

  const [pricing] = usePricingSettings();
  const preview = useMemo(() => (draft ? fromRecipeDraft(draft) : null), [draft]);
  // ส่ง pricing เข้าไปด้วย กำไรที่โชว์จะได้หักค่าธรรมเนียมตรงกับตัวเลขในบล็อก "ควรขายเท่าไร" ข้างล่าง
  const totals = useMemo(() => (preview ? recipeTotals(preview, pricing) : null), [preview, pricing]);

  const itemById = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);

  /** จดรอบได้ก็ต่อเมื่อสูตรถูกบันทึกลง db แล้ว (ผู้เรียกส่ง `runs` มาให้) */
  const canLogRuns = !!recipe && !!onLogRun && !!runs;
  const production = useMemo(
    () => (preview && runs ? productionSummary({ ...preview, runs }, pricing) : null),
    [preview, runs, pricing]
  );

  const [runBatches, setRunBatches] = useState("1");

  const handleLogRun = () => {
    if (!recipe || !onLogRun) return;
    const batches = Math.max(1, Math.round(Number(runBatches) || 1));
    onLogRun(recipe.id, { date: todayISO(), batches, note: "" });
    setRunBatches("1");
  };

  if (!open || !draft || !preview || !totals) return null;

  const patchLine = (id: string, patch: Partial<RecipeLineDraft>) =>
    setDraft({ ...draft, lines: draft.lines.map((l) => (l.id === id ? { ...l, ...patch } : l)) });

  const openPicker = (target: "new" | string) => setPickerFor(target);

  /** เลือกสินค้าจากสต็อก — ดึงชื่อ/ราคา/ขนาดบรรจุมาเติมให้ แต่คงปริมาณที่ใช้ที่กรอกไว้แล้ว */
  const pickItem = (item: StockItem) => {
    if (pickerFor === "new") {
      setDraft({ ...draft, lines: [...draft.lines, toRecipeLineDraft(lineFromItem(item))] });
    } else if (pickerFor) {
      const lineId = pickerFor;
      setDraft({
        ...draft,
        lines: draft.lines.map((l) =>
          l.id === lineId
            ? { ...toRecipeLineDraft({ ...lineFromItem(item), id: l.id }), usedAmount: l.usedAmount }
            : l
        ),
      });
    }
    setPickerFor(null);
  };

  const unlinkItem = (id: string) => patchLine(id, { itemId: undefined });

  const addLine = () => setDraft({ ...draft, lines: [...draft.lines, toRecipeLineDraft(emptyLine())] });
  const removeLine = (id: string) => setDraft({ ...draft, lines: draft.lines.filter((l) => l.id !== id) });

  const handleSave = () => {
    if (!draft.name.trim()) return;
    onSave(fromRecipeDraft(draft));
  };

  const materialCost = totals.materialCost;

  const renderPicker = () => (
    <StockPicker
      items={items}
      onPick={pickItem}
      onClose={() => setPickerFor(null)}
      emptyStockText="ยังไม่มีสินค้าในสต็อก — เพิ่มสินค้าก่อน หรือกรอกวัตถุดิบเอง"
      meta={(i) => (
        <>
          {i.price != null ? `฿${i.price}` : "ยังไม่ใส่ราคา"}
          {i.size ? ` · ${i.size}` : ""} · เหลือ {i.qty}
        </>
      )}
    />
  );

  return (
    <ModalShell open={open} title={recipe?.name ? "แก้ไขสูตรต้นทุน" : "สูตรต้นทุนใหม่"} onClose={onClose} wide>
        <div className="modal-body">
          <div className="field">
            <label>ชื่อสูตร / ของที่ทำ</label>
            <input
              type="text"
              autoFocus
              placeholder="เช่น พวงกุญแจพิเพิ่ม v3"
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            />
          </div>

          <div className="cost-inline-fields">
            <div className="field">
              <label>ทำ 1 รอบได้กี่ชิ้น</label>
              <input
                type="number"
                min="1"
                value={draft.yieldQty}
                onChange={(e) => setDraft({ ...draft, yieldQty: e.target.value })}
              />
            </div>
            <div className="field">
              <label>หน่วยผลผลิต</label>
              <input
                type="text"
                placeholder="ชิ้น / ก้อน / ขวด"
                value={draft.yieldUnit}
                onChange={(e) => setDraft({ ...draft, yieldUnit: e.target.value })}
              />
            </div>
          </div>

          <h3 className="cost-section-title">วัตถุดิบที่ใช้</h3>
          <p className="sub sub-tight text-xs">
            เลือกของจากสต็อกเพื่อดึงราคา/ขนาดมาให้อัตโนมัติ หรือกรอกเองก็ได้ — ต้นทุน = ราคาต่อ 1 แพ็ค ÷ ปริมาณที่ได้ต่อ 1 แพ็ค × ปริมาณที่ใช้
            <br />
            ซื้อทีละหลายแพ็คไม่ทำให้ต้นทุนต่อหน่วยเปลี่ยน (฿30 ÷ 1000 g = ฿90 ÷ 3000 g) ให้กรอก<strong>ราคาต่อแพ็ค</strong>คู่กับ<strong>ขนาด 1 แพ็ค</strong>เสมอ
          </p>

          {draft.lines.length === 0 && (
            <div className="empty" style={{ padding: 20, fontSize: 13 }}>
              ยังไม่มีวัตถุดิบ — กด &quot;📦 เลือกจากสต็อก&quot; ด้านล่างเพื่อเพิ่ม
            </div>
          )}

          <div className="cost-lines">
            {draft.lines.map((l) => {
              const line = fromRecipeLineDraft(l);
              const cost = lineCost(line);
              const issue = lineIssue(line);
              const share = materialCost > 0 ? (cost / materialCost) * 100 : 0;
              const linked = l.itemId ? itemById.get(l.itemId) : undefined;
              return (
                <div className="cost-line" key={l.id}>
                  <div className="cost-line__head">
                    <MaterialThumb item={linked} linked={!!l.itemId} />
                    <input
                      className="cost-line__name"
                      type="text"
                      placeholder="ชื่อวัตถุดิบ"
                      value={l.name}
                      onChange={(e) => patchLine(l.id, { name: e.target.value })}
                    />
                    <button className="btn-ghost btn-sm" onClick={() => openPicker(l.id)}>
                      {l.itemId ? "เปลี่ยนสินค้า" : "เลือกจากสต็อก"}
                    </button>
                    {l.itemId && (
                      <button className="btn-ghost btn-sm" title="ตัดการเชื่อมกับสินค้าในสต็อก" onClick={() => unlinkItem(l.id)}>
                        ปลด
                      </button>
                    )}
                    <button className="icon-btn del" title="ลบวัตถุดิบ" onClick={() => removeLine(l.id)}>🗑️</button>
                  </div>

                  {l.itemId && (
                    <div className="cost-line__link text-xs">
                      {linked ? (
                        <>
                          📦 ผูกกับ <strong>{linked.name}</strong>
                          {linked.variant ? ` · ${linked.variant}` : ""}
                          {linked.size ? ` · ${linked.size}` : ""}
                          {` · เหลือ ${linked.qty}`}
                          {linked.price != null ? ` · ฿${linked.price.toLocaleString("th-TH")}/แพ็ค` : ""}
                          {linked.price != null && (linked.buyQty ?? 0) > 1
                            ? ` (ซื้อ ${linked.buyQty} แพ็ค = จ่ายจริง ${baht(linked.price * linked.buyQty!)})`
                            : ""}
                          {linked.link && (
                            <a className="link-icon" href={linked.link} target="_blank" rel="noopener noreferrer" title="เปิดลิงก์สินค้า">🔗</a>
                          )}
                        </>
                      ) : (
                        <span className="cost-line__link--missing">⚠️ ไม่พบสินค้านี้ในสต็อกแล้ว — ใช้ราคาที่บันทึกไว้ในสูตร</span>
                      )}
                    </div>
                  )}

                  {pickerFor === l.id && renderPicker()}

                  <div className="cost-line__grid">
                    <label className="cost-num">
                      <span>ราคาต่อ 1 แพ็ค (บาท)</span>
                      <input
                        type="number"
                        min="0"
                        placeholder="0"
                        value={l.buyPrice}
                        onChange={(e) => patchLine(l.id, { buyPrice: e.target.value })}
                      />
                    </label>
                    <label className="cost-num">
                      <span>1 แพ็คได้ปริมาณ</span>
                      <input
                        type="number"
                        min="0"
                        placeholder="1"
                        value={l.packAmount}
                        onChange={(e) => patchLine(l.id, { packAmount: e.target.value })}
                      />
                    </label>
                    <label className="cost-num">
                      <span>หน่วย</span>
                      <input
                        type="text"
                        placeholder="g / ml / ชิ้น"
                        value={l.unit}
                        onChange={(e) => patchLine(l.id, { unit: e.target.value })}
                      />
                    </label>
                    <label className="cost-num">
                      <span>ใช้ไป</span>
                      <input
                        type="number"
                        min="0"
                        placeholder="0"
                        value={l.usedAmount}
                        onChange={(e) => patchLine(l.id, { usedAmount: e.target.value })}
                      />
                    </label>
                  </div>

                  {issue && <div className="cost-line__warn text-xs">⚠️ {issue}</div>}

                  <div className="cost-line__foot">
                    <span className="text-xs cost-line__rate">
                      {line.packAmount > 0 ? (
                        <>
                          {baht(line.buyPrice)} ÷ {amountText(line.packAmount)} {line.unit} ={" "}
                          <strong>{baht(unitCost(line))}</strong> ต่อ 1 {line.unit}
                        </>
                      ) : (
                        "ยังคิดต้นทุนต่อหน่วยไม่ได้"
                      )}
                    </span>
                    <span className="cost-line__cost">
                      {baht(cost)}
                      {share > 0 && <small> ({share.toFixed(0)}%)</small>}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {pickerFor === "new" && renderPicker()}

          <div className="modal-actions-inline">
            <button className="btn-primary btn-sm" onClick={() => openPicker("new")}>📦 เลือกจากสต็อก</button>
            <button className="btn-ghost btn-sm" onClick={addLine}>✏️ กรอกเอง</button>
          </div>

          <h3 className="cost-section-title">ค่าใช้จ่ายอื่น (ต่อ 1 รอบ)</h3>
          <div className="cost-inline-fields">
            <div className="field">
              <label>ค่าแรง / ค่าเวลา</label>
              <input
                type="number"
                min="0"
                placeholder="0"
                value={draft.laborCost}
                onChange={(e) => setDraft({ ...draft, laborCost: e.target.value })}
              />
            </div>
            <div className="field">
              <label>ค่าอื่นๆ (บรรจุภัณฑ์/ค่าส่ง/ค่าไฟ)</label>
              <input
                type="number"
                min="0"
                placeholder="0"
                value={draft.otherCost}
                onChange={(e) => setDraft({ ...draft, otherCost: e.target.value })}
              />
            </div>
            <div className="field">
              <label>ราคาขายต่อ 1 {preview.yieldUnit}</label>
              <input
                type="number"
                min="0"
                placeholder="ไม่บังคับ"
                value={draft.sellPrice}
                onChange={(e) => setDraft({ ...draft, sellPrice: e.target.value })}
              />
            </div>
          </div>

          <div className="field">
            <label>หมายเหตุ / วิธีทำ</label>
            <textarea
              rows={2}
              placeholder="ไม่บังคับ"
              value={draft.note}
              onChange={(e) => setDraft({ ...draft, note: e.target.value })}
            />
          </div>

          <div className="cost-summary">
            <div className="cost-summary__row">
              <span>ค่าวัตถุดิบรวม</span><strong>{baht(totals.materialCost)}</strong>
            </div>
            <div className="cost-summary__row">
              <span>ค่าแรง + ค่าอื่นๆ</span><strong>{baht(preview.laborCost + preview.otherCost)}</strong>
            </div>
            <div className="cost-summary__row">
              <span>ต้นทุนรวม 1 รอบ ({preview.yieldQty} {preview.yieldUnit})</span>
              <strong>{baht(totals.batchCost)}</strong>
            </div>
            <div className="cost-summary__row cost-summary__row--main">
              <span>ต้นทุนต่อ 1 {preview.yieldUnit}</span>
              <strong>{baht(totals.perUnitCost)}</strong>
            </div>
            {totals.feePerUnit > 0 && (
              <div className="cost-summary__row">
                <span>ค่าธรรมเนียม/ค่าส่ง ต่อ 1 {preview.yieldUnit}</span>
                <strong>−{baht(totals.feePerUnit)}</strong>
              </div>
            )}
            {totals.profitPerUnit != null && (
              <>
                <div className={`cost-summary__row ${totals.profitPerUnit < 0 ? "cost-summary__row--loss" : "cost-summary__row--profit"}`}>
                  <span>กำไรต่อ 1 {preview.yieldUnit}</span>
                  <strong>{baht(totals.profitPerUnit)} ({totals.marginPct!.toFixed(0)}%)</strong>
                </div>
                <div className="cost-summary__row">
                  <span>กำไรทั้งรอบ</span><strong>{baht(totals.profitPerBatch!)}</strong>
                </div>
              </>
            )}
          </div>

          {canLogRuns && (
            <>
              <h3 className="cost-section-title">ทำไปแล้วกี่รอบ</h3>
              <p className="sub sub-tight text-xs">
                จดไว้เฉยๆ ว่าทำวันไหนกี่รอบ — <b>ไม่ตัดสต็อกวัตถุดิบให้</b> (สต็อกอัปเดตทางนำเข้า Shopee ทางเดียว)
                ต้นทุนรวมข้างล่างคิดจากราคาวัตถุดิบ<b>ปัจจุบัน</b> ไม่ใช่ราคา ณ วันที่ทำ
              </p>
              <div className="run-add">
                <label className="cost-num">
                  <span>ทำกี่รอบ</span>
                  <input
                    type="number"
                    min={1}
                    value={runBatches}
                    onChange={(e) => setRunBatches(e.target.value)}
                  />
                </label>
                <button type="button" className="btn-ghost btn-sm" onClick={handleLogRun}>
                  ＋ บันทึกว่าทำวันนี้
                </button>
              </div>
              {production && production.times > 0 && (
                <>
                  <div className="cost-summary">
                    <div className="cost-summary__row">
                      <span>ทำไปแล้ว</span>
                      <strong>{production.batches} รอบ · ได้ {production.units} {preview.yieldUnit}</strong>
                    </div>
                    <div className="cost-summary__row">
                      <span>ต้นทุนที่ลงไป (ราคาวัตถุดิบวันนี้)</span>
                      <strong>{baht(production.cost)}</strong>
                    </div>
                  </div>
                  <ul className="run-list">
                    {[...runs!].reverse().map((r) => (
                      <li className="run-row" key={r.id}>
                        <span className="run-row__date">{formatThaiShortDate(r.date) || r.date || "ไม่ทราบวันที่"}</span>
                        <span className="run-row__batches">{r.batches} รอบ</span>
                        {onRemoveRun && (
                          <button
                            type="button"
                            className="icon-btn del"
                            title="ลบรอบนี้ออกจากประวัติ"
                            onClick={() => onRemoveRun(recipe!.id, r.id)}
                          >
                            🗑️
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </>
          )}

          <h3 className="cost-section-title">ควรขายเท่าไร</h3>
          <PriceAdvisor
            cost={totals.perUnitCost}
            unitLabel={preview.yieldUnit}
            sellPrice={preview.sellPrice}
            onUsePrice={(price) => setDraft({ ...draft, sellPrice: String(price) })}
          />
        </div>

        <div className="modal-actions">
          <button className="btn-ghost" onClick={onClose}>ยกเลิก</button>
          <button className="btn-primary" onClick={handleSave} disabled={!draft.name.trim()}>บันทึกสูตร</button>
        </div>
    </ModalShell>
  );
}
