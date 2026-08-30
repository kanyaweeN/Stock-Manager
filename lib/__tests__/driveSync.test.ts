import { describe, expect, it } from "vitest";
import { overwriteRisks, type DbCounts } from "@/lib/hooks/useGoogleDriveSync";

/**
 * ด่านสุดท้ายก่อนเขียนทับไฟล์ **ไฟล์เดียว** ที่มีบน Drive — พลาดคือข้อมูลหายถาวร
 * และทดสอบผ่าน UI ไม่ได้เพราะต้องล็อกอิน Google จริง
 */
const C = (items: number, trash = 0, recipes = 0, plans = 0): DbCounts => ({ items, recipes, plans, trash });

describe("overwriteRisks — ของยังอยู่ในถังขยะไม่ถือว่าหาย", () => {
  it("เลือกลบ 15 จาก 40 ชิ้นลงถังขยะ = ไม่เตือน ไม่หยุดซิงก์อัตโนมัติ", () => {
    // เคสนี้เคยพัง: ตอนทำถังขยะใหม่ๆ ระบบนับแค่ db.items เลยมองว่า "ลบไปเยอะผิดปกติ"
    expect(overwriteRisks(C(25, 15), C(40), C(40), false, false)).toEqual([]);
  });

  it("ล้างถังขยะถาวร = ข้อมูลหายจริง ต้องยังเตือน", () => {
    expect(overwriteRisks(C(25, 0), C(25, 15), C(40), false, false)).toHaveLength(1);
  });

  it("seen เก่าที่บันทึกไว้ก่อนมีถังขยะ (ไม่มีฟิลด์ trash) ต้องไม่กลายเป็น NaN", () => {
    const legacySeen = { items: 40, recipes: 0, plans: 0 } as DbCounts;
    expect(overwriteRisks(C(30, 10), C(40), legacySeen, false, false)).toEqual([]);
  });
});

describe("overwriteRisks — เคสอันตรายที่ต้องเตือนเสมอ", () => {
  it("เปิดแอปมาข้อมูลไม่ครบตั้งแต่แรก (เปิดผิดพอร์ต/โดนล้าง site data)", () => {
    const risks = overwriteRisks(C(0), C(0), C(40), false, false);
    expect(risks).toHaveLength(1);
    expect(risks[0]).toContain("อาจไม่ครบตั้งแต่แรก");
  });

  it("ไฟล์บน Drive ถูกแก้จากเครื่องอื่นหลังซิงก์ครั้งล่าสุด", () => {
    expect(overwriteRisks(C(40), C(40), C(40), true, false)).toHaveLength(1);
  });

  it("เครื่องนี้ยังไม่เคยซิงก์มาก่อน", () => {
    expect(overwriteRisks(C(40), C(40), null, false, true)).toHaveLength(1);
  });

  it("ของหายเยอะจริงจนเกินเกณฑ์ (ลบทั้ง 200 ถังเก็บได้ 100 = หายจริง 100)", () => {
    const risks = overwriteRisks(C(0, 100), C(200), C(200), false, false);
    expect(risks).toHaveLength(1);
    expect(risks[0]).toContain("ลบไปเยอะผิดปกติ");
  });
});

describe("overwriteRisks — การใช้งานปกติต้องไม่โดนถาม", () => {
  it("ลบทีละชิ้นสองชิ้น", () => {
    expect(overwriteRisks(C(37), C(40), C(40), false, false)).toEqual([]);
  });

  it("ลบเยอะแต่สัดส่วนน้อย (20 จาก 140 = 14%)", () => {
    expect(overwriteRisks(C(120), C(140), C(140), false, false)).toEqual([]);
  });

  it("เพิ่มของเข้าไป", () => {
    expect(overwriteRisks(C(50), C(40), C(40), false, false)).toEqual([]);
  });

  it("สูตร/แผน ใช้ตัวเลขตรงๆ ไม่เกี่ยวกับถังขยะ", () => {
    const risks = overwriteRisks(C(10, 0, 8), C(10, 0, 20), C(10, 0, 20), false, false);
    expect(risks).toHaveLength(1);
    expect(risks[0]).toContain("สูตรต้นทุน");
  });
});
