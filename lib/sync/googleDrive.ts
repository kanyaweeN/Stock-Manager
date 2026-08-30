import { migrateDB, type StockDB } from "@/lib/db";

/**
 * ซิงก์ฐานข้อมูลทั้งก้อนเป็นไฟล์ JSON ไฟล์เดียวใน Google Drive
 *
 * ใช้ `appDataFolder` — โฟลเดอร์ซ่อนของแอปที่ผู้ใช้มองไม่เห็นใน Drive (กันเผลอลบ/แก้)
 * และ scope นี้เข้าถึงได้เฉพาะไฟล์ที่แอปนี้สร้างเอง แตะไฟล์อื่นในไดรฟ์ไม่ได้เลย
 *
 * ต่างจาก Google Sheets sync ตรงที่ส่งทั้ง `StockDB` ไปเลย — เพิ่มฟิลด์ใหม่ในอนาคตไม่ต้องแก้ไฟล์นี้
 */
export const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.appdata";

const DB_FILENAME = "stock-manager-db.json";
const API = "https://www.googleapis.com/drive/v3";
const UPLOAD_API = "https://www.googleapis.com/upload/drive/v3";

export interface DriveFileInfo {
  id: string;
  /** เวลาที่แก้ล่าสุดฝั่ง Drive (ISO) — ใช้เตือนก่อนเขียนทับ */
  modifiedTime: string;
}

async function driveFetch(token: string, url: string, init?: RequestInit) {
  const res = await fetch(url, {
    ...init,
    headers: { ...(init?.headers || {}), Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Google Drive API error ${res.status}: ${body.slice(0, 200)}`);
  }
  return res;
}

/** หาไฟล์ฐานข้อมูลใน appDataFolder — ยังไม่เคยซิงก์จะได้ null */
export async function findDbFile(token: string): Promise<DriveFileInfo | null> {
  const params = new URLSearchParams({
    spaces: "appDataFolder",
    q: `name = '${DB_FILENAME}' and trashed = false`,
    fields: "files(id,modifiedTime)",
    pageSize: "1",
  });
  const res = await driveFetch(token, `${API}/files?${params}`);
  const data = (await res.json()) as { files?: DriveFileInfo[] };
  return data.files?.[0] ?? null;
}

/** เขียนทั้ง db ทับไฟล์เดิม (หรือสร้างใหม่ถ้ายังไม่มี) */
export async function uploadDb(token: string, db: StockDB, existingId?: string): Promise<DriveFileInfo> {
  const json = JSON.stringify({ ...db, updatedAt: new Date().toISOString() }, null, 2);

  if (existingId) {
    const res = await driveFetch(
      token,
      `${UPLOAD_API}/files/${existingId}?uploadType=media&fields=id,modifiedTime`,
      { method: "PATCH", headers: { "Content-Type": "application/json" }, body: json }
    );
    return (await res.json()) as DriveFileInfo;
  }

  // สร้างไฟล์ใหม่ต้องส่ง metadata (ชื่อ + ให้อยู่ใน appDataFolder) มาพร้อมเนื้อไฟล์ → multipart
  const boundary = `stockmanager-${Date.now()}`;
  const metadata = { name: DB_FILENAME, parents: ["appDataFolder"], mimeType: "application/json" };
  const body =
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n` +
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${json}\r\n` +
    `--${boundary}--`;
  const res = await driveFetch(token, `${UPLOAD_API}/files?uploadType=multipart&fields=id,modifiedTime`, {
    method: "POST",
    headers: { "Content-Type": `multipart/related; boundary=${boundary}` },
    body,
  });
  return (await res.json()) as DriveFileInfo;
}

/** ดึงไฟล์จาก Drive มา migrate เป็น StockDB — คืน null ถ้ายังไม่เคยมีไฟล์บน Drive */
export async function downloadDb(token: string): Promise<{ db: StockDB; file: DriveFileInfo } | null> {
  const file = await findDbFile(token);
  if (!file) return null;
  const res = await driveFetch(token, `${API}/files/${file.id}?alt=media`);
  const text = await res.text();
  if (!text.trim()) return null;
  return { db: migrateDB(JSON.parse(text)), file };
}
