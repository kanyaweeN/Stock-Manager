/**
 * แก้หมวดหมู่ของสินค้าหลายชิ้นพร้อมกัน — คำนวณล้วนๆ ไม่พึ่งโมดูลอื่น
 *
 * เดิมมีทางเดียวคือ "ทับของเดิมทั้งหมด" ซึ่งพังกับงานที่ทำบ่อยที่สุด: อยากติดป้ายเพิ่ม
 * ให้ของ 10 ชิ้นที่แต่ละชิ้นมีหมวดของตัวเองอยู่แล้ว กดแล้วหมวดเดิมหายเกลี้ยงทุกชิ้น
 * (แล้วกู้คืนไม่ได้ ต้องไล่ตั้งใหม่ทีละชิ้น) จึงแยกเป็น 3 โหมดชัดๆ และให้ `add`/`remove`
 * แตะเฉพาะหมวดที่เลือก ไม่ยุ่งกับหมวดอื่นของแต่ละชิ้น
 */

export type CatEditMode = "add" | "remove" | "replace";

/** เอาหมวดแม่เปล่าๆ ทิ้ง ถ้ามีซับหมวดของหมวดนั้นเลือกไว้อยู่แล้ว (เช่น มีทั้ง "เครื่องใช้" และ "เครื่องใช้ > ของแต่งห้อง") */
export function dropRedundantParentCats(cats: string[]): string[] {
  return cats.filter((c) => !cats.some((other) => other !== c && other.startsWith(`${c} > `)));
}

function dedupe(cats: string[]): string[] {
  return [...new Set(cats.filter((c) => c.trim() !== ""))];
}

/**
 * ผลลัพธ์ของการแก้หมวดหมู่ 1 ชิ้น — ใช้ทั้งตอนบันทึกจริงและตอนแสดงตัวอย่างในกล่อง
 * จึงไม่มีทางที่ "ที่เห็นตอนกด" กับ "ที่ได้จริง" จะต่างกัน
 *
 * บีบหมวดแม่ที่ซ้ำกับลูกทิ้งด้วยกฎเดียวกับ `normalizeDB` เพราะไม่งั้นตัวอย่างจะโชว์หมวดแม่
 * ที่จะโดนตัดทิ้งตอนโหลดรอบหน้า (เห็นเพิ่มสำเร็จ แต่รีเฟรชแล้วหาย)
 */
export function applyCatEdit(current: string[], picked: string[], mode: CatEditMode): string[] {
  if (mode === "replace") return dropRedundantParentCats(dedupe(picked));
  if (mode === "remove") {
    const drop = new Set(picked);
    return current.filter((c) => !drop.has(c));
  }
  return dropRedundantParentCats(dedupe([...current, ...picked]));
}

export interface CatEditPreview {
  /** หมวดหมู่ของชิ้นนี้หลังกดยืนยัน */
  after: string[];
  /** หมวดที่จะได้เพิ่มมา (โชว์เป็นสีเขียว) */
  added: string[];
  /** หมวดที่จะหายไป (โชว์เป็นขีดฆ่าแดง) */
  removed: string[];
  changed: boolean;
}

/**
 * ตัวอย่างผลลัพธ์รายชิ้นก่อนกดยืนยัน — คิดด้วย `applyCatEdit` ตัวเดียวกับตอนบันทึกจริง
 * ที่เห็นกับที่ได้จึงตรงกันเสมอ (ปัญหาเดิมคือกดแล้วถึงจะรู้ว่าหมวดเดิมหายไปไหน)
 */
export function previewCatEdit(current: string[], picked: string[], mode: CatEditMode): CatEditPreview {
  const after = applyCatEdit(current, picked, mode);
  const added = after.filter((c) => !current.includes(c));
  const removed = current.filter((c) => !after.includes(c));
  return { after, added, removed, changed: added.length > 0 || removed.length > 0 };
}

/**
 * หมวดนี้ตรงกับที่กรองไว้ไหม — ตรงตัว **หรือเป็นลูกของมัน**
 *
 * ต้องนับลูกด้วย เพราะ `dropRedundantParentCats` ตัดหมวดแม่ทิ้งเมื่อชิ้นนั้นมีซับหมวดอยู่แล้ว
 * ("ของใช้ > สบู่" เก็บตัวเดียว ไม่เก็บ "ของใช้" ซ้อนไว้) ถ้าเทียบตรงตัวอย่างเดียว
 * ของที่ **เคยแยกซับหมวดไปแล้ว** จะหายไปจากตัวกรองหมวดแม่ ทั้งที่มันอยู่ในหมวดนั้นจริงๆ —
 * และการกด "เพิ่มหมวดแม่" ให้ของพวกนั้นก็ไม่ช่วย เพราะหมวดแม่ถูกตัดทิ้งทันที
 * (`renameCategory` ใน app/config ก็มองลำดับชั้นแบบเดียวกันนี้)
 */
export function catMatchesFilter(cat: string, filter: string): boolean {
  return cat === filter || cat.startsWith(`${filter} > `);
}

/** ของชิ้นนี้ผ่านตัวกรองหมวดหมู่ไหม — กรองว่าง = ผ่านหมด, เลือกหลายหมวด = เข้าอันใดอันหนึ่งก็พอ */
export function matchesCatFilter(cats: string[], filterCats: string[]): boolean {
  if (filterCats.length === 0) return true;
  return cats.some((c) => filterCats.some((f) => catMatchesFilter(c, f)));
}

/** หมวดหมู่ทั้งหมดที่ของกลุ่มที่เลือกไว้ใช้อยู่ — โหมด "เอาออก" ให้เลือกได้แค่ในนี้ จะได้ไม่ต้องหาในลิสต์ยาวๆ ที่กดแล้วไม่มีอะไรเกิดขึ้น */
export function catsInUse(itemCats: string[][]): string[] {
  return [...new Set(itemCats.flat())].sort();
}

/** หมวดหมู่ที่ "ทุกชิ้น" มีเหมือนกัน — ใช้เติมค่าตั้งต้นให้โหมดแทนที่ จะได้แก้ต่อจากของเดิม ไม่ใช่เริ่มจากว่างแล้วเผลอล้างทิ้ง */
export function commonCats(itemCats: string[][]): string[] {
  if (itemCats.length === 0) return [];
  return itemCats[0].filter((c) => itemCats.every((cats) => cats.includes(c)));
}
