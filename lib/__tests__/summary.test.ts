import { describe, expect, it } from "vitest";
import {
  UNCATEGORIZED,
  UNKNOWN_SHOP,
  byCategory,
  byMonth,
  byShop,
  eventsInRange,
  spendEvents,
  spendOverview,
  totalSpend,
  widestShopGap,
} from "@/lib/domain/summary";
import { orderExtras } from "@/lib/domain/orders";
import type { PurchaseOrder, StockItem } from "@/lib/types";

const NOW = new Date(2026, 7, 29); // ส.ค. 2026

const item = (over: Partial<StockItem> = {}): StockItem => ({
  id: "i", name: "x", cats: [], qty: 1, min: 0, note: "", ...over,
});

describe("spendEvents — ทุกยอดคิดจาก 'ครั้งที่ซื้อ' ไม่ใช่ของที่เหลือ", () => {
  it("แตกทุกจุดในประวัติราคาออกเป็นครั้งๆ", () => {
    const events = spendEvents([
      item({
        id: "a", name: "สบู่", cats: ["ของใช้"], qty: 0, // ใช้หมดแล้ว แต่ยังต้องนับเป็นยอดของเดือนที่ซื้อ
        priceHistory: [
          { date: "2026-07-01", price: 100, qty: 2 },
          { date: "2026-08-01", price: 120, qty: 1 },
        ],
      }),
    ]);
    expect(events.map((e) => e.spend)).toEqual([200, 120]);
    expect(totalSpend(events)).toBe(320);
  });

  it("ของที่ยังไม่มีประวัติราคาแต่กรอกราคาไว้ นับเป็นการซื้อ 1 ครั้งตาม buyQty", () => {
    const events = spendEvents([item({ price: 50, buyQty: 3, purchasedAt: "2026-08-01" })]);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ qty: 3, spend: 150 });
  });

  it("ของไม่มีหมวดไปกองที่ UNCATEGORIZED", () => {
    const rows = byCategory(spendEvents([item({ price: 10, purchasedAt: "2026-08-01" })]));
    expect(rows[0].label).toBe(UNCATEGORIZED);
  });

  it("จุดที่ไม่รู้ร้าน ตกกลับมาใช้ร้านล่าสุดของสินค้า", () => {
    const events = spendEvents([
      item({ shop: "ร้านเอ", priceHistory: [{ date: "2026-08-01", price: 10, qty: 1 }] }),
    ]);
    expect(events[0].shop).toBe("ร้านเอ");
  });
});

describe("eventsInRange", () => {
  it("ครั้งที่ไม่ทราบวันที่ไม่เข้าช่วงวันใดๆ", () => {
    const events = spendEvents([
      item({ priceHistory: [{ date: "", price: 10, qty: 1 }, { date: "2026-08-15", price: 20, qty: 1 }] }),
    ]);
    expect(eventsInRange(events, "2026-08-01", "2026-08-31")).toHaveLength(1);
  });
});

describe("byShop", () => {
  it("ร้านเดียวกันที่พิมพ์คนละแบบต้องรวมเป็นแถวเดียว", () => {
    const events = spendEvents([
      item({
        priceHistory: [
          { date: "2026-08-01", price: 120, qty: 1, shop: "ร้านเอ" },
          { date: "2026-08-21", price: 150, qty: 1, shop: " ร้าน  เอ " },
        ],
      }),
    ]);
    const rows = byShop(events);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ times: 2, spend: 270 });
  });

  it("ของที่ไม่รู้ร้านกองรวมกันแถวเดียว", () => {
    const rows = byShop(spendEvents([item({ priceHistory: [{ date: "2026-08-01", price: 10, qty: 1 }] })]));
    expect(rows[0].label).toBe(UNKNOWN_SHOP);
  });
});

describe("widestShopGap", () => {
  it("เทียบราคาเฉลี่ยถ่วงน้ำหนักต่อร้าน ไม่ใช่ราคาครั้งเดียว", () => {
    const gap = widestShopGap([
      item({
        name: "สบู่",
        priceHistory: [
          { date: "2026-08-01", price: 100, qty: 3, shop: "ร้านถูก" },
          { date: "2026-08-02", price: 160, qty: 1, shop: "ร้านถูก" }, // เฉลี่ยถ่วงน้ำหนัก = 115
          { date: "2026-08-03", price: 150, qty: 1, shop: "ร้านแพง" },
        ],
      }),
    ]);
    expect(gap).toMatchObject({ name: "สบู่", cheapShop: "ร้านถูก", cheapPrice: 115, pricyShop: "ร้านแพง", gap: 35 });
  });

  it("ร้านเดียวกันที่พิมพ์คนละแบบต้องไม่ถูกเอามาเทียบกับตัวเอง", () => {
    expect(
      widestShopGap([
        item({
          priceHistory: [
            { date: "2026-08-01", price: 120, qty: 1, shop: "ร้านเอ" },
            { date: "2026-08-21", price: 150, qty: 1, shop: "ร้าน เอ" },
          ],
        }),
      ])
    ).toBeNull();
  });

  it("ซื้อร้านเดียว = เทียบไม่ได้", () => {
    expect(widestShopGap([item({ priceHistory: [{ date: "2026-08-01", price: 10, qty: 1, shop: "ร้านเอ" }] })])).toBeNull();
  });
});

describe("ค่าส่ง/ส่วนลดของออเดอร์", () => {
  const items = [item({ id: "a", cats: ["ของใช้"], qty: 2, price: 100, priceHistory: [{ date: "2026-08-05", price: 100, qty: 2 }] })];
  const orders: PurchaseOrder[] = [
    { id: "o1", date: "2026-08-05", shipping: 60, discount: 20, note: "" },
  ];

  it("เข้ายอดรวม/รายเดือน แต่ไม่เพิ่มจำนวน 'ครั้งที่ซื้อ'", () => {
    const events = spendEvents(items);
    const extras = orderExtras(orders);
    const overview = spendOverview(events, items, extras, NOW);
    expect(overview.total).toBe(240); // 200 + 60 − 20
    expect(overview.thisMonth).toBe(240);
    expect(overview.times).toBe(1); // ค่าส่งไม่ใช่ "ครั้งที่ซื้อของ"
    expect(overview.shippingTotal).toBe(60);
    expect(overview.discountTotal).toBe(20);

    const months = byMonth(events, extras);
    expect(months[0]).toMatchObject({ spend: 240, times: 1, qty: 2 });
  });

  it("ไม่ส่ง extras มา = ยอดเป็นค่าสินค้าล้วนๆ เหมือนเดิม", () => {
    const overview = spendOverview(spendEvents(items), items, [], NOW);
    expect(overview.total).toBe(200);
    expect(overview.extrasTotal).toBe(0);
  });

  it("เดือนที่มีแต่ค่าส่ง ไม่มีการซื้อ ก็ยังขึ้นเป็นแถว", () => {
    const months = byMonth([], orderExtras([{ id: "o", date: "2026-09-01", shipping: 40, discount: 0, note: "" }]));
    expect(months).toHaveLength(1);
    expect(months[0]).toMatchObject({ spend: 40, times: 0, qty: 0 });
  });
});

describe("spendOverview — มูลค่าของที่เหลือ", () => {
  it("นับเศษของขวดที่เปิดอยู่ ไม่ตีราคาขวดที่ใช้ไปครึ่งเท่าขวดใหม่", () => {
    const items = [item({ qty: 3, openPct: 50, price: 120 })];
    expect(spendOverview([], items, [], NOW).stockValue).toBe(300); // 2.5 × 120
  });

  it("เฉลี่ยต่อเดือนไม่เอาเดือนนี้มาคิด (เดือนยังไม่จบ)", () => {
    const items = [
      item({ id: "a", priceHistory: [{ date: "2026-06-01", price: 100, qty: 1 }] }),
      item({ id: "b", priceHistory: [{ date: "2026-07-01", price: 300, qty: 1 }] }),
      item({ id: "c", priceHistory: [{ date: "2026-08-01", price: 999, qty: 1 }] }),
    ];
    const overview = spendOverview(spendEvents(items), items, [], NOW);
    expect(overview.avgPerMonth).toBe(200); // (100 + 300) / 2
    expect(overview.monthsCounted).toBe(2);
  });
});
