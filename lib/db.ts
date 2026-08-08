import type { StockItem } from "./types";

export type SkinType = "" | "oily" | "dry" | "combination" | "normal" | "sensitive";
export type SkinConcern = "acne" | "aging" | "dark-spots" | "redness" | "dryness" | "oiliness" | "pores" | "dullness";

export interface SkinProfile {
  skinType: SkinType;
  concerns: SkinConcern[];
}

export const SKIN_TYPE_LABELS: Record<SkinType, string> = {
  "": "ยังไม่ได้ตั้ง",
  oily: "ผิวมัน",
  dry: "ผิวแห้ง",
  combination: "ผิวผสม",
  normal: "ผิวธรรมดา",
  sensitive: "ผิวแพ้ง่าย",
};

export const SKIN_CONCERN_LABELS: Record<SkinConcern, string> = {
  acne: "สิว",
  aging: "ริ้วรอย/ชะลอวัย",
  "dark-spots": "จุดด่างดำ/ฝ้า",
  redness: "ผิวแดง/ระคายเคือง",
  dryness: "ผิวแห้ง/ลอก",
  oiliness: "หน้ามัน/มันเยิ้ม",
  pores: "รูขุมขนกว้าง",
  dullness: "ผิวหมองคล้ำ",
};

export interface StockDB {
  items: StockItem[];
  categoryPresets: string[];
  /** ส่วนผสมที่ผู้ใช้ตั้งไว้ว่าแพ้/ไม่เอา — ใช้เตือนตอนวิเคราะห์ส่วนผสม (ดู lib/ingredients.ts) */
  avoidIngredients?: string[];
  skinProfile?: SkinProfile;
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
  avoidIngredients: [],
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
        // ข้อมูลเก่าก่อนมีฟีเจอร์วิเคราะห์ส่วนผสมจะไม่มี field นี้ — ปล่อยเป็นสตริงว่างไว้
        ingredients: typeof i.ingredients === "string" ? i.ingredients : "",
      };
    }),
    categoryPresets: Array.isArray(r.categoryPresets) ? r.categoryPresets : DEFAULT_DB.categoryPresets,
    avoidIngredients: Array.isArray(r.avoidIngredients) ? r.avoidIngredients : [],
    skinProfile: r.skinProfile && typeof r.skinProfile === "object" ? r.skinProfile as SkinProfile : { skinType: "", concerns: [] },
    updatedAt: r.updatedAt,
  };
}
