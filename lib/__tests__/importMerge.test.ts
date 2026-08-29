import { describe, expect, it } from "vitest";
import {
  applyPriceMode,
  computeMergeFields,
  findExisting,
  isBackdated,
  linkToExisting,
  mergeWithinBatch,
  newFieldValue,
  oldFieldValue,
  orderMetaFrom,
} from "@/lib/importMerge";
import type { ImportCandidate, StockItem } from "@/lib/types";

const cand = (over: Partial<ImportCandidate> = {}): ImportCandidate => ({
  name: "สบู่", qty: 1, img: "", link: "", cats: [], status: "", include: true, ...over,
});

const item = (over: Partial<StockItem> = {}): StockItem => ({
  id: "i", name: "สบู่", cats: [], qty: 1, min: 0, note: "", ...over,
});

describe("findExisting — จับคู่ผิดคือจำนวนไปบวกใส่ของผิดชิ้น", () => {
  it("ลิงก์ตรงกันชนะการเทียบชื่อ", () => {
    const items = [item({ id: "byname", name: "สบู่" }), item({ id: "bylink", name: "ชื่ออื่น", link: "https://x/1" })];
    expect(findExisting(cand({ name: "ชื่ออื่น", link: "https://x/1" }), items)?.id).toBe("bylink");
  });

  it("ไม่มีลิงก์ก็เทียบชื่อ (ไม่สนตัวพิมพ์/ช่องว่างหัวท้าย)", () => {
    expect(findExisting(cand({ name: "  สบู่  " }), [item({ id: "a" })])?.id).toBe("a");
  });

  it("ชื่อ/ลิงก์เดียวกันแต่คนละตัวเลือกสินค้า = คนละชิ้น", () => {
    const items = [item({ id: "a", variant: "สีแดง" })];
    expect(findExisting(cand({ variant: "สีน้ำเงิน" }), items)).toBeUndefined();
    expect(findExisting(cand({ variant: "สีแดง" }), items)?.id).toBe("a");
  });

  it("ของเดิมไม่มี variant กับรายการใหม่ที่ไม่มี variant = ชิ้นเดียวกัน", () => {
    expect(findExisting(cand(), [item({ id: "a" })])?.id).toBe("a");
  });

  it("ไม่เจอ = undefined (จะกลายเป็นรายการใหม่)", () => {
    expect(findExisting(cand({ name: "ของใหม่" }), [item({ id: "a" })])).toBeUndefined();
  });
});

describe("mergeWithinBatch — Shopee เรนเดอร์แถวเดียวกันซ้ำ (mobile/desktop)", () => {
  it("แถวซ้ำถูกรวมและคิดราคาต่อชิ้นใหม่จากยอดรวมใหม่", () => {
    const out = mergeWithinBatch([
      cand({ link: "https://x/1", qty: 2, lineTotal: 100, price: 50 }),
      cand({ link: "https://x/1", qty: 3, lineTotal: 150, price: 50 }),
    ]);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ qty: 5, lineTotal: 250, price: 50 });
  });

  it("ของเดียวกันแต่คนละร้าน (ลิงก์ต่างกัน) ต้องไม่ถูกรวม", () => {
    const out = mergeWithinBatch([
      cand({ link: "https://ร้านเอ/1", qty: 1 }),
      cand({ link: "https://ร้านบี/1", qty: 1 }),
    ]);
    expect(out).toHaveLength(2);
  });

  it("คนละตัวเลือกสินค้าไม่ถูกรวม (เคสที่เคยทำให้ออเดอร์นำเข้าไม่ครบ)", () => {
    const out = mergeWithinBatch([
      cand({ link: "https://x/1", variant: "กลาง", qty: 1 }),
      cand({ link: "https://x/1", variant: "ใหญ่", qty: 1 }),
    ]);
    expect(out).toHaveLength(2);
  });

  it("คงลำดับเดิมของแถวไว้", () => {
    const out = mergeWithinBatch([cand({ name: "ข" }), cand({ name: "ก" }), cand({ name: "ข" })]);
    expect(out.map((c) => c.name)).toEqual(["ข", "ก"]);
  });

  it("เติมรูป/ลิงก์จากแถวที่มี ถ้าแถวแรกไม่มี", () => {
    const out = mergeWithinBatch([cand({ img: "" }), cand({ img: "https://รูป" })]);
    expect(out[0].img).toBe("https://รูป");
  });
});

describe("applyPriceMode — หารผิดคือต้นทุนกับยอดสรุปเพี้ยนทั้งหมด", () => {
  it("โหมดยอดรวมทั้งแถว: หารด้วยจำนวนเป็นราคาต่อชิ้น", () => {
    expect(applyPriceMode([cand({ qty: 3, lineTotal: 54 })], true)[0].price).toBe(18);
  });

  it("หารไม่ลงตัวปัดเหลือ 2 ตำแหน่ง", () => {
    expect(applyPriceMode([cand({ qty: 3, lineTotal: 55 })], true)[0].price).toBe(18.33);
  });

  it("โหมดราคาต่อชิ้นอยู่แล้ว: ใช้ตัวเลขนั้นตรงๆ", () => {
    expect(applyPriceMode([cand({ qty: 3, lineTotal: 54 })], false)[0].price).toBe(54);
  });

  it("แถวที่ไม่มียอดรวม (แกะราคาไม่ได้) ไม่ถูกแตะ", () => {
    const c = cand({ qty: 3, price: 99 });
    expect(applyPriceMode([c], true)[0]).toBe(c);
  });

  it("จำนวน 0 ไม่หารด้วยศูนย์", () => {
    expect(applyPriceMode([cand({ qty: 0, lineTotal: 54 })], true)[0].price).toBe(54);
  });
});

describe("newFieldValue / oldFieldValue", () => {
  const existing = item({ img: "เดิม", size: "M", note: "โน้ต", shop: "ร้านเอ" });

  it("ค่าที่เหมือนเดิมไม่นับว่ามีค่าใหม่ (จะได้ไม่ขึ้นให้ติ๊กเปล่าๆ)", () => {
    expect(newFieldValue("img", cand({ img: "เดิม" }), existing)).toBeUndefined();
    expect(newFieldValue("shop", cand({ shop: "ร้านเอ" }), existing)).toBeUndefined();
  });

  it("ค่าที่ต่างจากเดิมถือว่ามีค่าใหม่", () => {
    expect(newFieldValue("img", cand({ img: "ใหม่" }), existing)).toBe("ใหม่");
    expect(newFieldValue("shop", cand({ shop: "ร้านบี" }), existing)).toBe("ร้านบี");
  });

  it("จำนวนกับราคานับว่ามีค่าใหม่เสมอ (ซื้อซ้ำต้องบวกจำนวนอยู่แล้ว)", () => {
    expect(newFieldValue("qty", cand({ qty: 2 }), existing)).toBe(2);
  });

  it("อ่านค่าเดิมไว้โชว์เทียบ", () => {
    expect(oldFieldValue("size", existing)).toBe("M");
    expect(oldFieldValue("note", existing)).toBe("โน้ต");
  });
});

describe("computeMergeFields", () => {
  it("ติ๊กให้เฉพาะฟิลด์ที่มีค่าใหม่จริง", () => {
    const fields = computeMergeFields(cand({ qty: 2, img: "ใหม่" }), item({ img: "เดิม", size: "M" }));
    expect(fields.qty).toBe(true);
    expect(fields.img).toBe(true);
    expect(fields.size).toBe(false); // รายการใหม่ไม่มี size มา
  });
});

describe("isBackdated", () => {
  it("ออเดอร์เก่ากว่าครั้งล่าสุดที่บันทึกไว้", () => {
    expect(isBackdated(cand({ purchasedAt: "2019-08-01" }), item({ purchasedAt: "2026-08-01" }))).toBe(true);
    expect(isBackdated(cand({ purchasedAt: "2026-09-01" }), item({ purchasedAt: "2026-08-01" }))).toBe(false);
  });

  it("ไม่รู้วันที่ฝั่งใดฝั่งหนึ่ง = ตัดสินไม่ได้", () => {
    expect(isBackdated(cand(), item({ purchasedAt: "2026-08-01" }))).toBe(false);
    expect(isBackdated(cand({ purchasedAt: "2026-08-01" }), item())).toBe(false);
  });
});

describe("linkToExisting", () => {
  it("ซื้อซ้ำ = ดึงหมวดหมู่/หมายเหตุของเดิมมาให้ ไม่ต้องเลือกใหม่ทุกครั้ง", () => {
    const out = linkToExisting([cand()], [item({ id: "a", cats: ["ของใช้"], note: "โน้ตเดิม" })]);
    expect(out[0]).toMatchObject({ existingId: "a", mergeExisting: true, cats: ["ของใช้"], note: "โน้ตเดิม" });
  });

  it("หมายเหตุที่แกะมาได้ชนะของเดิม", () => {
    const out = linkToExisting([cand({ note: "โน้ตใหม่" })], [item({ id: "a", note: "โน้ตเดิม" })]);
    expect(out[0].note).toBe("โน้ตใหม่");
  });

  it("ของใหม่ไม่ถูกแตะ", () => {
    const c = cand({ name: "ของใหม่" });
    expect(linkToExisting([c], [item({ id: "a" })])[0]).toBe(c);
  });
});

describe("orderMetaFrom — วันที่/ร้านของออเดอร์ต้องมาจากแถวที่ติ๊กไว้จริง", () => {
  it("ไม่เอาวันที่/ร้านจากแถวที่ผู้ใช้ติ๊กออกไปแล้ว", () => {
    // ค่าส่งถูกบันทึกเป็นเงินระดับออเดอร์ ถ้าวันที่มาจากแถวที่ไม่ได้นำเข้า ยอดจะไปลงผิดเดือน
    // และ findDuplicateOrder ก็เทียบผิดตัว (ค่าส่งถูกนับสองรอบแบบเงียบๆ)
    const all = [
      cand({ name: "ไม่เอา", include: false, purchasedAt: "2026-01-01", shop: "ร้านเก่า" }),
      cand({ name: "เอา", include: true, purchasedAt: "2026-08-01", shop: "ร้านใหม่" }),
    ];
    const chosen = all.filter((c) => c.include);
    expect(orderMetaFrom(chosen, all)).toEqual({ date: "2026-08-01", shop: "ร้านใหม่" });
  });

  it("แถวที่เลือกไม่มีวันที่/ร้านเลย ค่อยถอยไปดูทั้งหน้า (ดีกว่าออเดอร์ไม่มีวันที่)", () => {
    const all = [
      cand({ name: "ไม่เอา", include: false, purchasedAt: "2026-08-01", shop: "ร้านเอ" }),
      cand({ name: "เอา", include: true }),
    ];
    expect(orderMetaFrom(all.filter((c) => c.include), all)).toEqual({ date: "2026-08-01", shop: "ร้านเอ" });
  });

  it("ไม่มีใครมีวันที่/ร้านเลย = undefined ทั้งคู่ (ไม่เดาให้)", () => {
    const all = [cand()];
    expect(orderMetaFrom(all, all)).toEqual({ date: undefined, shop: undefined });
  });
});
