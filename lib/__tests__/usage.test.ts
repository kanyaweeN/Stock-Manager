import { describe, expect, it } from "vitest";
import {
  RUNOUT_SOON_DAYS,
  USAGE_LOG_MAX,
  daysUntilEmpty,
  pushUsage,
  runningOut,
  usageStats,
} from "@/lib/usage";
import type { UsagePoint } from "@/lib/types";

describe("pushUsage", () => {
  it("กดหลายครั้งในวันเดียวรวมเป็นจุดเดียว", () => {
    const log = pushUsage([{ date: "2026-08-01", delta: -1 }], -1, "2026-08-01");
    expect(log).toEqual([{ date: "2026-08-01", delta: -2 }]);
  });

  it("กด − แล้ว + ในวันเดียวจนหักล้างกันหมด = ไม่เหลือจุด", () => {
    expect(pushUsage([{ date: "2026-08-01", delta: -1 }], 1, "2026-08-01")).toEqual([]);
  });

  it("คนละวันเป็นคนละจุด", () => {
    expect(pushUsage([{ date: "2026-08-01", delta: -1 }], -1, "2026-08-05")).toEqual([
      { date: "2026-08-01", delta: -1 },
      { date: "2026-08-05", delta: -1 },
    ]);
  });

  it("delta 0 ไม่จด", () => {
    expect(pushUsage([], 0, "2026-08-01")).toEqual([]);
  });

  it("ตัดจุดเก่าทิ้งเมื่อเกิน USAGE_LOG_MAX (ไฟล์ที่ซิงก์ขึ้น Drive จะได้ไม่โตไม่มีที่สิ้นสุด)", () => {
    const full: UsagePoint[] = Array.from({ length: USAGE_LOG_MAX }, (_, i) => ({
      date: `2026-01-${String((i % 28) + 1).padStart(2, "0")}`,
      delta: -1,
    }));
    const out = pushUsage(full, -1, "2026-09-09");
    expect(out.length).toBe(USAGE_LOG_MAX);
    expect(out[out.length - 1]).toEqual({ date: "2026-09-09", delta: -1 });
  });
});

describe("usageStats", () => {
  it("ข้อมูลไม่พอ = null (ไม่รู้ ไม่ใช่ 'ยังอีกนาน')", () => {
    expect(usageStats({ usageLog: [] })).toBeNull();
    expect(usageStats({ usageLog: [{ date: "2026-08-01", delta: -1 }] })).toBeNull();
    // ช่วงสั้นเกินไป เอามาเหมาว่าใช้เท่านี้ทุกวันไม่ได้
    expect(usageStats({ usageLog: [{ date: "2026-08-01", delta: -1 }, { date: "2026-08-04", delta: -1 }] })).toBeNull();
  });

  it("ไม่นับจุดแรก เพราะจุดแรกคือจุดเริ่มจับเวลา ไม่ใช่การใช้ภายในช่วงที่วัด", () => {
    const stats = usageStats({
      usageLog: [{ date: "2026-08-01", delta: -5 }, { date: "2026-08-21", delta: -10 }],
    });
    expect(stats).toEqual({ perDay: 0.5, days: 20, used: 10 });
  });

  it("การเติมของเข้า (delta บวก) ไม่นับเป็นการใช้", () => {
    const stats = usageStats({
      usageLog: [
        { date: "2026-08-01", delta: -2 },
        { date: "2026-08-10", delta: 20 },
        { date: "2026-08-21", delta: -10 },
      ],
    });
    expect(stats?.used).toBe(10);
    expect(stats?.perDay).toBe(0.5);
  });

  it("มีแต่การเติมของ ไม่มีการใช้เลย = null", () => {
    expect(usageStats({ usageLog: [{ date: "2026-08-01", delta: 5 }, { date: "2026-08-21", delta: 10 }] })).toBeNull();
  });
});

describe("daysUntilEmpty / runningOut", () => {
  const log: UsagePoint[] = [{ date: "2026-08-01", delta: -5 }, { date: "2026-08-21", delta: -10 }];

  it("เหลือ 6 ชิ้น ใช้วันละ 0.5 = 12 วัน", () => {
    expect(daysUntilEmpty({ qty: 6, usageLog: log })).toBe(12);
  });

  it("นับเศษของขวดที่เปิดอยู่ด้วย", () => {
    // 3 ขวด ขวดที่เปิดเหลือครึ่ง = 2.5 ขวด ÷ 0.5 ต่อวัน = 5 วัน (ไม่ใช่ 6)
    expect(daysUntilEmpty({ qty: 3, openPct: 50, usageLog: log })).toBe(5);
  });

  it("ของหมดแล้ว/ข้อมูลไม่พอ = null", () => {
    expect(daysUntilEmpty({ qty: 0, usageLog: log })).toBeNull();
    expect(daysUntilEmpty({ qty: 5, usageLog: [] })).toBeNull();
  });

  it("runningOut ใช้เกณฑ์ RUNOUT_SOON_DAYS", () => {
    // ใช้วันละ 0.5 → เหลือกี่ชิ้นถึงจะพอดีเกณฑ์
    const atEdge = RUNOUT_SOON_DAYS * 0.5;
    expect(runningOut({ qty: atEdge, usageLog: log })).toBe(true);
    expect(runningOut({ qty: atEdge + 1, usageLog: log })).toBe(false);
    expect(runningOut({ qty: 999, usageLog: [] })).toBe(false);
  });
});
