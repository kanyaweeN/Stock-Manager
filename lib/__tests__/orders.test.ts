import { describe, expect, it } from "vitest";
import {
  extrasInRange,
  findDuplicateOrder,
  normalizeShopName,
  orderExtras,
  orderNet,
  shopKey,
  sortOrders,
  totalExtras,
} from "@/lib/domain/orders";
import type { PurchaseOrder } from "@/lib/types";

const order = (over: Partial<PurchaseOrder> = {}): PurchaseOrder => ({
  id: "o", date: "2026-08-01", shipping: 0, discount: 0, note: "", ...over,
});

describe("normalizeShopName / shopKey", () => {
  it("ชื่อที่โชว์: ตัดหัวท้าย บีบช่องว่างซ้อน แต่คงช่องว่างเดี่ยวไว้", () => {
    expect(normalizeShopName("  ร้าน   เอ  ")).toBe("ร้าน เอ");
    expect(normalizeShopName(undefined)).toBe("");
  });

  it("คีย์จัดกลุ่ม: ตัดช่องว่างทั้งหมด เพราะภาษาไทยไม่เว้นวรรคระหว่างคำ", () => {
    expect(shopKey("ร้านเอ")).toBe(shopKey("ร้าน เอ"));
    expect(shopKey("  ร้าน   เอ  ")).toBe(shopKey("ร้านเอ"));
    expect(shopKey("Shop A")).toBe(shopKey("shop  a"));
  });

  it("คนละร้านต้องไม่ถูกรวมเข้าด้วยกัน", () => {
    expect(shopKey("ร้านเอ")).not.toBe(shopKey("ร้านบี"));
  });
});

describe("orderNet / sortOrders", () => {
  it("ค่าส่ง − ส่วนลด (ติดลบได้ = ประหยัดได้)", () => {
    expect(orderNet(order({ shipping: 60, discount: 20 }))).toBe(40);
    expect(orderNet(order({ shipping: 0, discount: 30 }))).toBe(-30);
  });

  it("เรียงใหม่→เก่า ตัวที่ไม่ทราบวันที่ไปท้ายสุด", () => {
    const list = [order({ id: "a", date: "2026-01-01" }), order({ id: "b", date: "" }), order({ id: "c", date: "2026-09-01" })];
    expect(sortOrders(list).map((o) => o.id)).toEqual(["c", "a", "b"]);
  });

  it("ไม่แก้อาร์เรย์เดิม", () => {
    const list = [order({ id: "a", date: "2026-01-01" }), order({ id: "c", date: "2026-09-01" })];
    sortOrders(list);
    expect(list.map((o) => o.id)).toEqual(["a", "c"]);
  });
});

describe("findDuplicateOrder", () => {
  const existing = [order({ id: "o1", date: "2026-08-21", shop: "ร้านบี", shipping: 60, discount: 20 })];

  it("เจอซ้ำแม้ชื่อร้านพิมพ์คนละแบบ", () => {
    expect(findDuplicateOrder(existing, { date: "2026-08-21", shop: " ร้าน บี ", shipping: 60, discount: 20 })?.id).toBe("o1");
  });

  it("ยอดต่างกัน = คนละออเดอร์", () => {
    expect(findDuplicateOrder(existing, { date: "2026-08-21", shop: "ร้านบี", shipping: 50, discount: 20 })).toBeUndefined();
  });

  it("ไม่ทราบวันที่ = เทียบไม่ได้ ไม่เตือน", () => {
    expect(findDuplicateOrder(existing, { date: undefined, shop: "ร้านบี", shipping: 60, discount: 20 })).toBeUndefined();
  });
});

describe("orderExtras / extrasInRange / totalExtras", () => {
  const orders = [
    order({ id: "a", date: "2026-08-01", shipping: 60, discount: 20 }),
    order({ id: "b", date: "2026-09-01", shipping: 0, discount: 50 }),
    order({ id: "c", date: "2026-09-15", shipping: 0, discount: 0 }), // ไม่มีผลกับยอด
    order({ id: "d", date: "", shipping: 30, discount: 0 }),
  ];

  it("ออเดอร์ที่ไม่มีทั้งค่าส่งและส่วนลดถูกตัดทิ้ง", () => {
    expect(orderExtras(orders).map((x) => x.orderId)).toEqual(["a", "b", "d"]);
    expect(orderExtras(undefined)).toEqual([]);
  });

  it("net = ค่าส่ง − ส่วนลด และรวมยอดได้", () => {
    expect(totalExtras(orderExtras(orders))).toBe(40 - 50 + 30);
  });

  it("ตัวกรองช่วงวันไม่เอาตัวที่ไม่ทราบวันที่ (เหมือนจุดราคา)", () => {
    const inRange = extrasInRange(orderExtras(orders), "2026-08-01", "2026-08-31");
    expect(inRange.map((x) => x.orderId)).toEqual(["a"]);
  });
});
