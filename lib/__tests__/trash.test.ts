import { describe, expect, it } from "vitest";
import { TRASH_MAX, pushToTrash, sortTrash, takeFromTrash } from "@/lib/trash";
import type { StockItem } from "@/lib/types";

const item = (over: Partial<StockItem> = {}): StockItem => ({
  id: "i", name: "x", cats: [], qty: 1, min: 0, note: "", ...over,
});

describe("pushToTrash", () => {
  it("ติดวันเวลาที่ลบให้ทุกชิ้น", () => {
    expect(pushToTrash([], [item({ id: "a" })], "T")).toEqual([{ ...item({ id: "a" }), deletedAt: "T" }]);
  });

  it("ของเดิมในถังยังอยู่ ตัวใหม่ต่อท้าย", () => {
    const out = pushToTrash([item({ id: "old", deletedAt: "T0" })], [item({ id: "new" })], "T1");
    expect(out.map((i) => i.id)).toEqual(["old", "new"]);
  });

  it("เกินโควตาแล้วตัวที่ลบนานสุดหลุดออกถาวร", () => {
    const full = Array.from({ length: TRASH_MAX }, (_, i) => item({ id: `old${i}` }));
    const out = pushToTrash(full, [item({ id: "new" })], "T");
    expect(out).toHaveLength(TRASH_MAX);
    expect(out[0].id).toBe("old1"); // old0 หลุดไป
    expect(out[TRASH_MAX - 1].id).toBe("new");
  });

  it("ไม่แก้อาร์เรย์เดิม", () => {
    const before: StockItem[] = [];
    pushToTrash(before, [item()], "T");
    expect(before).toHaveLength(0);
  });
});

describe("sortTrash", () => {
  it("ลบล่าสุดขึ้นก่อน (ตัวที่เพิ่งลบพลาดคือตัวที่ผู้ใช้มองหา)", () => {
    const list = [
      item({ id: "a", deletedAt: "2026-08-01T00:00:00Z" }),
      item({ id: "b", deletedAt: "2026-09-01T00:00:00Z" }),
    ];
    expect(sortTrash(list).map((i) => i.id)).toEqual(["b", "a"]);
  });
});

describe("takeFromTrash", () => {
  const trash = [item({ id: "a", name: "สบู่", qty: 2, deletedAt: "T" })];

  it("กู้คืนแล้วล้าง deletedAt ทิ้ง และเอาออกจากถัง", () => {
    const out = takeFromTrash(trash, "a", new Set(), () => "z");
    expect(out.item).toEqual(item({ id: "a", name: "สบู่", qty: 2 }));
    expect(out.item?.deletedAt).toBeUndefined();
    expect(out.trash).toHaveLength(0);
  });

  it("id ชนกับของที่มีอยู่ในสต็อก = ออก id ใหม่ให้ (ไม่งั้นสองแถว id เดียวกัน)", () => {
    expect(takeFromTrash(trash, "a", new Set(["a"]), () => "z").item?.id).toBe("z");
  });

  it("กู้ id ที่ไม่มีในถัง = ไม่ทำอะไร", () => {
    const out = takeFromTrash(trash, "ไม่มี", new Set(), () => "z");
    expect(out.item).toBeNull();
    expect(out.trash).toHaveLength(1);
  });

  it("ถังว่าง/undefined", () => {
    expect(takeFromTrash(undefined, "a", new Set(), () => "z").item).toBeNull();
  });
});
