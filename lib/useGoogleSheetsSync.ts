"use client";

import { useEffect, useState } from "react";
import type { StockDB } from "./db";
import { requestAccessToken } from "./googleAuth";
import { SHEETS_SCOPE, pushToSheet } from "./googleSheets";

/** client id ใช้ร่วมกับ Google Drive sync — เป็น OAuth client ตัวเดียวกัน (key เก่าไว้รองรับคนที่ตั้งค่าไว้แล้ว) */
const CLIENT_ID_KEY = "stock_manager_google_client_id";
const GS_CLIENT_ID_KEY = "stock_manager_gs_client_id";
const GS_SHEET_ID_KEY = "stock_manager_gs_sheet_id";
const GS_REMEMBER_KEY = "stock_manager_gs_remember";

/**
 * จัดการการส่งออกรายการสินค้าไป Google Sheet — **ส่งขึ้นอย่างเดียว ไม่มีดึงกลับ**
 * ถ้าต้องการซิงก์/กู้คืนข้อมูลจริง ใช้ `useGoogleDriveSync` (เก็บ StockDB ทั้งก้อนเป็น JSON)
 */
export function useGoogleSheetsSync(db: StockDB) {
  const [clientId, setClientId] = useState("");
  const [sheetId, setSheetId] = useState("");
  const [token, setToken] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [origin, setOrigin] = useState("");
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    // ถ้าเคยตั้งค่าไว้ในเบราว์เซอร์นี้แล้วใช้ค่านั้นก่อน ไม่งั้น fallback ไปใช้ค่า default จาก env
    // (ตั้งใน .env.local เป็น NEXT_PUBLIC_GOOGLE_CLIENT_ID / NEXT_PUBLIC_GOOGLE_SHEET_ID)
    // เพื่อไม่ต้องกรอกเองทุกครั้งที่เปิดเบราว์เซอร์ใหม่/ล้าง localStorage
    const savedClientId =
      localStorage.getItem(CLIENT_ID_KEY) ||
      localStorage.getItem(GS_CLIENT_ID_KEY) ||
      process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ||
      "";
    const savedSheetId = localStorage.getItem(GS_SHEET_ID_KEY) || process.env.NEXT_PUBLIC_GOOGLE_SHEET_ID || "";
    setClientId(savedClientId);
    setSheetId(savedSheetId);
    setOrigin(window.location.origin);

    // ถ้าเคยเชื่อมต่อสำเร็จมาก่อน ลองขอ token แบบเงียบๆ (ไม่เด้ง popup) — ถ้า session Google ยังอยู่จะไม่ต้อง login ใหม่
    if (savedClientId && localStorage.getItem(GS_REMEMBER_KEY) === "1") {
      setChecking(true);
      const onSuccess = (t: string) => {
        setToken(t);
        setMessage("✅ เชื่อมต่ออัตโนมัติสำเร็จ");
      };
      const silent = requestAccessToken(savedClientId, SHEETS_SCOPE, true);
      // เผื่อ callback ไม่ยอมเรียกกลับเลย (เช่น browser บล็อก third-party cookie) — ไม่งั้นจะค้างที่ "กำลังตรวจสอบ" ตลอดไป
      const timeout = new Promise<never>((_, reject) => setTimeout(() => reject(new Error("timeout")), 4000));
      Promise.race([silent, timeout])
        .then(onSuccess)
        .catch(() => {
          setMessage("⚠️ เชื่อมต่ออัตโนมัติไม่สำเร็จ (สิทธิ์อาจหมดอายุ) — กด \"เชื่อมต่อ Google\" เพื่อล็อกอินใหม่");
        })
        .finally(() => setChecking(false));
      // ถ้า silent มาสำเร็จช้ากว่า timeout ก็ยังอัปเดตให้ภายหลังได้ ไม่ต้องรอ user กดใหม่
      silent.then(onSuccess).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const saveSettings = (nextClientId: string, nextSheetId: string) => {
    setClientId(nextClientId);
    setSheetId(nextSheetId);
    localStorage.setItem(CLIENT_ID_KEY, nextClientId);
    localStorage.setItem(GS_SHEET_ID_KEY, nextSheetId);
  };

  const connect = async () => {
    if (!clientId.trim() || !sheetId.trim()) {
      setMessage("กรอก Client ID และ Spreadsheet ID ให้ครบก่อน");
      return;
    }
    setBusy(true);
    setMessage("กำลังเชื่อมต่อ...");
    try {
      const t = await requestAccessToken(clientId.trim(), SHEETS_SCOPE);
      setToken(t);
      localStorage.setItem(GS_REMEMBER_KEY, "1");
      setMessage("กำลังส่งข้อมูลขึ้น Sheet ครั้งแรก...");
      await pushToSheet(t, sheetId.trim(), db.items, db.categoryPresets);
      setMessage(`✅ เชื่อมต่อและส่งข้อมูลขึ้น Sheet สำเร็จ · ${db.items.length} รายการ`);
    } catch (e) {
      setMessage("เชื่อมต่อไม่สำเร็จ: " + (e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const push = async () => {
    if (!token) return;
    setBusy(true);
    setMessage("กำลังส่งข้อมูลขึ้น Google Sheet...");
    try {
      await pushToSheet(token, sheetId.trim(), db.items, db.categoryPresets);
      setMessage(`✅ ส่งขึ้น Sheet แล้ว · ${db.items.length} รายการ · ${new Date().toLocaleTimeString("th-TH")}`);
    } catch (e) {
      setMessage("ส่งข้อมูลไม่สำเร็จ: " + (e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const forget = () => {
    setToken(null);
    localStorage.removeItem(GS_REMEMBER_KEY);
    setMessage("เลิกจำการเชื่อมต่อแล้ว");
  };

  return { clientId, sheetId, token, message, busy, checking, origin, saveSettings, connect, push, forget };
}
