/**
 * "ของชิ้นนี้กินเงินวันละเท่าไร" — ต่างจาก /summary ที่บอกยอดจ่ายไปแล้ว
 * ตัวนี้ตอบว่าจ่ายไปที่จริงๆ ตกวันละกี่บาท เอาไว้เทียบว่าของชิ้นไหนเปลืองสุด
 *
 * มีสองแหล่งข้อมูล เลือกตัวที่แม่นกว่า:
 * - `usageLog` (จาก +/− บนการ์ด) → ใช้อัตราตรงๆ
 * - ประวัติซื้อ (`priceHistory`) → ใช้ interval ระหว่างครั้ง (เผื่อของที่ไม่ค่อยกด +/−)
 *
 * ทั้งสองทางคืน `null` เมื่อข้อมูลไม่พอ — เดาตัวเลขเงินให้ผิดๆ อันตรายกว่าไม่ตอบ
 */
import { avgPrice } from "@/lib/domain/price";
import { repurchaseStats } from "@/lib/domain/repurchase";
import { usageStats } from "@/lib/domain/usage";
import type { StockItem } from "@/lib/types";

export interface SpendRate {
  /** ตกวันละกี่บาท */
  bahtPerDay: number;
  /** ตกเดือนละกี่บาท (× 30) */
  bahtPerMonth: number;
  /** ราคาเฉลี่ยต่อแพ็คที่เอาไปคูณ (โชว์ให้ผู้ใช้เห็นที่มา) */
  avgPricePerPack: number;
  /** ใช้ 1 แพ็คได้กี่วัน — inverse ของอัตรา */
  daysPerPack: number;
  /** มาจากประวัติแบบไหน — `"usage"` แม่นกว่า `"purchases"` เป็น fallback */
  source: "usage" | "purchases";
}

type SpendItem = Pick<StockItem, "priceHistory" | "usageLog" | "price">;

/**
 * เลือกแหล่งข้อมูลที่จะบอก "ใช้ 1 แพ็คได้กี่วัน" — `usageStats` ก่อน แล้วตกไปที่ `repurchaseStats`
 * แยกออกจาก `spendRate` เพื่อให้การประกอบผลลัพธ์เกิดที่เดียว (จะไม่มีทางลืม × 30 หรือตั้ง
 * `avgPricePerPack` ให้ไม่ตรงกันระหว่าง branch)
 */
function usageRate(item: SpendItem): { daysPerPack: number; source: SpendRate["source"] } | null {
  const usage = usageStats(item);
  if (usage && usage.perDay > 0) return { daysPerPack: 1 / usage.perDay, source: "usage" };
  const repurchase = repurchaseStats(item);
  if (repurchase && repurchase.daysPerPack > 0) return { daysPerPack: repurchase.daysPerPack, source: "purchases" };
  return null;
}

/**
 * คำนวณค่าใช้จ่ายต่อวันของสินค้า 1 ชิ้น — คืน `null` เมื่อข้อมูลไม่พอ
 *
 * ราคา: ใช้ค่าเฉลี่ยจาก `priceHistory` (ถ่วงน้ำหนักด้วยจำนวน) ก่อน ถ้ายังไม่มีประวัติเลย
 * ใช้ราคาปัจจุบัน `item.price` — ราคาที่จ่ายจริงย่อมแม่นกว่าราคาปัจจุบันที่ยังไม่เคยซื้อ
 */
export function spendRate(item: SpendItem): SpendRate | null {
  const avg = avgPrice(item.priceHistory);
  const price = avg ?? (typeof item.price === "number" && item.price > 0 ? item.price : null);
  if (price == null || price <= 0) return null;

  const rate = usageRate(item);
  if (!rate) return null;

  const bahtPerDay = price / rate.daysPerPack;
  return {
    bahtPerDay,
    bahtPerMonth: bahtPerDay * 30,
    avgPricePerPack: price,
    daysPerPack: rate.daysPerPack,
    source: rate.source,
  };
}
