import { describe, expect, it } from "vitest";
import { EXPIRY_SOON_DAYS, effectiveExpiry, expiryLabel, needsAttention, paoExpiry } from "@/lib/domain/expiry";

const NOW = new Date(2026, 7, 29); // 29 ส.ค. 2026 (เวลาเครื่อง ไม่ใช่ UTC)

describe("paoExpiry", () => {
  it("บวกเดือนตรงไปตรงมา", () => {
    expect(paoExpiry("2026-01-15", 12)).toBe("2027-01-15");
    expect(paoExpiry("2026-08-29", 6)).toBe("2027-02-28");
  });

  it("วันที่ล้นเดือนต้องหนีบเป็นวันสุดท้ายของเดือน ไม่ใช่ไหลไปเดือนถัดไป", () => {
    // 31 ม.ค. + 1 เดือน ถ้าปล่อยตาม setMonth จะได้ 3 มี.ค. = ยืดอายุให้ยาวกว่าจริง
    expect(paoExpiry("2026-01-31", 1)).toBe("2026-02-28");
    expect(paoExpiry("2024-01-31", 1)).toBe("2024-02-29"); // ปีอธิกสุรทิน
    expect(paoExpiry("2026-03-31", 1)).toBe("2026-04-30");
  });

  it("ข้อมูลไม่ครบ = ไม่รู้", () => {
    expect(paoExpiry("", 12)).toBeNull();
    expect(paoExpiry("2026-01-15", 0)).toBeNull();
    expect(paoExpiry("2026-01-15", undefined)).toBeNull();
    expect(paoExpiry("ไม่ใช่วันที่", 12)).toBeNull();
  });
});

describe("effectiveExpiry", () => {
  it("ไม่กรอกอะไรเลย = null (ไม่รู้ ไม่ใช่ 'ยังไม่หมดอายุ')", () => {
    expect(effectiveExpiry({}, NOW)).toBeNull();
  });

  it("มีแต่ฉลาก", () => {
    const info = effectiveExpiry({ expiryAt: "2026-10-01" }, NOW);
    expect(info?.source).toBe("label");
    expect(info?.daysLeft).toBe(33);
    expect(info?.expired).toBe(false);
  });

  it("PAO มาถึงก่อนฉลาก → ใช้ PAO", () => {
    const info = effectiveExpiry({ expiryAt: "2027-05-01", openedAt: "2026-08-01", paoMonths: 1 }, NOW);
    expect(info?.source).toBe("pao");
    expect(info?.date).toBe("2026-09-01");
    expect(info?.soon).toBe(true);
  });

  it("ฉลากมาถึงก่อน PAO → ใช้ฉลาก", () => {
    const info = effectiveExpiry({ expiryAt: "2026-09-05", openedAt: "2026-08-01", paoMonths: 12 }, NOW);
    expect(info?.source).toBe("label");
    expect(info?.date).toBe("2026-09-05");
  });

  it("เลยวันมาแล้ว = expired และ daysLeft ติดลบ", () => {
    const info = effectiveExpiry({ expiryAt: "2026-08-26" }, NOW);
    expect(info?.expired).toBe(true);
    expect(info?.daysLeft).toBe(-3);
    expect(info?.soon).toBe(false);
    expect(expiryLabel(info!)).toBe("หมดอายุแล้ว 3 วัน");
  });

  it("หมดอายุวันนี้", () => {
    const info = effectiveExpiry({ expiryAt: "2026-08-29" }, NOW);
    expect(info?.daysLeft).toBe(0);
    expect(info?.expired).toBe(false);
    expect(expiryLabel(info!)).toBe("หมดอายุวันนี้");
  });

  it("ขอบเขต 'ใกล้หมดอายุ' ตรงกับ EXPIRY_SOON_DAYS พอดี", () => {
    const edge = new Date(NOW);
    edge.setDate(edge.getDate() + EXPIRY_SOON_DAYS);
    const iso = `${edge.getFullYear()}-${String(edge.getMonth() + 1).padStart(2, "0")}-${String(edge.getDate()).padStart(2, "0")}`;
    expect(effectiveExpiry({ expiryAt: iso }, NOW)?.soon).toBe(true);

    const past = new Date(NOW);
    past.setDate(past.getDate() + EXPIRY_SOON_DAYS + 1);
    const isoPast = `${past.getFullYear()}-${String(past.getMonth() + 1).padStart(2, "0")}-${String(past.getDate()).padStart(2, "0")}`;
    expect(effectiveExpiry({ expiryAt: isoPast }, NOW)?.soon).toBe(false);
  });
});

describe("needsAttention", () => {
  it("หมดแล้วหรือใกล้หมด = ต้องสนใจ, ยังอีกนาน/ไม่รู้ = ไม่ต้อง", () => {
    expect(needsAttention({ expiryAt: "2026-08-01" }, NOW)).toBe(true);
    expect(needsAttention({ expiryAt: "2026-09-10" }, NOW)).toBe(true);
    expect(needsAttention({ expiryAt: "2030-01-01" }, NOW)).toBe(false);
    expect(needsAttention({}, NOW)).toBe(false);
  });
});
