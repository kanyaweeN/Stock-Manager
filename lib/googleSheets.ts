import { priceStats } from "./price";
import type { StockItem } from "./types";

/**
 * ส่งออกรายการสินค้าไปดูเป็นตารางใน Google Sheet — **ทางเดียว (push อย่างเดียว)**
 *
 * การซิงก์ข้อมูลจริงย้ายไปอยู่ที่ `lib/googleDrive.ts` (JSON ทั้งก้อน) แล้ว
 * ที่นี่จึงไม่มี pull อีกต่อไป เพราะชีตเก็บได้แค่ `items` — ดึงกลับมาทีไรก็ทับ
 * สูตรต้นทุน/โปรไฟล์ผิว/ฟิลด์ที่ไม่มีคอลัมน์ทิ้งทุกที
 */
export const SHEETS_SCOPE = "https://www.googleapis.com/auth/spreadsheets";
/**
 * ลำดับคอลัมน์ = ลำดับใน HEADER (อิงตำแหน่งล้วนๆ) — เพิ่มฟิลด์ใหม่ให้**ต่อท้าย**เท่านั้น
 * ไม่งั้นชีตเก่าจะอ่านค่าเพี้ยนตำแหน่ง แล้วอย่าลืมเติมค่าใน `itemsToRows` ให้ตรงตำแหน่งด้วย
 */
const HEADER = [
  "id", "name", "cat", "qty", "min", "note", "img", "link", "status", "price", "size", "variant", "ingredients",
  "source", "groupId", "groupName", "purchasedAt", "createdAt",
  "buyQty", "avgPrice", "priceHistory",
] as const;

/** 1→A (พอสำหรับ 26 คอลัมน์ — เกินกว่านี้ต้องเปลี่ยนวิธีคิดเป็นฐาน 26) */
const col = (n: number) => String.fromCharCode(64 + n);
const LAST_COL = col(HEADER.length);
const ITEMS_RANGE = `A1:${LAST_COL}100000`;
/** เก็บ categoryPresets ไว้ช่องถัดจากตารางสินค้า — ชีตเก่าที่ยังเก็บไว้ช่องอื่นจะอ่านไม่เจอ แล้วใช้ค่าในเครื่องแทน (ดู useGoogleSheetsSync.pull) */
const PRESETS_CELL = `${col(HEADER.length + 1)}1`;

function itemsToRows(items: StockItem[]): string[][] {
  return [
    [...HEADER],
    ...items.map((i) => {
      const stats = priceStats(i.priceHistory);
      return [
        i.id,
        i.name,
        i.cats.join("; "),
        String(i.qty),
        String(i.min),
        i.note,
        i.img || "",
        i.link || "",
        i.status || "",
        i.price != null ? String(i.price) : "",
        i.size || "",
        i.variant || "",
        i.ingredients || "",
        i.source || "",
        i.groupId || "",
        i.groupName || "",
        i.purchasedAt || "",
        i.createdAt || "",
        i.buyQty != null ? String(i.buyQty) : "",
        stats ? String(stats.avg) : "",
        // ประวัติราคาแบนเป็นข้อความบรรทัดเดียว — ชีตเป็น export อย่างเดียวอยู่แล้ว ไม่ต้อง parse กลับ
        (i.priceHistory ?? []).map((p) => `${p.date || "?"}@${p.price}x${p.qty}`).join("; "),
      ];
    }),
  ];
}

async function sheetsFetch(token: string, spreadsheetId: string, path: string, init?: RequestInit) {
  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}${path}`,
    { ...init, headers: { ...(init?.headers || {}), Authorization: `Bearer ${token}` } }
  );
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Google Sheets API error ${res.status}: ${body.slice(0, 200)}`);
  }
  return res.json();
}

export async function pushToSheet(
  token: string,
  spreadsheetId: string,
  items: StockItem[],
  categoryPresets: string[]
): Promise<void> {
  const rows = itemsToRows(items);
  await sheetsFetch(token, spreadsheetId, `/values/${ITEMS_RANGE}:clear`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{}",
  });
  await sheetsFetch(
    token,
    spreadsheetId,
    `/values/A1:${LAST_COL}${rows.length}?valueInputOption=RAW`,
    { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ values: rows }) }
  );
  await sheetsFetch(
    token,
    spreadsheetId,
    `/values/${PRESETS_CELL}?valueInputOption=RAW`,
    { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ values: [[categoryPresets.join(",")]] }) }
  );
}
