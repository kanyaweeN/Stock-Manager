"use client";

import { useEffect, useState } from "react";
import type { StockDB } from "./db";
import { pullFromSheet, pushToSheet, requestAccessToken } from "./googleSheets";

const GS_CLIENT_ID_KEY = "stock_manager_gs_client_id";
const GS_SHEET_ID_KEY = "stock_manager_gs_sheet_id";
const GS_REMEMBER_KEY = "stock_manager_gs_remember";

/** จัดการ state และ logic ทั้งหมดของการเชื่อมต่อ/ซิงก์ข้อมูลกับ Google Sheets */
export function useGoogleSheetsSync(db: StockDB, setDb: (updater: (prev: StockDB) => StockDB) => void) {
  const [clientId, setClientId] = useState("");
  const [sheetId, setSheetId] = useState("");
  const [token, setToken] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [origin, setOrigin] = useState("");

  useEffect(() => {
    const savedClientId = localStorage.getItem(GS_CLIENT_ID_KEY) || "";
    const savedSheetId = localStorage.getItem(GS_SHEET_ID_KEY) || "";
    setClientId(savedClientId);
    setSheetId(savedSheetId);
    setOrigin(window.location.origin);

    // ถ้าเคยเชื่อมต่อสำเร็จมาก่อน ลองขอ token แบบเงียบๆ (ไม่เด้ง popup) — ถ้า session Google ยังอยู่จะไม่ต้อง login ใหม่
    if (savedClientId && localStorage.getItem(GS_REMEMBER_KEY) === "1") {
      requestAccessToken(savedClientId, true)
        .then((t) => {
          setToken(t);
          setMessage("✅ เชื่อมต่ออัตโนมัติสำเร็จ");
        })
        .catch(() => {
          // เงียบไว้ — ผู้ใช้กด "เชื่อมต่อ Google" เองได้ถ้าต้องการ
        });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const saveSettings = (nextClientId: string, nextSheetId: string) => {
    setClientId(nextClientId);
    setSheetId(nextSheetId);
    localStorage.setItem(GS_CLIENT_ID_KEY, nextClientId);
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
      const t = await requestAccessToken(clientId.trim());
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

  const pull = async () => {
    if (!token) return;
    const ok = confirm("จะดึงข้อมูลจาก Google Sheet มาแทนที่ข้อมูลปัจจุบันในเครื่อง ต้องการดำเนินการต่อหรือไม่?");
    if (!ok) return;
    setBusy(true);
    setMessage("กำลังดึงข้อมูลจาก Google Sheet...");
    try {
      const pulled = await pullFromSheet(token, sheetId.trim());
      setDb((prev) => ({
        ...prev,
        items: pulled.items,
        categoryPresets: pulled.categoryPresets.length ? pulled.categoryPresets : prev.categoryPresets,
      }));
      setMessage(`✅ ดึงข้อมูลมาแล้ว · ${pulled.items.length} รายการ`);
    } catch (e) {
      setMessage("ดึงข้อมูลไม่สำเร็จ: " + (e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const forget = () => {
    setToken(null);
    localStorage.removeItem(GS_REMEMBER_KEY);
    setMessage("เลิกจำการเชื่อมต่อแล้ว");
  };

  return { clientId, sheetId, token, message, busy, origin, saveSettings, connect, push, pull, forget };
}
