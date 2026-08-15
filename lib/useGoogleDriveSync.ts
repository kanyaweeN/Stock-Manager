"use client";

import { useEffect, useState } from "react";
import { countUnits, type StockDB } from "./db";
import { requestAccessToken } from "./googleAuth";
import { DRIVE_SCOPE, downloadDb, findDbFile, uploadDb } from "./googleDrive";

/** client id ใช้ร่วมกับ Google Sheets sync — เป็น OAuth client ตัวเดียวกัน */
const CLIENT_ID_KEY = "stock_manager_google_client_id";
const LEGACY_CLIENT_ID_KEY = "stock_manager_gs_client_id";
const REMEMBER_KEY = "stock_manager_drive_remember";

/** จัดการ state และ logic ของการซิงก์ฐานข้อมูลทั้งก้อนขึ้น Google Drive (appDataFolder) */
export function useGoogleDriveSync(db: StockDB, setDb: (updater: (prev: StockDB) => StockDB) => void) {
  const [clientId, setClientId] = useState("");
  const [token, setToken] = useState<string | null>(null);
  const [fileId, setFileId] = useState<string | null>(null);
  const [remoteTime, setRemoteTime] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState(false);
  const [origin, setOrigin] = useState("");

  useEffect(() => {
    const saved =
      localStorage.getItem(CLIENT_ID_KEY) ||
      localStorage.getItem(LEGACY_CLIENT_ID_KEY) ||
      process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ||
      "";
    setClientId(saved);
    setOrigin(window.location.origin);

    // เคยเชื่อมต่อไว้แล้ว → ลองขอ token เงียบๆ ไม่ต้องให้ผู้ใช้กดเอง
    if (saved && localStorage.getItem(REMEMBER_KEY) === "1") {
      setChecking(true);
      const onSuccess = async (t: string) => {
        setToken(t);
        try {
          const file = await findDbFile(t);
          setFileId(file?.id ?? null);
          setRemoteTime(file?.modifiedTime ?? null);
          setMessage(file ? "✅ เชื่อมต่ออัตโนมัติสำเร็จ" : "✅ เชื่อมต่อแล้ว — ยังไม่มีไฟล์บน Drive กด \"ส่งขึ้น Drive\" เพื่อสร้าง");
        } catch {
          setMessage("✅ เชื่อมต่ออัตโนมัติสำเร็จ");
        }
      };
      const silent = requestAccessToken(saved, DRIVE_SCOPE, true);
      // เผื่อ callback ไม่ยอมเรียกกลับ (เช่นเบราว์เซอร์บล็อก third-party cookie) — ไม่งั้นจะค้างที่ "กำลังตรวจสอบ"
      const timeout = new Promise<never>((_, reject) => setTimeout(() => reject(new Error("timeout")), 4000));
      Promise.race([silent, timeout])
        .then(onSuccess)
        .catch(() => {
          setMessage("⚠️ เชื่อมต่ออัตโนมัติไม่สำเร็จ (สิทธิ์อาจหมดอายุ) — กด \"เชื่อมต่อ Google\" เพื่อล็อกอินใหม่");
        })
        .finally(() => setChecking(false));
      silent.then(onSuccess).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const saveClientId = (next: string) => {
    setClientId(next);
    localStorage.setItem(CLIENT_ID_KEY, next);
  };

  const connect = async () => {
    if (!clientId.trim()) {
      setMessage("กรอก Client ID ก่อน");
      return;
    }
    setBusy(true);
    setMessage("กำลังเชื่อมต่อ...");
    try {
      const t = await requestAccessToken(clientId.trim(), DRIVE_SCOPE);
      setToken(t);
      localStorage.setItem(REMEMBER_KEY, "1");
      const file = await findDbFile(t);
      setFileId(file?.id ?? null);
      setRemoteTime(file?.modifiedTime ?? null);
      setMessage(
        file
          ? `✅ เชื่อมต่อสำเร็จ — เจอไฟล์บน Drive (แก้ล่าสุด ${new Date(file.modifiedTime).toLocaleString("th-TH")})`
          : "✅ เชื่อมต่อสำเร็จ — ยังไม่มีไฟล์บน Drive กด \"ส่งขึ้น Drive\" เพื่อสร้างไฟล์แรก"
      );
    } catch (e) {
      setMessage("เชื่อมต่อไม่สำเร็จ: " + (e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const push = async () => {
    if (!token) return;
    setBusy(true);
    setMessage("กำลังส่งข้อมูลขึ้น Google Drive...");
    try {
      const file = await uploadDb(token, db, fileId ?? undefined);
      setFileId(file.id);
      setRemoteTime(file.modifiedTime);
      setMessage(`✅ ส่งขึ้น Drive แล้ว · ${db.items.length} รายการ · ${new Date().toLocaleTimeString("th-TH")}`);
    } catch (e) {
      setMessage("ส่งข้อมูลไม่สำเร็จ: " + (e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const pull = async () => {
    if (!token) return;
    setBusy(true);
    setMessage("กำลังดึงข้อมูลจาก Google Drive...");
    try {
      const result = await downloadDb(token);
      if (!result) {
        setMessage("ยังไม่มีไฟล์บน Drive — ส่งขึ้นไปก่อน");
        return;
      }
      const incoming = result.db;
      const ok = confirm(
        `จะแทนที่ข้อมูลทั้งหมดในเครื่องด้วยข้อมูลจาก Drive\n\n` +
          `ในเครื่อง: ${db.items.length} รายการ (${countUnits(db.items)} หน่วย) · สูตร ${db.recipes?.length ?? 0}\n` +
          `บน Drive: ${incoming.items.length} รายการ (${countUnits(incoming.items)} หน่วย) · สูตร ${incoming.recipes?.length ?? 0}\n` +
          `Drive แก้ล่าสุด: ${new Date(result.file.modifiedTime).toLocaleString("th-TH")}\n\n` +
          `ต้องการดำเนินการต่อหรือไม่?`
      );
      if (!ok) {
        setMessage("ยกเลิกการดึงข้อมูล");
        return;
      }
      setFileId(result.file.id);
      setRemoteTime(result.file.modifiedTime);
      setDb(() => incoming);
      setMessage(`✅ ดึงข้อมูลมาแล้ว · ${incoming.items.length} รายการ`);
    } catch (e) {
      setMessage("ดึงข้อมูลไม่สำเร็จ: " + (e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const forget = () => {
    setToken(null);
    setFileId(null);
    setRemoteTime(null);
    localStorage.removeItem(REMEMBER_KEY);
    setMessage("เลิกจำการเชื่อมต่อแล้ว");
  };

  return { clientId, token, remoteTime, message, busy, checking, origin, saveClientId, connect, push, pull, forget };
}
