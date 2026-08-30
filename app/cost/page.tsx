"use client";

import { useMemo, useState } from "react";
import RecipeModal from "@/components/RecipeModal";
import MaterialLabel from "@/components/MaterialLabel";
import { useStockDB } from "@/lib/hooks/StockDBProvider";
import { useRecipeActions } from "@/lib/hooks/useRecipeActions";
import { baht, driftNote, emptyRecipe, lineCost, lineIssue, recipeTotals, stockDrift } from "@/lib/domain/cost";
import { DEFAULT_PRICING, pct, suggestPrice } from "@/lib/domain/pricing";
import type { Recipe } from "@/lib/types";

export default function CostPage() {
  const { db, setDb } = useStockDB();
  const actions = useRecipeActions(setDb);
  // ห่อด้วย useMemo เพราะ `?? []` สร้างอาร์เรย์ใหม่ทุก render ทำให้ useMemo ที่อ้างถึงมันคิดใหม่ทุกครั้ง
  const recipes = useMemo(() => db.recipes ?? [], [db.recipes]);
  const pricing = db.pricing ?? DEFAULT_PRICING;

  const [editing, setEditing] = useState<Recipe | null>(null);

  /** ใช้ผูกวัตถุดิบในสูตร (RecipeLine.itemId) กลับไปหาสินค้าจริงในสต็อก เพื่อโชว์รูป/ขนาด/จำนวนคงเหลือ */
  const itemById = useMemo(() => new Map(db.items.map((i) => [i.id, i])), [db.items]);

  const totalProfitPerBatch = useMemo(
    () => recipes.reduce((s, r) => s + (recipeTotals(r, pricing).profitPerBatch ?? 0), 0),
    [recipes, pricing]
  );

  const handleSave = (recipe: Recipe) => {
    actions.save(recipe);
    setEditing(null);
  };

  return (
    <div className="page">
      <h1>🧮 คำนวณต้นทุน</h1>
      <p className="sub sub-tight text-xs">
        สร้างสูตรว่าของ 1 รอบใช้วัตถุดิบอะไรบ้าง ใช้เท่าไร แล้วระบบคิดต้นทุนต่อชิ้น กำไร และราคาขายแนะนำให้
      </p>

      <div className="stats">
        <div className="stat stat--blue"><div className="n">{recipes.length}</div><div className="l">สูตรทั้งหมด</div></div>
        <div className="stat stat--green">
          <div className="n">{baht(totalProfitPerBatch)}</div>
          <div className="l">กำไรรวมถ้าทำครบทุกสูตร 1 รอบ</div>
        </div>
        <div className="stat stat--violet">
          <div className="n">{pct(pricing.targetMarginPct)}</div>
          <div className="l">เป้ากำไรที่ใช้คิดราคาขาย (แก้ได้ในสูตร)</div>
        </div>
      </div>

      <div className="toolbar">
        <button className="btn-primary" onClick={() => setEditing(emptyRecipe())}>+ สร้างสูตรใหม่</button>
      </div>

      {recipes.length === 0 ? (
        <div className="empty">ยังไม่มีสูตร — กด &quot;สร้างสูตรใหม่&quot; เพื่อเริ่มคำนวณต้นทุน</div>
      ) : (
        <div className="recipe-list">
          {recipes.map((r) => {
            const t = recipeTotals(r, pricing);
            const maxCost = Math.max(...r.lines.map(lineCost), 0.0001);
            // ยังไม่ได้ตั้งราคาขาย → เสนอราคาที่ควรขายให้เลย / ตั้งแล้วแต่กำไรไม่ถึงเป้า → บอกว่าควรขายเท่าไร
            const suggested = suggestPrice(t.perUnitCost, pricing);
            const belowTarget =
              suggested != null && t.marginPct != null && t.marginPct + 0.5 < pricing.targetMarginPct;
            return (
              <div className="recipe-card" key={r.id}>
                <div className="recipe-card__head">
                  <div>
                    <h3 className="recipe-card__title">{r.name || "(ไม่มีชื่อ)"}</h3>
                    <p className="text-xs recipe-card__meta">
                      วัตถุดิบ {r.lines.length} อย่าง · ทำได้ {r.yieldQty} {r.yieldUnit} · ต้นทุนรอบละ {baht(t.batchCost)}
                    </p>
                  </div>
                  <div className="recipe-card__actions">
                    <button className="btn-ghost btn-sm" onClick={() => setEditing(r)}>แก้ไข</button>
                    <button className="btn-ghost btn-sm" onClick={() => actions.duplicate(r)}>ทำซ้ำ</button>
                    <button className="btn-ghost btn-sm" onClick={() => actions.exportCsv(r)}>CSV</button>
                    <button className="btn-danger btn-sm" onClick={() => actions.remove(r)}>ลบ</button>
                  </div>
                </div>

                <div className="recipe-card__figures">
                  <div className="recipe-figure">
                    <div className="recipe-figure__n">{baht(t.perUnitCost)}</div>
                    <div className="recipe-figure__l">ต้นทุนต่อ 1 {r.yieldUnit}</div>
                  </div>
                  {r.sellPrice != null ? (
                    <>
                      <div className="recipe-figure">
                        <div className="recipe-figure__n">{baht(r.sellPrice)}</div>
                        <div className="recipe-figure__l">ราคาขาย</div>
                      </div>
                      <div className={`recipe-figure ${t.profitPerUnit! < 0 ? "recipe-figure--loss" : "recipe-figure--profit"}`}>
                        <div className="recipe-figure__n">
                          {baht(t.profitPerUnit!)} <small>({t.marginPct!.toFixed(0)}%)</small>
                        </div>
                        <div className="recipe-figure__l">กำไรต่อชิ้น</div>
                      </div>
                    </>
                  ) : (
                    suggested && (
                      <div className="recipe-figure recipe-figure--suggest">
                        <div className="recipe-figure__n">
                          {baht(suggested.price)} <small>({pct(suggested.outcome.marginPct)})</small>
                        </div>
                        <div className="recipe-figure__l">ราคาที่ควรขาย · ยังไม่ได้ตั้งราคา</div>
                      </div>
                    )
                  )}
                </div>

                {r.sellPrice != null && belowTarget && (
                  <p className="text-xs recipe-card__hint">
                    💡 กำไรยังไม่ถึงเป้า {pct(pricing.targetMarginPct)} — ถ้าจะให้ถึงต้องขาย{" "}
                    <strong>{baht(suggested!.price)}</strong>
                  </p>
                )}

                {r.lines.length > 0 && (
                  <table className="recipe-table">
                    <thead>
                      <tr>
                        <th>วัตถุดิบ</th>
                        <th>ใช้</th>
                        <th>ต้นทุน</th>
                      </tr>
                    </thead>
                    <tbody>
                      {r.lines.map((l) => {
                        const cost = lineCost(l);
                        const issue = lineIssue(l);
                        // ราคา/ขนาดแพ็คในสูตรเป็นสแนปช็อต — แก้ที่หน้าสินค้าแล้วต้องมาเปิดสูตรกด "ใช้ค่าล่าสุด" เอง
                        const drift = stockDrift(l, l.itemId ? itemById.get(l.itemId) : undefined);
                        return (
                          <tr key={l.id}>
                            <td>
                              <MaterialLabel line={l} item={l.itemId ? itemById.get(l.itemId) : undefined} />
                              {issue && <div className="cost-line__warn text-xs">⚠️ {issue}</div>}
                              {drift && (
                                <div className="cost-line__drift text-xs">
                                  <span>{drift.fillsUnknownPack ? "📦" : "🔄"} {driftNote(drift, l)} — กดแก้ไขสูตรเพื่ออัปเดต</span>
                                </div>
                              )}
                            </td>
                            <td>{l.usedAmount} {l.unit}</td>
                            <td>
                              <div className="summary-bar-cell">
                                <span className="summary-bar-track">
                                  <span className="summary-bar-fill" style={{ width: `${(cost / maxCost) * 100}%` }} />
                                </span>
                                <span className="summary-bar-label">{baht(cost)}</span>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                      {(r.laborCost > 0 || r.otherCost > 0) && (
                        <tr>
                          <td>ค่าแรง + ค่าอื่นๆ</td>
                          <td>—</td>
                          <td><span className="summary-bar-label">{baht(r.laborCost + r.otherCost)}</span></td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                )}

                {r.note && <p className="text-xs recipe-card__note">{r.note}</p>}
              </div>
            );
          })}
        </div>
      )}

      <RecipeModal
        open={editing !== null}
        recipe={editing}
        items={db.items}
        onClose={() => setEditing(null)}
        onSave={handleSave}
        runs={editing ? recipes.find((r) => r.id === editing.id)?.runs : undefined}
        onLogRun={actions.logRun}
        onRemoveRun={actions.removeRun}
      />
    </div>
  );
}
