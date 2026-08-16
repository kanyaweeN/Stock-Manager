"use client";

import { todayISO } from "./date";
import type { StockDB } from "./db";
import type { Recipe } from "./types";
import { uid } from "./uid";
import { lineCost, recipeTotals } from "./cost";

function csvCell(v: unknown) {
  return `"${String(v ?? "").replace(/"/g, '""')}"`;
}

/** ส่งออกสูตรเป็น CSV — 1 แถวต่อวัตถุดิบ 1 อย่าง แล้วต่อท้ายด้วยสรุปต้นทุน */
function exportRecipeCsv(recipe: Recipe) {
  const t = recipeTotals(recipe);
  const header = "วัตถุดิบ,ราคาที่ซื้อ,ปริมาณต่อแพ็ค,หน่วย,ปริมาณที่ใช้,ต้นทุน\n";
  const rows = recipe.lines
    .map((l) => [l.name, l.buyPrice, l.packAmount, l.unit, l.usedAmount, lineCost(l).toFixed(2)].map(csvCell).join(","))
    .join("\n");
  const summary = [
    ["", "", "", "", "ค่าวัตถุดิบรวม", t.materialCost.toFixed(2)],
    ["", "", "", "", "ค่าแรง", recipe.laborCost],
    ["", "", "", "", "ค่าใช้จ่ายอื่น", recipe.otherCost],
    ["", "", "", "", `ต้นทุนรวม (${recipe.yieldQty} ${recipe.yieldUnit})`, t.batchCost.toFixed(2)],
    ["", "", "", "", `ต้นทุนต่อ 1 ${recipe.yieldUnit}`, t.perUnitCost.toFixed(2)],
    ...(t.profitPerUnit != null ? [["", "", "", "", "กำไรต่อชิ้น", t.profitPerUnit.toFixed(2)]] : []),
  ]
    .map((r) => r.map(csvCell).join(","))
    .join("\n");

  const blob = new Blob(["﻿" + header + rows + "\n" + summary], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `cost-${recipe.name || "recipe"}-${todayISO()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
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

  const duplicate = (recipe: Recipe) => {
    setRecipes((prev) => [
      ...prev,
      {
        ...recipe,
        id: uid(),
        name: `${recipe.name} (สำเนา)`,
        lines: recipe.lines.map((l) => ({ ...l, id: uid() })),
        updatedAt: new Date().toISOString(),
      },
    ]);
  };

  return { save, remove, duplicate, exportCsv: exportRecipeCsv };
}
