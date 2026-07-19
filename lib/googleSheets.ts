import { uid } from "./uid";
import type { StockItem } from "./types";

export const SHEETS_SCOPE = "https://www.googleapis.com/auth/spreadsheets";
const HEADER = ["id", "name", "cat", "qty", "min", "note", "img", "link", "status"] as const;
const ITEMS_RANGE = "A1:I100000";
const PRESETS_CELL = "K1";

declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient(config: {
            client_id: string;
            scope: string;
            callback: (resp: { access_token?: string; error?: string }) => void;
          }): { requestAccessToken(opts?: { prompt?: string }): void };
        };
      };
    };
  }
}

let gisLoadPromise: Promise<void> | null = null;

/** โหลด Google Identity Services script (สำหรับขอ OAuth token ฝั่ง client ล้วนๆ ไม่ต้องมี backend) */
export function loadGis(): Promise<void> {
  if (window.google?.accounts?.oauth2) return Promise.resolve();
  if (gisLoadPromise) return gisLoadPromise;
  gisLoadPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("โหลด Google Identity Services ไม่สำเร็จ"));
    document.head.appendChild(script);
  });
  return gisLoadPromise;
}

/**
 * ขอ access token จาก Google
 * - silent = true: ขอแบบเงียบๆ ไม่เด้ง popup (ใช้ตอนโหลดหน้าใหม่ ถ้าเคยเชื่อมต่อไว้แล้วและยัง login Google อยู่)
 *   ถ้า session หมดอายุหรือไม่เคยยินยอมสิทธิ์มาก่อน จะล้มเหลวเงียบๆ โดยไม่โชว์ popup ใดๆ
 * - silent = false (ค่าเริ่มต้น): เด้ง popup ให้ผู้ใช้ login/ยินยอมสิทธิ์เอง
 */
export async function requestAccessToken(clientId: string, silent = false): Promise<string> {
  await loadGis();
  return new Promise((resolve, reject) => {
    if (!window.google?.accounts?.oauth2) {
      reject(new Error("Google Identity Services ยังไม่พร้อม"));
      return;
    }
    const client = window.google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: SHEETS_SCOPE,
      callback: (resp) => {
        if (resp.error || !resp.access_token) reject(new Error(resp.error || "ขอ token ไม่สำเร็จ"));
        else resolve(resp.access_token);
      },
    });
    client.requestAccessToken(silent ? { prompt: "none" } : undefined);
  });
}

function itemsToRows(items: StockItem[]): string[][] {
  return [
    [...HEADER],
    ...items.map((i) => [
      i.id,
      i.name,
      i.cat,
      String(i.qty),
      String(i.min),
      i.note,
      i.img || "",
      i.link || "",
      i.status || "",
    ]),
  ];
}

function rowsToItems(rows: string[][]): StockItem[] {
  return rows.slice(1).filter((r) => r[1]).map((r) => ({
    id: r[0] || uid(),
    name: r[1] || "",
    cat: r[2] || "",
    qty: Number(r[3]) || 0,
    min: Number(r[4]) || 0,
    note: r[5] || "",
    img: r[6] || "",
    link: r[7] || "",
    status: (r[8] as StockItem["status"]) || "",
  }));
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
    `/values/A1:I${rows.length}?valueInputOption=RAW`,
    { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ values: rows }) }
  );
  await sheetsFetch(
    token,
    spreadsheetId,
    `/values/${PRESETS_CELL}?valueInputOption=RAW`,
    { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ values: [[categoryPresets.join(",")]] }) }
  );
}

export async function pullFromSheet(
  token: string,
  spreadsheetId: string
): Promise<{ items: StockItem[]; categoryPresets: string[] }> {
  const data = await sheetsFetch(token, spreadsheetId, `/values/${ITEMS_RANGE}`);
  const items = rowsToItems((data.values as string[][]) || []);
  const presetData = await sheetsFetch(token, spreadsheetId, `/values/${PRESETS_CELL}`);
  const presetCell: string = presetData.values?.[0]?.[0] || "";
  const categoryPresets = presetCell ? presetCell.split(",").map((s) => s.trim()).filter(Boolean) : [];
  return { items, categoryPresets };
}
