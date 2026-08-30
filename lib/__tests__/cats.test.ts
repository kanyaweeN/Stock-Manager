import { describe, it, expect } from "vitest";
import { applyCatEdit, catsInUse, commonCats, dropRedundantParentCats, matchesCatFilter, previewCatEdit } from "@/lib/core/cats";

describe("applyCatEdit", () => {
  it("โหมดเพิ่ม: ติดหมวดใหม่ต่อท้าย ของเดิมยังอยู่ครบ", () => {
    expect(applyCatEdit(["ผิวหน้า"], ["ของใช้"], "add")).toEqual(["ผิวหน้า", "ของใช้"]);
  });

  it("โหมดเพิ่ม: กดซ้ำกี่ครั้งผลก็เท่าเดิม ไม่มีหมวดซ้ำ", () => {
    const once = applyCatEdit(["ผิวหน้า"], ["ผิวหน้า", "ของใช้"], "add");
    expect(once).toEqual(["ผิวหน้า", "ของใช้"]);
    expect(applyCatEdit(once, ["ผิวหน้า", "ของใช้"], "add")).toEqual(once);
  });

  it("โหมดเอาออก: ตัดเฉพาะที่เลือก หมวดอื่นไม่ถูกแตะ", () => {
    expect(applyCatEdit(["ผิวหน้า", "ของใช้"], ["ของใช้"], "remove")).toEqual(["ผิวหน้า"]);
  });

  it("โหมดเอาออก: หมวดที่ของชิ้นนั้นไม่มีอยู่แล้ว ไม่ทำให้อะไรเปลี่ยน", () => {
    expect(applyCatEdit(["ผิวหน้า"], ["ของใช้"], "remove")).toEqual(["ผิวหน้า"]);
  });

  it("โหมดแทนที่: ทับของเดิมทั้งหมด และเลือกว่าง = ล้างทิ้ง", () => {
    expect(applyCatEdit(["ผิวหน้า"], ["ของใช้"], "replace")).toEqual(["ของใช้"]);
    expect(applyCatEdit(["ผิวหน้า"], [], "replace")).toEqual([]);
  });

  it("ตัดหมวดแม่ที่ซ้ำกับซับหมวดทิ้ง ตัวอย่างที่โชว์จะได้ตรงกับที่ normalizeDB เก็บจริง", () => {
    expect(applyCatEdit(["เครื่องใช้"], ["เครื่องใช้ > ของแต่งห้อง"], "add")).toEqual(["เครื่องใช้ > ของแต่งห้อง"]);
    expect(applyCatEdit([], ["เครื่องใช้", "เครื่องใช้ > ของแต่งห้อง"], "replace")).toEqual(["เครื่องใช้ > ของแต่งห้อง"]);
  });

  it("ชื่อว่างที่หลุดมาถูกทิ้ง ไม่กลายเป็นหมวดไร้ชื่อ", () => {
    expect(applyCatEdit([], ["", "  ", "ของใช้"], "replace")).toEqual(["ของใช้"]);
  });
});

describe("dropRedundantParentCats", () => {
  it("เก็บหมวดแม่ไว้ถ้าไม่มีลูกของมันถูกเลือก", () => {
    expect(dropRedundantParentCats(["เครื่องใช้", "ผิวหน้า > ครีม"])).toEqual(["เครื่องใช้", "ผิวหน้า > ครีม"]);
  });
});

describe("catsInUse / commonCats", () => {
  it("catsInUse = หมวดทั้งหมดที่กลุ่มที่เลือกใช้อยู่ ไม่ซ้ำ", () => {
    expect(catsInUse([["ผิวหน้า", "ของใช้"], ["ของใช้"]])).toEqual(["ของใช้", "ผิวหน้า"]);
  });

  it("commonCats = เฉพาะหมวดที่ทุกชิ้นมีเหมือนกัน", () => {
    expect(commonCats([["ผิวหน้า", "ของใช้"], ["ของใช้"]])).toEqual(["ของใช้"]);
  });

  it("commonCats ของกลุ่มว่าง = ว่าง (ไม่ใช่พัง)", () => {
    expect(commonCats([])).toEqual([]);
  });
});

describe("matchesCatFilter", () => {
  it("กรองหมวดแม่แล้วต้องเห็นของที่แยกซับหมวดไปแล้วด้วย", () => {
    // `dropRedundantParentCats` ตัด "ของใช้" ทิ้งไปตั้งแต่ตอนแยกซับหมวด ถ้าเทียบตรงตัวของชิ้นนี้จะหายเงียบๆ
    expect(matchesCatFilter(["ของใช้ > สบู่"], ["ของใช้"])).toBe(true);
    expect(applyCatEdit(["ของใช้ > สบู่"], ["ของใช้"], "add")).toEqual(["ของใช้ > สบู่"]);
  });

  it("กรองซับหมวดแล้วไม่กวาดพี่น้องหรือหมวดแม่เปล่าๆ มาด้วย", () => {
    expect(matchesCatFilter(["ของใช้ > แชมพู"], ["ของใช้ > สบู่"])).toBe(false);
    expect(matchesCatFilter(["ของใช้"], ["ของใช้ > สบู่"])).toBe(false);
  });

  it("ชื่อที่ขึ้นต้นเหมือนกันแต่คนละหมวด ไม่ถือว่าเป็นลูก", () => {
    expect(matchesCatFilter(["ของใช้ไฟฟ้า"], ["ของใช้"])).toBe(false);
  });

  it("เลือกหลายหมวด = เข้าอันใดอันหนึ่งก็พอ, ไม่เลือกเลย = ผ่านหมด", () => {
    expect(matchesCatFilter(["อาหาร"], ["ของใช้", "อาหาร"])).toBe(true);
    expect(matchesCatFilter([], [])).toBe(true);
    expect(matchesCatFilter([], ["ของใช้"])).toBe(false);
  });
});

describe("previewCatEdit", () => {
  it("บอกว่าหมวดไหนจะเพิ่มมา หมวดไหนจะหายไป (ตัวอย่างต้องตรงกับ applyCatEdit เสมอ)", () => {
    const p = previewCatEdit(["อาหาร"], ["ของใช้"], "add");
    expect(p.after).toEqual(["อาหาร", "ของใช้"]);
    expect(p.added).toEqual(["ของใช้"]);
    expect(p.removed).toEqual([]);
    expect(p.changed).toBe(true);
  });

  it("โหมดแทนที่ = หมวดเดิมที่ไม่ได้เลือกไว้นับเป็น 'จะหายไป'", () => {
    const p = previewCatEdit(["อาหาร", "ของใช้"], ["ของใช้"], "replace");
    expect(p.after).toEqual(["ของใช้"]);
    expect(p.removed).toEqual(["อาหาร"]);
    expect(p.added).toEqual([]);
  });

  it("ของที่ไม่มีอะไรเปลี่ยน changed = false (ปุ่มยืนยันดูค่านี้ตัดสินว่ากดได้ไหม)", () => {
    expect(previewCatEdit(["อาหาร"], ["อาหาร"], "add").changed).toBe(false);
    expect(previewCatEdit(["อาหาร"], ["ของใช้"], "remove").changed).toBe(false);
  });
});
