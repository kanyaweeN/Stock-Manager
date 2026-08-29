/**
 * แปลงสูตรต้นทุน ↔ ค่าที่กรอกในฟอร์ม — คำนวณล้วนๆ ไม่มี state
 *
 * แยกออกจาก `components/RecipeModal.tsx` ด้วยเหตุผลเดียวกับ `lib/importMerge.ts`:
 * การแปลงตัวเลขตรงนี้พลาดแล้ว**ต้นทุนเพี้ยนเงียบๆ** (ดู `packAmount` ข้างล่าง) แต่ตอนอยู่
 * ในไฟล์ component มันเทสต์ไม่ได้เลย
 *
 * **เพิ่มฟิลด์ใหม่ = แก้ `RecipeDraft` + `toDraft` + `fromDraft` เท่านั้น**
 */
import type { Recipe, RecipeLine } from "./types";

/** เก็บค่าตัวเลขเป็นสตริงระหว่างกรอก จะได้พิมพ์ "0.5" หรือลบให้ว่างได้โดยไม่โดนบังคับเป็น 0 */
export interface RecipeLineDraft {
  id: string;
  itemId?: string;
  name: string;
  buyPrice: string;
  packAmount: string;
  unit: string;
  usedAmount: string;
}

export interface RecipeDraft {
  id: string;
  name: string;
  note: string;
  lines: RecipeLineDraft[];
  yieldQty: string;
  yieldUnit: string;
  laborCost: string;
  otherCost: string;
  sellPrice: string;
}

const n = (v: string) => {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
};

export const toRecipeLineDraft = (l: RecipeLine): RecipeLineDraft => ({
  id: l.id,
  itemId: l.itemId,
  name: l.name,
  buyPrice: l.buyPrice ? String(l.buyPrice) : "",
  packAmount: l.packAmount ? String(l.packAmount) : "", // 0 = ยังไม่รู้ขนาดแพ็ค ปล่อยว่างให้กรอกเอง
  unit: l.unit,
  usedAmount: l.usedAmount ? String(l.usedAmount) : "",
});

export const fromRecipeLineDraft = (l: RecipeLineDraft): RecipeLine => ({
  id: l.id,
  itemId: l.itemId,
  name: l.name.trim(),
  buyPrice: n(l.buyPrice),
  // ห้าม fallback เป็น 1 — ช่องว่างแปลว่า "ยังไม่รู้ขนาดแพ็ค" ถ้าหารด้วย 1 เงียบๆ ต้นทุนจะพุ่งเป็นราคาเต็มคูณจำนวนที่ใช้
  packAmount: n(l.packAmount),
  unit: l.unit.trim() || "ชิ้น",
  usedAmount: n(l.usedAmount),
});

export function toRecipeDraft(recipe: Recipe): RecipeDraft {
  return {
    id: recipe.id,
    name: recipe.name,
    note: recipe.note,
    lines: recipe.lines.map(toRecipeLineDraft),
    yieldQty: String(recipe.yieldQty || 1),
    yieldUnit: recipe.yieldUnit || "ชิ้น",
    laborCost: recipe.laborCost ? String(recipe.laborCost) : "",
    otherCost: recipe.otherCost ? String(recipe.otherCost) : "",
    sellPrice: recipe.sellPrice != null ? String(recipe.sellPrice) : "",
  };
}

/**
 * ฟอร์ม → สูตร — ทิ้งบรรทัดที่ยังว่างเปล่า (ไม่มีชื่อและไม่ได้ใส่ปริมาณ)
 *
 * **ไม่พก `runs` ติดไปด้วยโดยตั้งใจ** — ประวัติการผลิตไม่ได้อยู่ในฟอร์ม และถูกเขียนลง db
 * ทันทีตอนกดจด (`useRecipeActions.logRun`) ผู้เรียกเป็นคนผสมกลับเข้าไปเอง ดู `RecipeModal`
 */
export function fromRecipeDraft(d: RecipeDraft): Recipe {
  return {
    id: d.id,
    name: d.name.trim(),
    note: d.note.trim(),
    lines: d.lines.map(fromRecipeLineDraft).filter((l) => l.name || l.usedAmount > 0),
    yieldQty: Math.max(1, n(d.yieldQty) || 1),
    yieldUnit: d.yieldUnit.trim() || "ชิ้น",
    laborCost: n(d.laborCost),
    otherCost: n(d.otherCost),
    sellPrice: d.sellPrice.trim() ? n(d.sellPrice) : undefined,
  };
}
