"use client";

import { useMemo, useState } from "react";
import RecipeModal from "@/components/RecipeModal";
import MaterialLabel from "@/components/MaterialLabel";
import { useStockDB } from "@/lib/StockDBProvider";
import { useRecipeActions } from "@/lib/useRecipeActions";
import { baht, emptyRecipe, lineCost, recipeTotals } from "@/lib/cost";
import type { Recipe } from "@/lib/types";

export default function CostPage() {
  const { db, setDb } = useStockDB();
  const actions = useRecipeActions(setDb);
  const recipes = db.recipes ?? [];

  const [editing, setEditing] = useState<Recipe | null>(null);

  /** ใช้ผูกวัตถุดิบในสูตร (RecipeLine.itemId) กลับไปหาสินค้าจริงในสต็อก เพื่อโชว์รูป/ขนาด/จำนวนคงเหลือ */
  const itemById = useMemo(() => new Map(db.items.map((i) => [i.id, i])), [db.items]);

  const totalProfitPerBatch = useMemo(
    () => recipes.reduce((s, r) => s + (recipeTotals(r).profitPerBatch ?? 0), 0),
    [recipes]
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
      </div>

      <div className="toolbar">
        <button className="btn-primary" onClick={() => setEditing(emptyRecipe())}>+ สร้างสูตรใหม่</button>
      </div>

      {recipes.length === 0 ? (
        <div className="empty">ยังไม่มีสูตร — กด &quot;สร้างสูตรใหม่&quot; เพื่อเริ่มคำนวณต้นทุน</div>
      ) : (
        <div className="recipe-list">
          {recipes.map((r) => {
            const t = recipeTotals(r);
            const maxCost = Math.max(...r.lines.map(lineCost), 0.0001);
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
                  {r.sellPrice != null && (
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
                  )}
                </div>

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
                        return (
                          <tr key={l.id}>
                            <td><MaterialLabel line={l} item={l.itemId ? itemById.get(l.itemId) : undefined} /></td>
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
      />
    </div>
  );
}
