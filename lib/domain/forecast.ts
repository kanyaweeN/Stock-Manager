/**
 * รวมสินค้าที่ถูกติดตามเป็น "ก้อน" สำหรับการ์ดคาดคะเน 1 ใบ
 *
 * สินค้าที่อยู่ในกลุ่มเดียวกัน (`groupId`) — เช่น อาหารแมวยี่ห้อ A กับ B ที่ผู้ใช้จัดกลุ่มไว้ว่าเป็น
 * "อาหารแมว" — ต้องคาดคะเนรวมกัน ไม่งั้นแยกเป็นสองการ์ดที่ประวัติแต่ละก้อนไม่พอเดา ทั้งที่จริงๆ
 * ผู้ใช้ก็ซื้อของประเภทเดียวกันสลับยี่ห้อกันเอง
 *
 * บริสุทธิ์ ทดสอบใน lib/__tests__/forecast.test.ts
 */
import type { StockItem } from "@/lib/types";

export interface ForecastCluster {
  /** stable key — `groupId` ถ้าเป็นกลุ่ม, `item.id` ถ้าเดี่ยว */
  key: string;
  /** ชื่อหัวการ์ด — `groupName` ถ้าเป็นกลุ่ม, `item.name` ถ้าเดี่ยว */
  name: string;
  /** รูปตัวแรกที่มีในสมาชิก (กลุ่มที่สมาชิกใส่รูปไว้บ้างไม่ใส่บ้างจะได้ไม่เป็นกล่องเปล่า) */
  img?: string;
  /** บรรทัดรอง — variant (เดี่ยว) หรือรายชื่อสมาชิก (กลุ่ม) */
  subtitle?: string;
  /** สมาชิกทั้งหมด (1+) */
  members: StockItem[];
  /** ก้อนข้อมูลสำหรับส่งเข้า `repurchaseStats`/`spendRate` — merged แล้ว */
  merged: Pick<StockItem, "priceHistory" | "usageLog" | "price">;
}

/** จัดกลุ่มสินค้าที่ติดตามเป็นก้อนตาม `groupId` — ลำดับตามที่ปรากฏใน input */
export function buildForecastClusters(items: StockItem[]): ForecastCluster[] {
  const byGroup = new Map<string, StockItem[]>();
  const groupOrder: string[] = [];
  const singleOrder: StockItem[] = [];

  for (const item of items) {
    if (item.groupId) {
      const existing = byGroup.get(item.groupId);
      if (existing) {
        existing.push(item);
      } else {
        byGroup.set(item.groupId, [item]);
        groupOrder.push(item.groupId);
      }
    } else {
      singleOrder.push(item);
    }
  }

  const clusters: ForecastCluster[] = [];
  for (const gid of groupOrder) {
    const members = byGroup.get(gid)!;
    const first = members[0];
    clusters.push({
      key: gid,
      name: first.groupName || first.name,
      img: members.find((m) => !!m.img)?.img,
      subtitle:
        members.length > 1
          ? `${members.length} รายการ · ${members.map((m) => m.name).join(", ")}`
          : first.variant,
      members,
      merged: mergeStatsInputs(members),
    });
  }
  for (const item of singleOrder) {
    clusters.push({
      key: item.id,
      name: item.name,
      img: item.img,
      subtitle: item.variant,
      members: [item],
      merged: { priceHistory: item.priceHistory, usageLog: item.usageLog, price: item.price },
    });
  }
  return clusters;
}

/**
 * รวม `priceHistory` + `usageLog` + `price` ของสมาชิกทุกคนในกลุ่ม
 *
 * - `priceHistory`: concat เฉยๆ — `repurchaseStats` มี `datedPoints` เรียงเองอยู่แล้ว
 * - `usageLog`: concat แล้ว **ต้องเรียงตามวันที่** เพราะ `usageStats` อ่านตัวแรก/สุดท้ายเป็นขอบเขตช่วง
 * - `price`: ใช้ราคาปัจจุบันของสมาชิกที่ซื้อ**ล่าสุด** (`spendRate` เลือกราคาเฉลี่ยก่อน — ตัวนี้เป็นแค่ fallback)
 */
function mergeStatsInputs(items: StockItem[]): Pick<StockItem, "priceHistory" | "usageLog" | "price"> {
  const priceHistory = items.flatMap((i) => i.priceHistory ?? []);
  const usageLog = items
    .flatMap((i) => i.usageLog ?? [])
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date));
  const withPrice = items.filter((i): i is StockItem & { price: number } => typeof i.price === "number" && i.price > 0);
  const latest = withPrice.length > 0
    ? withPrice.reduce((best, cur) => ((cur.purchasedAt || "") > (best.purchasedAt || "") ? cur : best))
    : null;
  return { priceHistory, usageLog, price: latest?.price };
}
