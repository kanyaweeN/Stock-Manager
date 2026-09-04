/**
 * ประวัติการเปลี่ยน schema — แปลงข้อมูลเก่าทีละเวอร์ชัน
 * ทำงานบน `RawDB` (ข้อมูลดิบ) ล้วนๆ ไม่แตะ type ปลายทาง เพื่อให้ step เก่ายังรันได้แม้ `StockDB` เปลี่ยนไปแล้ว
 */
import { DEFAULT_PRICING } from "@/lib/domain/pricing";
import { asArray, type RawDB, type RawItem, type StockDB } from "@/lib/db/schema";

interface Migration {
  /** เลขเวอร์ชันที่ข้อมูลจะกลายเป็น หลังรัน step นี้ */
  to: number;
  /** สรุปสั้นๆ ว่าเปลี่ยนอะไร — ใช้อ่านประวัติ schema ย้อนหลัง */
  note: string;
  up(db: RawDB): RawDB;
}

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
  {
    to: 6,
    note: "เพิ่ม item.priceHistory (ประวัติราคาแต่ละครั้งที่ซื้อ) — ตั้งต้นด้วยราคาปัจจุบัน 1 จุด ถ้ามีราคาอยู่แล้ว",
    up: (db) =>
      mapItems(db, (i) => {
        if (Array.isArray(i.priceHistory)) return i;
        const price = typeof i.price === "number" && Number.isFinite(i.price) ? i.price : null;
        if (price == null) return { ...i, priceHistory: [] };
        const qty = typeof i.buyQty === "number" && i.buyQty > 0 ? i.buyQty : 1;
        // ของที่นำเข้าก่อนเวอร์ชันนี้อาจเก็บ price เป็น "ยอดรวมทั้งแถว" (ดู lib/import/shopee.ts)
        // ย้อนกลับไปหารให้ไม่ได้ เพราะ item.qty ถูกเพิ่ม/ลดหลังจากนั้นไปแล้ว — ติดธงไว้ให้ UI เตือนแทน
        // (ตัวที่ buyQty มีค่าอยู่แล้ว = นำเข้าด้วยโค้ดใหม่ ราคาต่อชิ้นถูกอยู่แล้ว ไม่ต้องเตือน)
        const unverified = i.source === "shopee" && typeof i.buyQty !== "number";
        return {
          ...i,
          priceHistory: [{ date: typeof i.purchasedAt === "string" ? i.purchasedAt : "", price, qty }],
          ...(unverified ? { priceUnverified: true } : {}),
        };
      }),
  },
  {
    to: 7,
    note: "เพิ่มฟีเจอร์วางแผนการซื้อ — เติม db.plans",
    up: (db) => ({ ...db, plans: asArray(db.plans) }),
  },
  {
    to: 8,
    note: "เพิ่มฟีเจอร์คิดราคาขาย — เติม db.pricing (กำไรที่อยากได้ / ค่าธรรมเนียม / วิธีปัดราคา)",
    up: (db) => ({ ...db, pricing: db.pricing ?? { ...DEFAULT_PRICING } }),
  },
  {
    to: 9,
    note: "เพิ่มร้านค้า (item.shop / priceHistory[].shop), วันหมดอายุ (expiryAt/openedAt/paoMonths) และ db.orders (ค่าส่ง/ส่วนลดต่อออเดอร์)",
    // ฟิลด์ใหม่ทั้งหมดเป็น optional และย้อนเดาจากข้อมูลเก่าไม่ได้ (Shopee ยุคก่อนหน้านี้ไม่ได้เก็บชื่อร้าน
    // และวันหมดอายุไม่เคยมีที่ให้กรอก) — step นี้จึงมีหน้าที่แค่เปิดช่อง db.orders ให้มีอยู่จริง
    up: (db) => ({ ...db, orders: asArray(db.orders) }),
  },
  {
    to: 10,
    note: "เพิ่ม item.usageLog (ประวัติการใช้ ไว้ทำนายว่าจะหมดเมื่อไร) + unit/packAmount/location",
    // ย้อนสร้าง usageLog ให้ของเก่าไม่ได้ (ไม่เคยมีใครจดว่าจำนวนเปลี่ยนวันไหน) เริ่มนับจากศูนย์
    // ส่วน unit/packAmount ปล่อยว่างไว้ตั้งใจ — /cost จะไปเดาจาก `size` ต่อเหมือนเดิมจนกว่าจะกรอกเอง
    up: (db) => mapItems(db, (i) => (Array.isArray(i.usageLog) ? i : { ...i, usageLog: [] })),
  },
  {
    to: 11,
    note: "เพิ่มถังขยะ (db.trash) + เศษของที่เปิดใช้ (item.openPct) + จำนวนที่ซื้อประจำ (item.reorderQty) + ความสำคัญของบรรทัดในแผน + ประวัติการผลิตของสูตร",
    // ทุกอย่างเป็น optional ที่ย้อนเดาจากข้อมูลเก่าไม่ได้ — step นี้แค่เปิดช่อง db.trash ให้มีอยู่จริง
    // (ของที่เคยถูกลบไปก่อนหน้านี้กู้คืนไม่ได้ ไม่เคยมีใครเก็บไว้)
    up: (db) => ({ ...db, trash: asArray(db.trash) }),
  },
  {
    to: 12,
    note: "เพิ่ม db.forecastItemIds (รายการ id ที่ผู้ใช้เลือกให้ติดตามในหน้าคาดคะเนซื้อ)",
    // เปิดช่องให้มีอยู่จริง — ตัวกรอง id ที่ไม่ตรงกับสินค้าจริงอยู่ที่ normalizeDB (รันทุกครั้ง)
    up: (db) => ({ ...db, forecastItemIds: asArray(db.forecastItemIds) }),
  },
];

/** เวอร์ชันล่าสุด = ปลายทางของ migration step สุดท้าย (คำนวณให้ ไม่ต้องแก้มือ) */
export const CURRENT_SCHEMA_VERSION = MIGRATIONS.length ? MIGRATIONS[MIGRATIONS.length - 1].to : 0;

export const DEFAULT_DB: StockDB = {
  schemaVersion: CURRENT_SCHEMA_VERSION,
  items: [],
  categoryPresets: ["เครื่องใช้", "อุปกรณ์ฝีมือ"],
  avoidIngredients: [],
  // ต้องมีให้ครบเหมือนที่ `normalizeDB` เติมให้ ไม่งั้น DEFAULT_DB ไม่ใช่ StockDB ที่ normalize แล้ว
  // (กด "ล้างข้อมูลทั้งหมด" จะได้ก้อนที่ต่างจากก้อนที่ผ่าน migrate มานิดหน่อย)
  skinProfile: { skinType: "", concerns: [] },
  recipes: [],
  plans: [],
  pricing: { ...DEFAULT_PRICING },
  orders: [],
  trash: [],
  forecastItemIds: [],
};
