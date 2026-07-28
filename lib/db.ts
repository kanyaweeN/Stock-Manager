import type { StockItem } from "./types";

export interface StockDB {
  items: StockItem[];
  categoryPresets: string[];
  updatedAt?: string;
}

/** นับจำนวน "หน่วย" ของสินค้า — สินค้าที่ถูกจัดกลุ่มไว้ (groupId เดียวกัน) นับรวมเป็น 1 หน่วยแทนที่จะนับแยกทีละชิ้น */
export function countUnits(items: StockItem[]): number {
  const groupIds = new Set(items.filter((i) => i.groupId).map((i) => i.groupId));
  const ungroupedCount = items.filter((i) => !i.groupId).length;
  return ungroupedCount + groupIds.size;
}

export const DEFAULT_DB: StockDB = {
  items: [],
  categoryPresets: ["เครื่องใช้", "อุปกรณ์ฝีมือ"],
};

/** รองรับข้อมูลเก่าที่อาจไม่มี field ครบ */
export function migrateDB(raw: unknown): StockDB {
  const r = (raw ?? {}) as Partial<StockDB>;
  const rawItems = Array.isArray(r.items) ? r.items : [];
  return {
    items: rawItems.map((i) => {
      // ข้อมูลเก่าก่อนหน้านี้เก็บหมวดหมู่เป็น field `cat` แบบสตริงเดี่ยว — ย้ายมาเป็น `cats` แบบ array
      const legacy = i as unknown as { cat?: string; cats?: string[]; source?: string };
      const cats = Array.isArray(legacy.cats) ? legacy.cats : legacy.cat ? [legacy.cat] : [];
      // ข้อมูลเก่ากว่านั้นเซ็ต cat เป็น "Shopee" ตรงๆ ตอนนำเข้า — ย้ายมาเป็น source tag แทน แล้วเคลียร์หมวดหมู่ทิ้ง
      const isLegacyShopeeCat = cats.length === 1 && cats[0] === "Shopee" && !legacy.source;
      const cleanCats = isLegacyShopeeCat ? [] : cats;
      // เอาหมวดหลักเปล่าๆ ทิ้ง ถ้ามีซับหมวดหมู่ของหมวดนั้นเลือกไว้อยู่แล้ว (เช่น มีทั้ง "เครื่องใช้" และ "เครื่องใช้ > ของแต่งห้อง" ซ้ำกัน)
      const dedupedCats = cleanCats.filter(
        (c) => !cleanCats.some((other) => other !== c && other.startsWith(`${c} > `))
      );
      return {
        ...i,
        cats: dedupedCats,
        source: isLegacyShopeeCat ? ("shopee" as const) : i.source,
      };
    }),
    categoryPresets: Array.isArray(r.categoryPresets) ? r.categoryPresets : DEFAULT_DB.categoryPresets,
    updatedAt: r.updatedAt,
  };
}
