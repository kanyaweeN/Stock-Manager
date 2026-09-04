/**
 * รูปร่างของข้อมูล (`StockDB`) + ตัวช่วยอ่าน "ข้อมูลดิบ" ที่ยังไม่การันตี type
 * ไฟล์นี้ไม่มีตรรกะแปลงข้อมูล — migration อยู่ที่ `migrations.ts` การเติมค่า default อยู่ที่ `normalize.ts`
 */
import type { PricingSettings, PurchaseOrder, PurchasePlan, Recipe, StockItem } from "@/lib/types";

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
  /** เวอร์ชันโครงสร้างข้อมูล — ดู `MIGRATIONS` ด้านล่าง ข้อมูลเก่าที่ยังไม่มีฟิลด์นี้ถือเป็น v0 */
  schemaVersion: number;
  items: StockItem[];
  categoryPresets: string[];
  /** ส่วนผสมที่ผู้ใช้ตั้งไว้ว่าแพ้/ไม่เอา — ใช้เตือนตอนวิเคราะห์ส่วนผสม (ดู lib/domain/ingredients.ts) */
  avoidIngredients?: string[];
  skinProfile?: SkinProfile;
  /** สูตรต้นทุน (ทำอะไร ใช้อะไรบ้าง ต้นทุนต่อชิ้นเท่าไร) — ดู lib/domain/cost.ts */
  recipes?: Recipe[];
  /** แผนซื้อของ (เดือนหน้า/ปีใหม่ ต้องซื้ออะไรบ้าง ซื้อไปแล้วเท่าไร) — ดู lib/domain/plan.ts */
  plans?: PurchasePlan[];
  /** ตั้งค่าคิดราคาขาย (กำไรที่อยากได้ / ค่าธรรมเนียม / วิธีปัดราคา) — ดู lib/domain/pricing.ts */
  pricing?: PricingSettings;
  /** ค่าส่ง/ส่วนลดระดับออเดอร์ที่ไม่ได้อยู่ในราคาสินค้า — ดู `orderExtras` ใน lib/domain/summary.ts */
  orders?: PurchaseOrder[];
  /** ของที่ลบไปแล้วแต่ยังกู้คืนได้ — **ไม่ได้อยู่ใน `items`** แล้ว (ดู lib/domain/trash.ts) */
  trash?: StockItem[];
  /**
   * รายการ id ของสินค้าที่ผู้ใช้เลือกให้ติดตามในหน้า `/forecast` (คาดคะเนวันซื้ออีกครั้ง)
   *
   * เก็บใน StockDB (แทนที่จะเป็น localStorage) เพื่อให้ซิงก์ข้ามเครื่องผ่าน Drive
   * id ที่ชี้ไปยังสินค้าที่ถูกลบแล้วจะถูกฟิลเตอร์ทิ้งใน `normalizeDB` เพื่อไม่ให้บวมขึ้นเรื่อยๆ
   */
  forecastItemIds?: string[];
  updatedAt?: string;
}

/** ข้อมูลดิบระหว่างทาง — ยังไม่การันตีว่าตรง type (อาจมาจาก JSON ที่แก้มือ หรือแอปเวอร์ชันเก่า) */
export type RawDB = Record<string, unknown>;
export type RawItem = Record<string, unknown>;

export const asArray = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
