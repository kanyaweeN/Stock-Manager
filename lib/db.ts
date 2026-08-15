import type { Recipe, RecipeLine, StockItem } from "./types";

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
  /** ส่วนผสมที่ผู้ใช้ตั้งไว้ว่าแพ้/ไม่เอา — ใช้เตือนตอนวิเคราะห์ส่วนผสม (ดู lib/ingredients.ts) */
  avoidIngredients?: string[];
  skinProfile?: SkinProfile;
  /** สูตรต้นทุน (ทำอะไร ใช้อะไรบ้าง ต้นทุนต่อชิ้นเท่าไร) — ดู lib/cost.ts */
  recipes?: Recipe[];
  updatedAt?: string;
}

/** นับจำนวน "หน่วย" ของสินค้า — สินค้าที่ถูกจัดกลุ่มไว้ (groupId เดียวกัน) นับรวมเป็น 1 หน่วยแทนที่จะนับแยกทีละชิ้น */
export function countUnits(items: StockItem[]): number {
  const groupIds = new Set(items.filter((i) => i.groupId).map((i) => i.groupId));
  const ungroupedCount = items.filter((i) => !i.groupId).length;
  return ungroupedCount + groupIds.size;
}

// ─────────────────────────────────────────────────────────────
// Migration: แปลงข้อมูลเก่าทีละเวอร์ชัน
// ─────────────────────────────────────────────────────────────

/** ข้อมูลดิบระหว่างทาง — ยังไม่การันตีว่าตรง type (อาจมาจาก JSON ที่แก้มือ หรือแอปเวอร์ชันเก่า) */
type RawDB = Record<string, unknown>;
type RawItem = Record<string, unknown>;

interface Migration {
  /** เลขเวอร์ชันที่ข้อมูลจะกลายเป็น หลังรัน step นี้ */
  to: number;
  /** สรุปสั้นๆ ว่าเปลี่ยนอะไร — ใช้อ่านประวัติ schema ย้อนหลัง */
  note: string;
  up(db: RawDB): RawDB;
}

const asArray = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);

/** วน map ทุก item ใน db โดยไม่แตะฟิลด์อื่นของ db */
const mapItems = (db: RawDB, fn: (item: RawItem) => RawItem): RawDB => ({
  ...db,
  items: asArray(db.items).map((i) => fn((i ?? {}) as RawItem)),
});

/**
 * ประวัติการเปลี่ยน schema ทั้งหมด เรียงจากเก่าไปใหม่
 *
 * **เพิ่มฟิลด์ใหม่ใน StockItem/StockDB ⇒ ต่อ step ใหม่ท้ายลิสต์นี้** (`to` = เลขถัดไป)
 * แต่ละ step ต้องรันซ้ำได้โดยไม่พัง (idempotent) เผื่อข้อมูลที่ไม่มี schemaVersion
 * ส่วนการเติมค่า default ล้วนๆ ไม่ต้องเพิ่ม step — ใส่ใน `normalizeDB` ที่รันทุกครั้งแทน
 */
export const MIGRATIONS: Migration[] = [
  {
    to: 1,
    note: "หมวดหมู่เดี่ยว `cat: string` → หลายหมวด `cats: string[]`",
    up: (db) =>
      mapItems(db, (i) => {
        if (Array.isArray(i.cats)) return i;
        const next = { ...i };
        delete next.cat;
        next.cats = typeof i.cat === "string" && i.cat ? [i.cat] : [];
        return next;
      }),
  },
  {
    to: 2,
    note: 'รายการนำเข้ายุคแรกเซ็ตหมวดเป็น "Shopee" ตรงๆ → ย้ายไปเป็น source tag แล้วเคลียร์หมวดทิ้ง',
    up: (db) =>
      mapItems(db, (i) => {
        const cats = asArray(i.cats);
        if (i.source || cats.length !== 1 || cats[0] !== "Shopee") return i;
        return { ...i, cats: [], source: "shopee" };
      }),
  },
  {
    to: 3,
    note: "เพิ่มฟีเจอร์วิเคราะห์ส่วนผสม — เติม item.ingredients / db.avoidIngredients / db.skinProfile",
    up: (db) => ({
      ...mapItems(db, (i) => ({ ...i, ingredients: typeof i.ingredients === "string" ? i.ingredients : "" })),
      avoidIngredients: asArray(db.avoidIngredients),
      skinProfile: db.skinProfile ?? { skinType: "", concerns: [] },
    }),
  },
  {
    to: 4,
    note: "เพิ่มฟีเจอร์คำนวณต้นทุน — เติม db.recipes",
    up: (db) => ({ ...db, recipes: asArray(db.recipes) }),
  },
  {
    to: 5,
    note: 'เพิ่ม item.createdAt (ไว้เรียง "เพิ่มล่าสุด") — ของเก่าเดาจาก purchasedAt ไม่มีก็ปล่อยว่าง',
    up: (db) =>
      mapItems(db, (i) => {
        if (typeof i.createdAt === "string" && i.createdAt) return i;
        return { ...i, createdAt: typeof i.purchasedAt === "string" ? i.purchasedAt : "" };
      }),
  },
];

/** เวอร์ชันล่าสุด = ปลายทางของ migration step สุดท้าย (คำนวณให้ ไม่ต้องแก้มือ) */
export const CURRENT_SCHEMA_VERSION = MIGRATIONS.length ? MIGRATIONS[MIGRATIONS.length - 1].to : 0;

export const DEFAULT_DB: StockDB = {
  schemaVersion: CURRENT_SCHEMA_VERSION,
  items: [],
  categoryPresets: ["เครื่องใช้", "อุปกรณ์ฝีมือ"],
  avoidIngredients: [],
  recipes: [],
};

// ─────────────────────────────────────────────────────────────
// Normalize: เติมค่าเริ่มต้น/บีบ type ให้ตรง — รันทุกครั้งไม่ว่าเวอร์ชันไหน
// ─────────────────────────────────────────────────────────────

const num = (v: unknown, fallback = 0) => (typeof v === "number" && Number.isFinite(v) ? v : fallback);
const str = (v: unknown, fallback = "") => (typeof v === "string" ? v : fallback);

/** เอาหมวดแม่เปล่าๆ ทิ้ง ถ้ามีซับหมวดของหมวดนั้นเลือกไว้อยู่แล้ว (เช่น มีทั้ง "เครื่องใช้" และ "เครื่องใช้ > ของแต่งห้อง") */
function dropRedundantParentCats(cats: string[]): string[] {
  return cats.filter((c) => !cats.some((other) => other !== c && other.startsWith(`${c} > `)));
}

function normalizeItem(raw: unknown): StockItem {
  const i = (raw ?? {}) as RawItem & Partial<StockItem>;
  const cats = asArray(i.cats).filter((c): c is string => typeof c === "string" && c !== "");
  return {
    ...(i as StockItem),
    cats: dropRedundantParentCats(cats),
    ingredients: str(i.ingredients),
    createdAt: str(i.createdAt),
  };
}

function normalizeRecipe(raw: unknown, idx: number): Recipe {
  const r = (raw ?? {}) as Partial<Recipe>;
  return {
    id: r.id || `recipe-${idx}`,
    name: str(r.name),
    note: str(r.note),
    lines: asArray(r.lines).map((l, li): RecipeLine => {
      const line = (l ?? {}) as Partial<RecipeLine>;
      return {
        id: line.id || `line-${idx}-${li}`,
        itemId: line.itemId,
        name: str(line.name),
        buyPrice: num(line.buyPrice),
        packAmount: num(line.packAmount, 1),
        unit: str(line.unit, "ชิ้น") || "ชิ้น",
        usedAmount: num(line.usedAmount),
      };
    }),
    yieldQty: num(r.yieldQty, 1),
    yieldUnit: str(r.yieldUnit) || "ชิ้น",
    laborCost: num(r.laborCost),
    otherCost: num(r.otherCost),
    sellPrice: typeof r.sellPrice === "number" ? r.sellPrice : undefined,
    updatedAt: r.updatedAt,
  };
}

function normalizeDB(db: RawDB, version: number): StockDB {
  const skinProfile = db.skinProfile;
  return {
    ...db,
    // ข้อมูลที่ใหม่กว่าที่แอปรู้จักให้คงเลขเดิมไว้ จะได้ไม่โดน migrate ซ้ำตอนกลับไปเปิดในแอปเวอร์ชันใหม่
    schemaVersion: Math.max(version, CURRENT_SCHEMA_VERSION),
    items: asArray(db.items).map(normalizeItem),
    categoryPresets: Array.isArray(db.categoryPresets)
      ? (db.categoryPresets as string[])
      : DEFAULT_DB.categoryPresets,
    avoidIngredients: asArray(db.avoidIngredients) as string[],
    skinProfile:
      skinProfile && typeof skinProfile === "object" ? (skinProfile as SkinProfile) : { skinType: "", concerns: [] },
    recipes: asArray(db.recipes).map(normalizeRecipe),
    updatedAt: typeof db.updatedAt === "string" ? db.updatedAt : undefined,
  };
}

/** อ่านเวอร์ชันของข้อมูลดิบ — ไม่มีฟิลด์นี้แปลว่าเป็นข้อมูลยุคก่อนมี schemaVersion (v0) */
export function detectSchemaVersion(raw: unknown): number {
  const v = (raw ?? {}) as RawDB;
  return typeof v.schemaVersion === "number" && Number.isFinite(v.schemaVersion) ? v.schemaVersion : 0;
}

/**
 * แปลงข้อมูลดิบ (จาก OPFS / localStorage / ไฟล์แบ็กอัป) ให้เป็น StockDB เวอร์ชันปัจจุบัน
 * รัน migration เฉพาะ step ที่ยังไม่เคยรัน แล้วปิดท้ายด้วย normalize เสมอ
 */
export function migrateDB(raw: unknown): StockDB {
  const input = (raw ?? {}) as RawDB;
  const from = detectSchemaVersion(input);

  if (from > CURRENT_SCHEMA_VERSION) {
    console.warn(
      `[db] ข้อมูลเป็น schema v${from} ซึ่งใหม่กว่าที่แอปรองรับ (v${CURRENT_SCHEMA_VERSION}) — ใช้ตามที่เป็นอยู่ อาจมีบางฟิลด์ที่แอปยังไม่รู้จัก`
    );
  }

  const migrated = MIGRATIONS.filter((m) => m.to > from).reduce((db, m) => m.up(db), input);
  return normalizeDB(migrated, from);
}
