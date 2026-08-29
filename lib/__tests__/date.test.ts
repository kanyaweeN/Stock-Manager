import { describe, expect, it } from "vitest";
import { daysBetween, daysUntil, endOfMonthISO, formatThaiShortDate, monthISO, todayISO } from "@/lib/date";

describe("todayISO — ต้องอิงเวลาเครื่อง ไม่ใช่ UTC", () => {
  it("ตี 2 ของวันที่ 29 ต้องได้ 29 ไม่ใช่ 28", () => {
    // ไทยเร็วกว่า UTC 7 ชม. — toISOString() จะได้ "เมื่อวาน" ตั้งแต่เที่ยงคืนถึง 7 โมงเช้า
    const local2am = new Date(2026, 7, 29, 2, 0, 0);
    expect(todayISO(local2am)).toBe("2026-08-29");
  });

  it("เติมศูนย์หน้าเดือน/วันเสมอ", () => {
    expect(todayISO(new Date(2026, 0, 5))).toBe("2026-01-05");
  });
});

describe("daysBetween", () => {
  it("นับวันชนวัน ไม่เอาเวลามาเกี่ยว", () => {
    expect(daysBetween("2026-08-01", "2026-08-21")).toBe(20);
    expect(daysBetween("2026-08-21", "2026-08-01")).toBe(-20);
    expect(daysBetween("2026-08-01", "2026-08-01")).toBe(0);
  });

  it("ข้ามเดือน/ปี และข้ามช่วงเปลี่ยนเวลา", () => {
    expect(daysBetween("2026-12-31", "2027-01-01")).toBe(1);
    expect(daysBetween("2024-02-28", "2024-03-01")).toBe(2); // ปีอธิกสุรทิน
  });

  it("อ่านวันที่ไม่ออก = null", () => {
    expect(daysBetween("", "2026-08-01")).toBeNull();
    expect(daysBetween("2026-8-1", "2026-08-01")).toBeNull();
    expect(daysBetween(undefined, undefined)).toBeNull();
  });
});

describe("daysUntil", () => {
  const now = new Date(2026, 7, 29);
  it("อนาคตเป็นบวก อดีตเป็นลบ วันนี้เป็น 0", () => {
    expect(daysUntil("2026-09-01", now)).toBe(3);
    expect(daysUntil("2026-08-26", now)).toBe(-3);
    expect(daysUntil("2026-08-29", now)).toBe(0);
  });

  it("อ่านไม่ออก = null", () => {
    expect(daysUntil("", now)).toBeNull();
  });
});

describe("monthISO / endOfMonthISO", () => {
  const now = new Date(2026, 7, 29);
  it("เดือนนี้/เดือนหน้า", () => {
    expect(monthISO(0, now)).toBe("2026-08");
    expect(monthISO(1, now)).toBe("2026-09");
    expect(monthISO(-1, now)).toBe("2026-07");
  });

  it("ข้ามปีได้ถูก", () => {
    expect(monthISO(5, now)).toBe("2027-01");
  });

  it("วันสุดท้ายของเดือน รวมเดือนที่มี 28/29/30/31 วัน", () => {
    expect(endOfMonthISO(0, now)).toBe("2026-08-31");
    expect(endOfMonthISO(1, now)).toBe("2026-09-30");
    expect(endOfMonthISO(-6, now)).toBe("2026-02-28");
    expect(endOfMonthISO(0, new Date(2024, 1, 10))).toBe("2024-02-29");
  });
});

describe("formatThaiShortDate", () => {
  const now = new Date(2026, 7, 29);
  it("ของปีนี้ตัดปีทิ้ง", () => {
    expect(formatThaiShortDate("2026-04-04", now)).toBe("4 เม.ย.");
  });

  it("คนละปีโชว์ปี พ.ศ. สองหลัก", () => {
    expect(formatThaiShortDate("2019-04-04", now)).toBe("4 เม.ย. 62");
  });

  it("อ่านไม่ออกคืนสตริงว่าง ให้ผู้เรียกตัดสินใจเอง", () => {
    expect(formatThaiShortDate("", now)).toBe("");
    expect(formatThaiShortDate("2026-13-01", now)).toBe("");
    expect(formatThaiShortDate(undefined, now)).toBe("");
  });
});
