"use client";

import { todayISO } from "@/lib/core/date";
import { csvRows, downloadFile } from "@/lib/core/download";
import type { StockDB } from "@/lib/db";
import type { ProductionRun, Recipe } from "@/lib/types";
import { uid } from "@/lib/core/uid";
import { lineCost, recipeTotals } from "@/lib/domain/cost";

/** ส่งออกสูตรเป็น CSV — 1 แถวต่อวัตถุดิบ 1 อย่าง แล้วต่อท้ายด้วยสรุปต้นทุน */
function exportRecipeCsv(recipe: Recipe) {
  const t = recipeTotals(recipe);
  const header = "วัตถุดิบ,ราคาที่ซื้อ,ปริมาณต่อแพ็ค,หน่วย,ปริมาณที่ใช้,ต้นทุน\n";
  const rows = csvRows(
    recipe.lines.map((l) => [l.name, l.buyPrice, l.packAmount, l.unit, l.usedAmount, lineCost(l).toFixed(2)])
  );
  const summary = csvRows([
    ["", "", "", "", "ค่าวัตถุดิบรวม", t.materialCost.toFixed(2)],
    ["", "", "", "", "ค่าแรง", recipe.laborCost],
    ["", "", "", "", "ค่าใช้จ่ายอื่น", recipe.otherCost],
    ["", "", "", "", `ต้นทุนรวม (${recipe.yieldQty} ${recipe.yieldUnit})`, t.batchCost.toFixed(2)],
    ["", "", "", "", `ต้นทุนต่อ 1 ${recipe.yieldUnit}`, t.perUnitCost.toFixed(2)],
    ...(t.profitPerUnit != null ? [["", "", "", "", "กำไรต่อชิ้น", t.profitPerUnit.toFixed(2)]] : []),
  ]);

  downloadFile(`cost-${recipe.name || "recipe"}-${todayISO()}.csv`, header + rows + "\n" + summary);
}

/** CRUD ของสูตรต้นทุน (เพิ่ม/แก้ไข/ลบ/ทำซ้ำ/ส่งออก CSV) */
export function useRecipeActions(setDb: (updater: (prev: StockDB) => StockDB) => void) {
  const setRecipes = (updater: (prev: Recipe[]) => Recipe[]) => {
    setDb((prev) => ({ ...prev, recipes: updater(prev.recipes ?? []) }));
  };

  const save = (recipe: Recipe) => {
    const stamped = { ...recipe, updatedAt: new Date().toISOString() };
    setRecipes((prev) =>
      prev.some((r) => r.id === recipe.id)
        ? prev.map((r) => (r.id === recipe.id ? stamped : r))
        : [...prev, stamped]
    );
  };

  const remove = (recipe: Recipe) => {
    if (confirm(`ลบสูตร "${recipe.name}"?`)) {
      setRecipes((prev) => prev.filter((r) => r.id !== recipe.id));
    }
  };

  /**
   * จดว่าทำสูตรนี้ไปแล้ว 1 ครั้ง — **ไม่ตัดสต็อกวัตถุดิบให้**
   *
   * ตรงกับกติกาเดิมของฟีเจอร์สูตร (สต็อกอัปเดตทางนำเข้า Shopee ทางเดียว) และเพราะ
   * วัตถุดิบในสูตรวัดเป็นกรัม/มล. แต่ `item.qty` นับเป็นแพ็ค — หักให้อัตโนมัติจะได้
   * จำนวนแพ็คที่เป็นเศษทศนิยม ซึ่งเพี้ยนกับทุกอย่างที่นับเป็นชิ้นในแอป
   */
  const logRun = (recipeId: string, run: Omit<ProductionRun, "id">) => {
    setRecipes((prev) =>
      prev.map((r) =>
        r.id === recipeId
          ? { ...r, runs: [...(r.runs ?? []), { ...run, id: uid() }], updatedAt: new Date().toISOString() }
          : r
      )
    );
  };

  const removeRun = (recipeId: string, runId: string) => {
    setRecipes((prev) =>
      prev.map((r) =>
        r.id === recipeId
          ? { ...r, runs: (r.runs ?? []).filter((x) => x.id !== runId), updatedAt: new Date().toISOString() }
          : r
      )
    );
  };

  const duplicate = (recipe: Recipe) => {
    setRecipes((prev) => [
      ...prev,
      {
        ...recipe,
        id: uid(),
        name: `${recipe.name} (สำเนา)`,
        lines: recipe.lines.map((l) => ({ ...l, id: uid() })),
        // สำเนาเป็นสูตรใหม่ที่ยังไม่เคยทำ — ประวัติการผลิตของต้นฉบับไม่ใช่ของมัน
        runs: [],
        updatedAt: new Date().toISOString(),
      },
    ]);
  };

  return { save, remove, duplicate, logRun, removeRun, exportCsv: exportRecipeCsv };
}
