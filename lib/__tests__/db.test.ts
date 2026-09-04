import { describe, expect, it } from "vitest";
import { CURRENT_SCHEMA_VERSION, DEFAULT_DB, detectSchemaVersion, MIGRATIONS, migrateDB } from "@/lib/db";

/**
 * ข้อมูลทรง "v0" = ยุคก่อนมี `schemaVersion` — `migrateDB` จะ replay **ทุก** step กับก้อนนี้
 * ทุกเทสต์ในไฟล์นี้จึงเป็นการพิสูจน์ว่า migration ยังพาข้อมูลเก่าจริงๆ มาถึงปัจจุบันได้
 */
const legacyV0 = {
  items: [
    {
      id: "a",
      name: "สบู่",
      cat: "ของใช้", // ยุคหมวดเดียว (ก่อน v1)
      qty: 2,
      min: 1,
      note: "",
      price: 120,
      purchasedAt: "2026-08-01",
    },
    {
      id: "b",
      name: "ของนำเข้ายุคแรก",
      cat: "Shopee", // ยุคที่เอา Shopee ไปใส่เป็นหมวด (ก่อน v2)
      qty: 1,
      min: 0,
      note: "",
    },
  ],
  categoryPresets: ["ของใช้"],
};

describe("migrateDB — ข้อมูลยุค v0", () => {
  const out = migrateDB(legacyV0);

  it("ยกเวอร์ชันขึ้นเป็นปัจจุบัน", () => {
    expect(detectSchemaVersion(legacyV0)).toBe(0);
    expect(out.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
  });

  it("v1: หมวดเดี่ยว `cat` กลายเป็นอาร์เรย์ `cats`", () => {
    expect(out.items[0].cats).toEqual(["ของใช้"]);
    expect("cat" in out.items[0]).toBe(false);
  });

  it("v2: หมวด 'Shopee' ย้ายไปเป็น source tag แล้วเคลียร์หมวดทิ้ง", () => {
    expect(out.items[1].cats).toEqual([]);
    expect(out.items[1].source).toBe("shopee");
  });

  it("v5: createdAt เดาจาก purchasedAt ของที่ไม่รู้วันปล่อยว่าง", () => {
    expect(out.items[0].createdAt).toBe("2026-08-01");
    expect(out.items[1].createdAt).toBe("");
  });

  it("v6: ตั้งประวัติราคาจากราคาปัจจุบัน 1 จุด ถ้ามีราคา", () => {
    expect(out.items[0].priceHistory).toEqual([{ date: "2026-08-01", price: 120, qty: 1 }]);
    expect(out.items[1].priceHistory).toEqual([]);
  });

  it("v4/v7/v8/v9/v11/v12: เปิดช่องเก็บของใหม่ให้ครบ", () => {
    expect(out.recipes).toEqual([]);
    expect(out.plans).toEqual([]);
    expect(out.orders).toEqual([]);
    expect(out.trash).toEqual([]);
    expect(out.forecastItemIds).toEqual([]);
    expect(out.pricing).toBeDefined();
  });

  it("v10: usageLog เริ่มจากศูนย์ (ย้อนสร้างให้ไม่ได้)", () => {
    expect(out.items[0].usageLog).toEqual([]);
  });
});

describe("migrateDB — ต้องรันซ้ำได้โดยผลไม่เปลี่ยน (idempotent)", () => {
  it("migrate ซ้ำสองรอบได้ผลเท่าเดิม", () => {
    const once = migrateDB(legacyV0);
    const twice = migrateDB(once);
    expect(twice).toEqual(once);
  });

  it("migrate ข้อมูลที่เป็นเวอร์ชันปัจจุบันอยู่แล้ว = ไม่เปลี่ยนอะไร", () => {
    const current = migrateDB(legacyV0);
    expect(migrateDB(current)).toEqual(current);
  });

  it("ทุก step ต้องรันซ้ำกับผลของตัวเองได้โดยไม่พัง", () => {
    // ข้อมูลไม่มี schemaVersion จะ replay ทุก step — step ที่ไม่ idempotent จะทำข้อมูลเพี้ยน
    for (const m of MIGRATIONS) {
      const first = m.up(structuredClone(legacyV0) as Record<string, unknown>);
      const second = m.up(structuredClone(first));
      expect(second, `migration to v${m.to} ไม่ idempotent`).toEqual(first);
    }
  });

  it("DEFAULT_DB ผ่าน migrate แล้วไม่เปลี่ยน", () => {
    expect(migrateDB(DEFAULT_DB)).toEqual(DEFAULT_DB);
  });
});

describe("migrateDB — ข้อมูลพัง/แก้มือมาผิด ต้องไม่ทำให้แอปล่ม", () => {
  it("ก้อนว่าง/null/ของแปลกปลอม", () => {
    expect(migrateDB({}).items).toEqual([]);
    expect(migrateDB(null).items).toEqual([]);
    expect(migrateDB({ items: "ไม่ใช่อาร์เรย์" }).items).toEqual([]);
    expect(migrateDB({ items: [null, undefined] }).items.length).toBe(2);
  });

  it("จุดราคาที่ไม่มีราคาเป็นตัวเลขถูกทิ้ง แล้วเรียงตามวันที่เสมอ", () => {
    const db = migrateDB({
      schemaVersion: CURRENT_SCHEMA_VERSION,
      items: [
        {
          id: "a", name: "x", cats: [], qty: 1, min: 0, note: "",
          priceHistory: [
            { date: "2026-09-01", price: 20, qty: 1 },
            { date: "2026-08-01", price: 10, qty: 2 },
            { date: "2026-07-01", price: "พัง" },
          ],
        },
      ],
    });
    expect(db.items[0].priceHistory).toEqual([
      { date: "2026-08-01", price: 10, qty: 2 },
      { date: "2026-09-01", price: 20, qty: 1 },
    ]);
  });

  it("openPct ที่เกินช่วงถูกหนีบ 0–100", () => {
    const db = migrateDB({
      items: [
        { id: "a", name: "x", cats: [], qty: 1, min: 0, note: "", openPct: 250 },
        { id: "b", name: "y", cats: [], qty: 1, min: 0, note: "", openPct: -10 },
      ],
    });
    expect(db.items[0].openPct).toBe(100);
    expect(db.items[1].openPct).toBe(0);
  });

  it("ชื่อร้านถูกบีบให้เหมือนกันทุกทางเข้า (สินค้า/จุดราคา/ออเดอร์)", () => {
    const db = migrateDB({
      items: [
        {
          id: "a", name: "x", cats: [], qty: 1, min: 0, note: "",
          shop: "  ร้าน   เอ  ",
          priceHistory: [{ date: "2026-08-01", price: 10, qty: 1, shop: "  ร้าน   เอ  " }],
        },
      ],
      orders: [{ id: "o", date: "2026-08-01", shop: " ร้าน  บี ", shipping: 10, discount: 0, note: "" }],
    });
    expect(db.items[0].shop).toBe("ร้าน เอ");
    expect(db.items[0].priceHistory?.[0].shop).toBe("ร้าน เอ");
    expect(db.orders?.[0].shop).toBe("ร้าน บี");
  });

  it("ของใน items ต้องไม่มี deletedAt ติดมา ส่วนของในถังขยะต้องมี", () => {
    const db = migrateDB({
      items: [{ id: "a", name: "x", cats: [], qty: 1, min: 0, note: "", deletedAt: "2026-08-01T00:00:00Z" }],
      trash: [{ id: "b", name: "y", cats: [], qty: 1, min: 0, note: "", deletedAt: "2026-08-01T00:00:00Z" }],
    });
    expect(db.items[0].deletedAt).toBeUndefined();
    expect(db.trash?.[0].deletedAt).toBe("2026-08-01T00:00:00Z");
  });

  it("ส่วนลด/ค่าส่งติดลบถูกหนีบเป็น 0 (ยอดสรุปจะได้ไม่เพี้ยน)", () => {
    const db = migrateDB({
      orders: [{ id: "o", date: "2026-08-01", shipping: -50, discount: -20, note: "" }],
    });
    expect(db.orders?.[0].shipping).toBe(0);
    expect(db.orders?.[0].discount).toBe(0);
  });

  it("หมวดแม่เปล่าๆ ถูกตัดทิ้งถ้ามีซับหมวดของมันอยู่แล้ว", () => {
    const db = migrateDB({
      items: [{ id: "a", name: "x", cats: ["เครื่องใช้", "เครื่องใช้ > ของแต่งห้อง"], qty: 1, min: 0, note: "" }],
    });
    expect(db.items[0].cats).toEqual(["เครื่องใช้ > ของแต่งห้อง"]);
  });

  it("ฟิลด์บังคับที่หายไปถูกเติมให้เป็นค่าว่าง/0 ไม่ใช่ undefined", () => {
    // ไฟล์กู้คืนที่ถูกแก้มือ/มาจากที่อื่นเคยหลุดเข้ามาเป็น undefined ได้ แล้วไปพังไกลจากต้นเหตุ
    // (ตัวเรียงชื่อเรียก `name.localeCompare` → โยนทั้งหน้า / `qty + delta` → NaN ที่ถูกเซฟทับ)
    const db = migrateDB({ items: [{ id: "a" }, {}] });
    expect(db.items[0]).toMatchObject({ id: "a", name: "", qty: 0, min: 0, note: "", cats: [] });
    // ของที่ไม่มีแม้แต่ id ก็ต้องได้ id ติดตัวไป ไม่งั้นแก้/ลบมันไม่ได้เลย
    expect(db.items[1].id).toBeTruthy();
    expect(() => [...db.items].sort((x, y) => x.name.localeCompare(y.name, "th"))).not.toThrow();
  });

  it("qty/min ที่เป็นสตริงหรือติดลบถูกบีบเป็นตัวเลขที่ใช้ได้", () => {
    const db = migrateDB({ items: [{ id: "a", name: "x", qty: "5", min: -3, note: "" }] });
    expect(db.items[0].qty).toBe(5); // "5" → 5 (ไม่งั้น `qty + delta` ได้ "51" ตอนกดปุ่ม +)
    expect(db.items[0].min).toBe(0); // ติดลบไม่มีความหมาย หนีบเป็น 0
  });

  it("forecastItemIds: ตัด id ที่ชี้ไปสินค้าที่ไม่มีอยู่ + dedupe", () => {
    // ไม่งั้นลิสต์บวมขึ้นเรื่อยๆ ทุกครั้งที่ผู้ใช้ลบสินค้า และไฟล์กู้คืน/แก้มืออาจมี id ซ้ำ
    const db = migrateDB({
      items: [{ id: "a", name: "x", cats: [], qty: 1, min: 0, note: "" }],
      forecastItemIds: ["a", "a", "ghost", "b"],
    });
    expect(db.forecastItemIds).toEqual(["a"]);
  });

  it("forecastItemIds: ค่าที่ไม่ใช่อาร์เรย์/ไม่ใช่สตริงถูกทิ้ง (ไฟล์เพี้ยน/แก้มือ)", () => {
    expect(migrateDB({ forecastItemIds: "abc" }).forecastItemIds).toEqual([]);
    expect(migrateDB({ forecastItemIds: [1, null, {}, "x"] }).forecastItemIds).toEqual([]);
  });

  it("ข้อมูลที่ใหม่กว่าที่แอปรู้จักต้องคงเลขเวอร์ชันเดิมไว้ ไม่ถูกลดลง", () => {
    const future = migrateDB({ schemaVersion: CURRENT_SCHEMA_VERSION + 5, items: [] });
    expect(future.schemaVersion).toBe(CURRENT_SCHEMA_VERSION + 5);
  });
});

describe("MIGRATIONS", () => {
  it("เลข `to` ต้องเรียงจากน้อยไปมากทีละ 1 ไม่ข้าม ไม่ซ้ำ", () => {
    expect(MIGRATIONS.map((m) => m.to)).toEqual(MIGRATIONS.map((_, i) => i + 1));
  });

  it("CURRENT_SCHEMA_VERSION = ปลายทางของ step สุดท้าย", () => {
    expect(CURRENT_SCHEMA_VERSION).toBe(MIGRATIONS[MIGRATIONS.length - 1].to);
  });
});
