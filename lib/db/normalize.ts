/**
 * เติมค่าเริ่มต้น/บีบ type ให้ตรง — รันทุกครั้งไม่ว่าข้อมูลจะมาจากเวอร์ชันไหน
 * ของที่เป็นแค่ "เติม default" ให้ใส่ที่นี่ ไม่ต้องเพิ่ม migration step
 */
import type { PlanLine, PlanPriority, PricePoint, PricingSettings, ProductionRun, PurchaseOrder, PurchasePlan, Recipe, RecipeLine, StockItem, UsagePoint } from "@/lib/types";
import { normalizeShopName } from "@/lib/domain/orders";
import { dropRedundantParentCats } from "@/lib/core/cats";
import { DEFAULT_PRICING, ROUNDING_VALUES } from "@/lib/domain/pricing";
import { asArray, type RawDB, type RawItem, type SkinProfile, type StockDB } from "@/lib/db/schema";
import { CURRENT_SCHEMA_VERSION, DEFAULT_DB } from "@/lib/db/migrations";

const num = (v: unknown, fallback = 0) => (typeof v === "number" && Number.isFinite(v) ? v : fallback);
/**
 * เหมือน `num` แต่รับ "สตริงที่เป็นตัวเลข" ด้วย — ใช้เฉพาะ `qty`/`min` ที่เป็นจำนวนของจริง
 * ไฟล์ที่ผู้ใช้แก้มือหรือประกอบขึ้นเองมักได้ `"5"` แทน `5` ทิ้งเป็น 0 = จำนวนของหายไปเงียบๆ
 */
const numLoose = (v: unknown, fallback = 0) => {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v))) return Number(v);
  return fallback;
};
const str = (v: unknown, fallback = "") => (typeof v === "string" ? v : fallback);
const isISODate = (v: unknown) => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);

/** ทิ้งจุดที่ delta ไม่ใช่ตัวเลข/เป็น 0 (ไม่มีความหมาย) แล้วเรียงตามวันที่ */
function normalizeUsageLog(raw: unknown): UsagePoint[] {
  return asArray(raw)
    .map((p) => (p ?? {}) as Partial<UsagePoint>)
    .filter((p): p is UsagePoint => typeof p.delta === "number" && Number.isFinite(p.delta) && p.delta !== 0)
    .map((p) => ({ date: str(p.date), delta: p.delta }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

/** ทิ้งจุดที่ไม่มีราคาเป็นตัวเลข (ข้อมูลพัง/แก้มือมาผิด) แล้วเรียงตามวันที่ให้เสมอ */
function normalizePriceHistory(raw: unknown): PricePoint[] {
  return asArray(raw)
    .map((p) => (p ?? {}) as Partial<PricePoint>)
    .filter((p): p is PricePoint => typeof p.price === "number" && Number.isFinite(p.price))
    .map((p) => ({
      date: str(p.date),
      price: p.price,
      qty: num(p.qty, 1) > 0 ? num(p.qty, 1) : 1,
      // เก็บเฉพาะตอนมีค่าจริง — ของเก่าทุกจุดจะได้ไม่พก `shop: ""` ติดไป Drive/แบ็กอัปเปล่าๆ
      ...(normalizeShopName(p.shop) ? { shop: normalizeShopName(p.shop) } : {}),
      ...(str(p.orderId) ? { orderId: str(p.orderId) } : {}),
    }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

function normalizeItem(raw: unknown, idx = 0): StockItem {
  const i = (raw ?? {}) as RawItem & Partial<StockItem>;
  const cats = asArray(i.cats).filter((c): c is string => typeof c === "string" && c !== "");
  return {
    ...(i as StockItem),
    // ฟิลด์บังคับ 5 ตัวนี้เคยถูกปล่อยผ่านมาดิบๆ จาก spread ข้างบน — ไฟล์กู้คืนที่รูปร่างไม่ตรง
    // (แก้มือ/มาจากแอปอื่น) จึงเข้ามาเป็น `undefined` ได้ แล้วไปพังทีหลังแบบไกลจากต้นเหตุ:
    // ตัวเรียง "ชื่อ" เรียก `a.name.localeCompare` แล้วโยนทั้งหน้า ส่วน `qty + delta` ได้ NaN
    // ที่ถูกเซฟทับลงไฟล์จริง — บีบ type ตั้งแต่ประตูเข้าเลยปลอดภัยกว่า
    id: str(i.id) || `item-${idx}`,
    name: str(i.name),
    qty: Math.max(0, numLoose(i.qty)),
    min: Math.max(0, numLoose(i.min)),
    note: str(i.note),
    cats: dropRedundantParentCats(cats),
    ingredients: str(i.ingredients),
    createdAt: str(i.createdAt),
    priceHistory: normalizePriceHistory(i.priceHistory),
    // เก็บเฉพาะตอนเป็น true จริงๆ — ไม่งั้นทุกรายการจะพก `priceUnverified: false` ติดไป Drive/แบ็กอัปเปล่าๆ
    priceUnverified: i.priceUnverified === true ? true : undefined,
    fav: i.fav === true ? true : undefined,
    shop: normalizeShopName(i.shop) || undefined,
    // วันที่ที่อ่านไม่ออกทิ้งไปเลย ดีกว่าปล่อยให้ไปโผล่เป็น "หมดอายุแล้ว" มั่วๆ (ดู lib/domain/expiry.ts)
    expiryAt: isISODate(i.expiryAt) ? (i.expiryAt as string) : undefined,
    openedAt: isISODate(i.openedAt) ? (i.openedAt as string) : undefined,
    paoMonths: num(i.paoMonths) > 0 ? Math.round(num(i.paoMonths)) : undefined,
    usageLog: normalizeUsageLog(i.usageLog),
    unit: str(i.unit) || undefined,
    packAmount: num(i.packAmount) > 0 ? num(i.packAmount) : undefined,
    location: str(i.location) || undefined,
    // เกิน 100% หรือติดลบแปลว่ากรอกมั่ว/ไฟล์เพี้ยน — หนีบไว้ ไม่งั้นมูลค่าสต็อกเพี้ยนตาม
    openPct: i.openPct != null && Number.isFinite(num(i.openPct)) ? Math.min(100, Math.max(0, num(i.openPct))) : undefined,
    reorderQty: num(i.reorderQty) > 0 ? Math.round(num(i.reorderQty)) : undefined,
    // ของใน `items` ต้องไม่มี deletedAt ติดมา (ของที่ลบอยู่ใน `trash`) — ล้างทิ้งเสมอ
    deletedAt: undefined,
  };
}

/** ของในถังขยะคือ StockItem ปกติที่ต้องมี `deletedAt` — ตัวที่ไม่มีถือว่าลบตอนไหนไม่รู้ */
function normalizeTrashItem(raw: unknown, idx = 0): StockItem {
  const item = normalizeItem(raw, idx);
  const deletedAt = (raw ?? {}) as { deletedAt?: unknown };
  return { ...item, deletedAt: str(deletedAt.deletedAt) || "" };
}

function normalizeOrder(raw: unknown, idx: number): PurchaseOrder {
  const o = (raw ?? {}) as Partial<PurchaseOrder>;
  return {
    id: o.id || `order-${idx}`,
    date: isISODate(o.date) ? o.date! : "",
    shop: normalizeShopName(o.shop) || undefined,
    // ส่วนลดเก็บเป็นเลขบวกเสมอ (ดู PurchaseOrder) — ที่ติดลบมาถือว่ากรอกเครื่องหมายเกิน
    shipping: Math.max(0, num(o.shipping)),
    discount: Math.max(0, num(o.discount)),
    note: str(o.note),
    createdAt: str(o.createdAt) || undefined,
    updatedAt: str(o.updatedAt) || undefined,
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
    runs: asArray(r.runs).map((run, ri): ProductionRun => {
      const v = (run ?? {}) as Partial<ProductionRun>;
      return {
        id: v.id || `run-${idx}-${ri}`,
        date: str(v.date),
        // ทำ 0 รอบไม่มีความหมาย ถือว่ากรอกพลาดแล้วนับเป็น 1
        batches: num(v.batches, 1) > 0 ? num(v.batches, 1) : 1,
        note: str(v.note),
      };
    }),
    updatedAt: r.updatedAt,
  };
}

const PLAN_PRIORITIES: PlanPriority[] = ["must", "normal", "maybe"];

function normalizePlan(raw: unknown, idx: number): PurchasePlan {
  const p = (raw ?? {}) as Partial<PurchasePlan>;
  return {
    id: p.id || `plan-${idx}`,
    name: str(p.name),
    note: str(p.note),
    dueDate: str(p.dueDate) || undefined,
    budget: typeof p.budget === "number" && Number.isFinite(p.budget) ? p.budget : undefined,
    lines: asArray(p.lines).map((l, li): PlanLine => {
      const line = (l ?? {}) as Partial<PlanLine>;
      return {
        id: line.id || `pline-${idx}-${li}`,
        itemId: line.itemId,
        name: str(line.name),
        qty: num(line.qty, 1) > 0 ? num(line.qty, 1) : 1,
        price: num(line.price),
        note: str(line.note),
        bought: line.bought === true,
        boughtAt: str(line.boughtAt) || undefined,
        paidPrice: typeof line.paidPrice === "number" && Number.isFinite(line.paidPrice) ? line.paidPrice : undefined,
        priority: PLAN_PRIORITIES.includes(line.priority!) ? line.priority : undefined,
      };
    }),
    createdAt: str(p.createdAt) || undefined,
    updatedAt: p.updatedAt,
  };
}

/** ค่าตั้งราคาที่เพี้ยน (แก้ไฟล์มือ/ข้อมูลเก่า) ต้องไม่ทำให้สูตรคิดราคาระเบิด — บีบให้อยู่ในช่วงที่คิดได้เสมอ */
function normalizePricing(raw: unknown): PricingSettings {
  const p = (raw ?? {}) as Partial<PricingSettings>;
  const clampPct = (v: unknown, fallback: number) => Math.min(99, Math.max(0, num(v, fallback)));
  return {
    targetMarginPct: clampPct(p.targetMarginPct, DEFAULT_PRICING.targetMarginPct),
    feePct: clampPct(p.feePct, DEFAULT_PRICING.feePct),
    feePerUnit: Math.max(0, num(p.feePerUnit, DEFAULT_PRICING.feePerUnit)),
    rounding: ROUNDING_VALUES.includes(p.rounding!) ? p.rounding! : DEFAULT_PRICING.rounding,
  };
}

export function normalizeDB(db: RawDB, version: number): StockDB {
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
    plans: asArray(db.plans).map(normalizePlan),
    pricing: normalizePricing(db.pricing),
    orders: asArray(db.orders).map(normalizeOrder),
    trash: asArray(db.trash).map(normalizeTrashItem),
    updatedAt: typeof db.updatedAt === "string" ? db.updatedAt : undefined,
  };
}
