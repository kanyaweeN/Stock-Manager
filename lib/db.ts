import type { StockItem } from "./types";

export interface StockDB {
  items: StockItem[];
  categoryPresets: string[];
  updatedAt?: string;
}

export const DEFAULT_DB: StockDB = {
  items: [],
  categoryPresets: ["เครื่องใช้", "อุปกรณ์ฝีมือ"],
};

/** รองรับข้อมูลเก่าที่อาจไม่มี field ครบ */
export function migrateDB(raw: unknown): StockDB {
  const r = (raw ?? {}) as Partial<StockDB>;
  const items = Array.isArray(r.items) ? r.items : [];
  return {
    // ข้อมูลเก่าก่อนหน้านี้เซ็ต cat เป็น "Shopee" ตรงๆ ตอนนำเข้า — ย้ายมาเป็น source tag แทน
    // แล้วเคลียร์หมวดหมู่ทิ้งเพื่อให้ผู้ใช้เลือกหมวดหมู่จริงใหม่
    items: items.map((i) =>
      i.cat === "Shopee" && !i.source ? { ...i, cat: "", source: "shopee" as const } : i
    ),
    categoryPresets: Array.isArray(r.categoryPresets) ? r.categoryPresets : DEFAULT_DB.categoryPresets,
    updatedAt: r.updatedAt,
  };
}
