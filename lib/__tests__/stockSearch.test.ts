import { describe, expect, it } from "vitest";
import { PICKER_MAX_RESULTS, searchStockItems } from "@/lib/domain/stockSearch";
import type { StockItem } from "@/lib/types";

const item = (over: Partial<StockItem> = {}): StockItem => ({
  id: over.name ?? "i", name: "x", cats: [], qty: 1, min: 0, note: "", ...over,
});

describe("searchStockItems", () => {
  it("คำค้นว่าง = คืนทั้งหมด", () => {
    const items = [item({ name: "ข" }), item({ name: "ก" })];
    expect(searchStockItems(items, "   ").map((i) => i.name)).toEqual(["ก", "ข"]);
  });

  it("ค้นได้ทั้งชื่อ หมวดหมู่ และรุ่นย่อย โดยไม่สนตัวพิมพ์ใหญ่เล็ก", () => {
    const items = [
      item({ name: "Glycerin" }),
      item({ name: "กล่อง", cats: ["Packaging"] }),
      item({ name: "ขวด", variant: "Amber 30ml" }),
      item({ name: "ไม่เกี่ยว" }),
    ];
    expect(searchStockItems(items, "glyc").map((i) => i.name)).toEqual(["Glycerin"]);
    expect(searchStockItems(items, "packag").map((i) => i.name)).toEqual(["กล่อง"]);
    expect(searchStockItems(items, "AMBER").map((i) => i.name)).toEqual(["ขวด"]);
  });

  it("เรียงตามชื่อแบบภาษาไทย ไม่ใช่ลำดับใน db.items", () => {
    const items = [item({ name: "แอลกอฮอล์" }), item({ name: "กลีเซอรีน" }), item({ name: "ขี้ผึ้ง" })];
    expect(searchStockItems(items, "").map((i) => i.name)).toEqual(["กลีเซอรีน", "ขี้ผึ้ง", "แอลกอฮอล์"]);
  });

  it("ไม่แก้ไขอาร์เรย์ที่รับเข้ามา (db.items ต้องไม่ถูกเรียงใหม่คาที่)", () => {
    const items = [item({ name: "ข" }), item({ name: "ก" })];
    searchStockItems(items, "");
    expect(items.map((i) => i.name)).toEqual(["ข", "ก"]);
  });

  it("ตัดตามเพดานจำนวนแถว", () => {
    const items = Array.from({ length: 120 }, (_, n) => item({ name: `x${String(n).padStart(3, "0")}` }));
    expect(searchStockItems(items, "").length).toBe(PICKER_MAX_RESULTS);
    expect(searchStockItems(items, "", 5).map((i) => i.name)).toEqual(["x000", "x001", "x002", "x003", "x004"]);
  });
});
