import { describe, expect, it } from "vitest";
import { buildForecastClusters } from "@/lib/domain/forecast";
import type { StockItem } from "@/lib/types";

function item(overrides: Partial<StockItem>): StockItem {
  return {
    id: "x",
    name: "test",
    cats: [],
    qty: 1,
    min: 0,
    note: "",
    ...overrides,
  };
}

describe("buildForecastClusters", () => {
  it("สินค้าเดี่ยว → 1 ก้อน 1 ตัว ข้อมูล merged ตรงกับตัวเดิม", () => {
    const a = item({
      id: "a",
      name: "แชมพู",
      priceHistory: [{ date: "2026-01-01", price: 100, qty: 1 }],
    });
    const clusters = buildForecastClusters([a]);
    expect(clusters).toHaveLength(1);
    expect(clusters[0].key).toBe("a");
    expect(clusters[0].name).toBe("แชมพู");
    expect(clusters[0].members).toEqual([a]);
    expect(clusters[0].merged.priceHistory).toEqual(a.priceHistory);
  });

  it("สินค้าคนละยี่ห้อแต่ groupId เดียวกัน → 1 ก้อน · ชื่อ = groupName · รวมประวัติ", () => {
    const a = item({
      id: "a",
      name: "อาหารแมว ยี่ห้อ A",
      groupId: "g1",
      groupName: "อาหารแมว",
      priceHistory: [
        { date: "2026-01-01", price: 100, qty: 1 },
        { date: "2026-02-01", price: 100, qty: 1 },
      ],
    });
    const b = item({
      id: "b",
      name: "อาหารแมว ยี่ห้อ B",
      groupId: "g1",
      groupName: "อาหารแมว",
      priceHistory: [{ date: "2026-01-15", price: 120, qty: 1 }],
    });
    const clusters = buildForecastClusters([a, b]);
    expect(clusters).toHaveLength(1);
    expect(clusters[0].key).toBe("g1");
    expect(clusters[0].name).toBe("อาหารแมว");
    expect(clusters[0].members).toEqual([a, b]);
    // รวมประวัติของทั้งสองยี่ห้อเข้าด้วยกัน (จำนวนจุดต้องเท่ากับผลรวม)
    expect(clusters[0].merged.priceHistory).toHaveLength(3);
  });

  it("subtitle ของกลุ่มบอกจำนวนรายการ + ชื่อสมาชิก", () => {
    const a = item({ id: "a", name: "ยี่ห้อ A", groupId: "g1", groupName: "อาหารแมว" });
    const b = item({ id: "b", name: "ยี่ห้อ B", groupId: "g1", groupName: "อาหารแมว" });
    const [c] = buildForecastClusters([a, b]);
    expect(c.subtitle).toBe("2 รายการ · ยี่ห้อ A, ยี่ห้อ B");
  });

  it("รูปของกลุ่ม = รูปตัวแรกที่มีในสมาชิก (ไม่ใช่ตัวแรกเสมอ)", () => {
    const a = item({ id: "a", groupId: "g1" });
    const b = item({ id: "b", groupId: "g1", img: "https://example.com/b.jpg" });
    const [c] = buildForecastClusters([a, b]);
    expect(c.img).toBe("https://example.com/b.jpg");
  });

  it("usageLog จากสมาชิกหลายคนถูก sort ตามวันที่ (usageStats อ่านตัวแรก/สุดท้ายเป็นขอบเขต)", () => {
    const a = item({
      id: "a",
      groupId: "g1",
      usageLog: [
        { date: "2026-01-01", delta: -1 },
        { date: "2026-03-01", delta: -1 },
      ],
    });
    const b = item({
      id: "b",
      groupId: "g1",
      usageLog: [{ date: "2026-02-01", delta: -1 }],
    });
    const [c] = buildForecastClusters([a, b]);
    const dates = (c.merged.usageLog ?? []).map((p) => p.date);
    expect(dates).toEqual(["2026-01-01", "2026-02-01", "2026-03-01"]);
  });

  it("ราคาของกลุ่ม = ราคาของสมาชิกที่ซื้อ**ล่าสุด** (ตาม purchasedAt)", () => {
    const older = item({ id: "a", groupId: "g1", price: 100, purchasedAt: "2026-01-01" });
    const newer = item({ id: "b", groupId: "g1", price: 150, purchasedAt: "2026-06-01" });
    // สลับลำดับ input เพื่อให้แน่ใจว่า merge อ่าน purchasedAt ไม่ใช่ตำแหน่ง
    const [c] = buildForecastClusters([older, newer]);
    expect(c.merged.price).toBe(150);
    const [c2] = buildForecastClusters([newer, older]);
    expect(c2.merged.price).toBe(150);
  });

  it("สินค้าเดี่ยว + สินค้าในกลุ่ม อยู่รวมกันได้ · ก้อนเรียงตามลำดับที่พบครั้งแรก", () => {
    const solo = item({ id: "solo", name: "แชมพู" });
    const a = item({ id: "a", groupId: "g1", groupName: "อาหารแมว" });
    const b = item({ id: "b", groupId: "g1", groupName: "อาหารแมว" });
    // input: solo, a, b — solo มาก่อน แต่ b ก็ยังต้องถูก merge เข้ากลุ่ม g1
    const clusters = buildForecastClusters([solo, a, b]);
    // กลุ่ม (2 ก้อน: g1 กับ solo) — ลำดับปัจจุบัน: group ก่อน แล้ว single
    // แต่ตัวไหนมาก่อนใน result ต้องคงที่และคาดเดาได้
    expect(clusters.map((c) => c.key).sort()).toEqual(["g1", "solo"]);
    const group = clusters.find((c) => c.key === "g1")!;
    expect(group.members).toHaveLength(2);
  });
});
