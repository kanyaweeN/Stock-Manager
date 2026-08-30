"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { StockDB } from "@/lib/db";
import { countUnits } from "@/lib/domain/stock";
import { requestAccessToken } from "@/lib/sync/googleAuth";
import { DRIVE_SCOPE, downloadDb, findDbFile, uploadDb, type DriveFileInfo } from "@/lib/sync/googleDrive";

/** client id ใช้ร่วมกับ Google Sheets sync — เป็น OAuth client ตัวเดียวกัน */
const CLIENT_ID_KEY = "stock_manager_google_client_id";
const LEGACY_CLIENT_ID_KEY = "stock_manager_gs_client_id";
const REMEMBER_KEY = "stock_manager_drive_remember";
/** เปิด/ปิดการส่งขึ้น Drive อัตโนมัติ (ไม่ได้ตั้งไว้ = เปิด) */
const AUTOSYNC_KEY = "stock_manager_drive_autosync";
/** สภาพไฟล์บน Drive ณ ครั้งล่าสุดที่ "เครื่องนี้" ซิงก์สำเร็จ — ใช้ดูว่ามีใครแก้ไฟล์หลังจากนั้นไหม และของในเครื่องหายไปหรือเปล่า */
const SEEN_KEY = "stock_manager_drive_seen";
/** หน่วงก่อนส่งขึ้น Drive อัตโนมัติ — กดแก้ของรัวๆ จะได้ยิงขึ้นรอบเดียว */
const AUTO_PUSH_DELAY_MS = 30_000;

export interface DbCounts {
  items: number;
  recipes: number;
  plans: number;
  /** ของในถังขยะ — ยังอยู่ในไฟล์เดียวกันและกู้คืนได้ ดู `dataItems` */
  trash: number;
}

interface SeenState extends DbCounts {
  /** modifiedTime ของไฟล์บน Drive ที่เครื่องนี้เห็นล่าสุด */
  modifiedTime: string;
}

const countsOf = (db: StockDB): DbCounts => ({
  items: db.items.length,
  recipes: db.recipes?.length ?? 0,
  plans: db.plans?.length ?? 0,
  trash: db.trash?.length ?? 0,
});

/**
 * จำนวนสินค้าที่ยัง "อยู่ในไฟล์" = ในสต็อก + ในถังขยะ
 *
 * ตัวเลขที่ใช้ตรวจความเสี่ยงก่อนเขียนทับต้องเป็นตัวนี้ ไม่ใช่ `items` เฉยๆ เพราะการลบของ
 * ลงถังขยะไม่ได้ทำให้ข้อมูลหาย (ยังกู้คืนได้และยังไปกับไฟล์เดียวกัน) — ถ้านับแต่ `items`
 * การเลือกลบทีเดียวหลายสิบชิ้นจะถูกมองว่า "ลบไปเยอะผิดปกติ" แล้วหยุดซิงก์อัตโนมัติทิ้ง
 * ทั้งที่ไม่มีอะไรหายจริง ส่วนการล้างถังขยะถาวรยังทำให้ตัวเลขนี้ลด = ยังเตือนได้เหมือนเดิม
 *
 * `seen` ที่บันทึกไว้ก่อนมีถังขยะจะไม่มีฟิลด์นี้ — นับเป็น 0
 */
const dataItems = (c: DbCounts) => c.items + (c.trash ?? 0);

/** ค่าที่เอาไปเทียบความเสี่ยงของแต่ละหมวด — เฉพาะสินค้าที่ต้องนับรวมถังขยะ */
const riskValue = (c: DbCounts, key: keyof DbCounts) => (key === "items" ? dataItems(c) : c[key]);

const readSeen = (): SeenState | null => {
  try {
    const raw = localStorage.getItem(SEEN_KEY);
    return raw ? (JSON.parse(raw) as SeenState) : null;
  } catch {
    return null;
  }
};

const writeSeen = (file: DriveFileInfo, db: StockDB) => {
  try {
    localStorage.setItem(SEEN_KEY, JSON.stringify({ modifiedTime: file.modifiedTime, ...countsOf(db) }));
  } catch {
    // ignore — localStorage เต็ม/ถูกปิด ไม่ถึงกับพัง แค่เตือนก่อนเขียนทับได้แม่นน้อยลง
  }
};

/** หมวดที่เอามาเทียบความเสี่ยง — ไม่มี `trash` แยกเพราะถูกนับรวมอยู่ใน `items` แล้ว (ดู `dataItems`) */
const COUNT_LABELS: [keyof DbCounts, string][] = [
  ["items", "สินค้า"],
  ["recipes", "สูตรต้นทุน"],
  ["plans", "แผนซื้อของ"],
];

/** ลบเยอะขนาดไหนถึงจะถือว่า "ผิดปกติ" จนต้องถามก่อนส่งขึ้น — ลบทีละชิ้นสองชิ้นตามปกติต้องไม่โดนถาม */
const BULK_DROP_MIN = 10;
const BULK_DROP_RATIO = 0.3;

/**
 * ตรวจก่อนเขียนทับไฟล์บน Drive ว่ากำลังทับของดีด้วยของที่ไม่ครบอยู่หรือเปล่า
 *
 * เคสที่อันตรายที่สุดคือเปิดแอปในที่ที่ข้อมูลในเครื่องไม่ครบ (เปิดผิดพอร์ต/โดนล้าง site data
 * จนเจอแอปเปล่า) แล้วส่งขึ้น Drive ทับไฟล์ที่มีข้อมูลจริง — กู้กลับไม่ได้เลยเพราะบน Drive มีไฟล์เดียว
 *
 * สังเกตว่าเทียบ "จำนวนตอนเปิดแอป" (`loaded`) กับบน Drive ไม่ใช่จำนวนปัจจุบัน — เพราะการที่
 * ตอนนี้มีน้อยกว่าบน Drive เป็นเรื่องปกติของการลบของทิ้งเอง ส่วนที่ผิดปกติจริงๆ คือ
 * "เปิดแอปขึ้นมาก็ไม่ครบตั้งแต่แรกแล้ว" ที่เหลือดูจากการลบรวดเดียวเยอะผิดปกติในรอบนี้แทน
 * คืนรายการเหตุผลเป็นภาษาไทย, ว่างเปล่า = ปลอดภัย ส่งขึ้นได้เลย
 *
 * `export` ไว้ให้เทสต์เรียกได้ (ดู lib/__tests__/driveSync.test.ts) — ตรรกะนี้เป็นด่านสุดท้าย
 * ก่อนเขียนทับไฟล์เดียวที่มีบน Drive ถ้าพลาดคือข้อมูลหายถาวร แต่ทดสอบผ่าน UI ไม่ได้เพราะ
 * ต้องล็อกอิน Google จริง จึงต้องครอบด้วยเทสต์ให้แน่น
 */
export function overwriteRisks(
  current: DbCounts,
  loaded: DbCounts,
  remote: DbCounts | null,
  remoteChangedElsewhere: boolean,
  neverSynced: boolean
): string[] {
  const risks: string[] = [];
  for (const [key, label] of COUNT_LABELS) {
    const cur = riskValue(current, key);
    const was = riskValue(loaded, key);
    const there = remote ? riskValue(remote, key) : 0;
    if (remote && was < there) {
      risks.push(
        `ตอนเปิดแอป ${label}ในเครื่องมี ${was} แต่บน Drive มี ${there} — ข้อมูลในเครื่องอาจไม่ครบตั้งแต่แรก`
      );
    } else if (cur < was && was - cur >= BULK_DROP_MIN && was - cur >= was * BULK_DROP_RATIO) {
      risks.push(`${label}หายไป ${was - cur} จาก ${was} ตั้งแต่เปิดแอปรอบนี้ — ลบไปเยอะผิดปกติ`);
    }
  }
  if (remoteChangedElsewhere) {
    risks.push("ไฟล์บน Drive ถูกแก้หลังจากเครื่องนี้ซิงก์ครั้งล่าสุด (อาจแก้จากอีกเครื่อง) — ควรดึงจาก Drive มาดูก่อน");
  }
  if (neverSynced) {
    risks.push("เครื่อง/เบราว์เซอร์นี้ยังไม่เคยซิงก์กับไฟล์บน Drive มาก่อน");
  }
  return risks;
}

/**
 * จัดการ state และ logic ของการซิงก์ฐานข้อมูลทั้งก้อนขึ้น Google Drive (appDataFolder)
 *
 * `ready` = โหลดข้อมูลจากที่เก็บในเครื่องเสร็จแล้ว — ต้องรอเสมอ ไม่งั้นการซิงก์อัตโนมัติอาจส่ง
 * `DEFAULT_DB` (ว่างเปล่า) ขึ้นไปทับไฟล์จริงตั้งแต่แอปยังโหลดไม่เสร็จ
 */
export function useGoogleDriveSync(
  db: StockDB,
  setDb: (updater: (prev: StockDB) => StockDB) => void,
  ready = true
) {
  const [clientId, setClientId] = useState("");
  const [token, setToken] = useState<string | null>(null);
  const [fileId, setFileId] = useState<string | null>(null);
  const [remoteTime, setRemoteTime] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState(false);
  const [origin, setOrigin] = useState("");
  const [autoSync, setAutoSyncState] = useState(false);
  /** มีอะไรแก้ไว้แล้วยังไม่ได้ส่งขึ้น Drive */
  const [dirty, setDirty] = useState(false);
  /** ซิงก์อัตโนมัติถูกหยุดไว้เพราะรอบล่าสุดดูเสี่ยงหรือพลาด — ต้องให้ผู้ใช้ตัดสินใจเอง */
  const [autoPaused, setAutoPaused] = useState(false);

  // ค่าล่าสุดสำหรับ callback ที่ไม่อยากผูก dependency (ไม่งั้น timer ของ auto-push จะถูกรีเซ็ตทุกครั้งที่ db เปลี่ยน)
  const dbRef = useRef(db);
  dbRef.current = db;
  const tokenRef = useRef<string | null>(null);
  tokenRef.current = token;
  const clientIdRef = useRef("");
  clientIdRef.current = clientId;
  const busyRef = useRef(false);
  /** ก้อนข้อมูลก้อนแรกที่โหลดขึ้นมา — ตัวนี้ไม่ใช่ "การแก้ไข" จึงไม่นับว่าค้างซิงก์ */
  const baselineRef = useRef<StockDB | null>(null);
  /** จำนวนของตอนเปิดแอป (อัปเดตทุกครั้งที่ซิงก์สำเร็จ) — ใช้แยก "ลบเอง" ออกจาก "ข้อมูลในเครื่องหาย" */
  const loadedCountsRef = useRef<DbCounts | null>(null);

  useEffect(() => {
    const saved =
      localStorage.getItem(CLIENT_ID_KEY) ||
      localStorage.getItem(LEGACY_CLIENT_ID_KEY) ||
      process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ||
      "";
    setClientId(saved);
    setOrigin(window.location.origin);
    setAutoSyncState(localStorage.getItem(AUTOSYNC_KEY) !== "0");

    // เคยเชื่อมต่อไว้แล้ว → ลองขอ token เงียบๆ ไม่ต้องให้ผู้ใช้กดเอง
    if (saved && localStorage.getItem(REMEMBER_KEY) === "1") {
      setChecking(true);
      // กันยิงซ้ำ — ทั้ง `Promise.race` และ `silent.then` ข้างล่างต่างก็เรียกตัวนี้ ในกรณีปกติ
      // (silent เสร็จก่อน timeout) มันจะติดทั้งคู่ แล้ว `findDbFile` ถูกเรียกสองรอบทุกครั้งที่เปิดแอป
      let handled = false;
      const onSuccess = async (t: string) => {
        if (handled) return;
        handled = true;
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
      // เผื่อ token มาช้ากว่า 4 วิ (timeout ชนะไปแล้ว) — ยังรับไว้ให้เชื่อมต่อสำเร็จ ไม่ต้องกดเอง
      silent.then(onSuccess).catch(() => {});
    }
     
  }, []);

  const saveClientId = (next: string) => {
    setClientId(next);
    localStorage.setItem(CLIENT_ID_KEY, next);
  };

  const setAutoSync = (on: boolean) => {
    setAutoSyncState(on);
    localStorage.setItem(AUTOSYNC_KEY, on ? "1" : "0");
    if (on) setAutoPaused(false);
  };

  /** token หมดอายุราวชั่วโมงละครั้ง — โดน 401 ให้ขอใหม่เงียบๆ แล้วลองซ้ำหนึ่งรอบ ไม่งั้นซิงก์อัตโนมัติจะตายเงียบๆ */
  const withToken = useCallback(async <T,>(fn: (t: string) => Promise<T>): Promise<T> => {
    const current = tokenRef.current;
    if (!current) throw new Error("ยังไม่ได้เชื่อมต่อ Google");
    try {
      return await fn(current);
    } catch (e) {
      if (!/\b401\b/.test((e as Error).message) || !clientIdRef.current) throw e;
      const fresh = await requestAccessToken(clientIdRef.current, DRIVE_SCOPE, true);
      tokenRef.current = fresh;
      setToken(fresh);
      return await fn(fresh);
    }
  }, []);

  const markSynced = useCallback((file: DriveFileInfo, synced: StockDB) => {
    setFileId(file.id);
    setRemoteTime(file.modifiedTime);
    writeSeen(file, synced);
    baselineRef.current = synced;
    loadedCountsRef.current = countsOf(synced);
    // แก้เพิ่มระหว่างที่กำลังอัปโหลด = ยังค้างอยู่ ไม่ถือว่าซิงก์ครบ
    setDirty(dbRef.current !== synced);
    setAutoPaused(false);
  }, []);

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
      tokenRef.current = t;
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

  /**
   * ส่งข้อมูลทั้งก้อนขึ้น Drive — ตรวจสภาพไฟล์ปลายทางก่อนเขียนทับเสมอ (ดู `overwriteRisks`)
   * `auto: true` = ซิงก์อัตโนมัติ ห้ามเด้ง confirm ใส่หน้าผู้ใช้ เจอความเสี่ยงให้หยุดรอคนตัดสินใจแทน
   */
  const push = useCallback(
    async ({ auto = false }: { auto?: boolean } = {}) => {
      if (!tokenRef.current || busyRef.current) return false;
      busyRef.current = true;
      setBusy(true);
      if (!auto) setMessage("กำลังส่งข้อมูลขึ้น Google Drive...");
      const pushing = dbRef.current;
      try {
        const seen = readSeen();
        const meta = await withToken(findDbFile);
        let risks: string[] = [];

        if (meta) {
          const changedElsewhere = !!seen && meta.modifiedTime !== seen.modifiedTime;
          let remoteCounts: DbCounts | null;
          if (changedElsewhere || !seen) {
            // ไฟล์ถูกแก้จากที่อื่น (หรือเครื่องนี้ยังไม่เคยซิงก์) → เปิดไฟล์จริงมานับ ไม่เดาจากที่จำไว้
            const remote = await withToken(downloadDb);
            remoteCounts = remote ? countsOf(remote.db) : null;
          } else {
            // ไม่มีใครแตะไฟล์ตั้งแต่เราส่งขึ้นครั้งล่าสุด → เนื้อไฟล์คือสิ่งที่จำไว้ ไม่ต้องโหลดมาทั้งก้อน
            remoteCounts = { items: seen.items, recipes: seen.recipes, plans: seen.plans, trash: seen.trash ?? 0 };
          }
          const pushingCounts = countsOf(pushing);
          risks = overwriteRisks(pushingCounts, loadedCountsRef.current ?? pushingCounts, remoteCounts, changedElsewhere, !seen);
        }

        if (risks.length) {
          if (auto) {
            setAutoPaused(true);
            setMessage(
              `⛔️ หยุดซิงก์อัตโนมัติไว้ก่อน — ${risks.join(" · ")} · กด "ส่งขึ้น Drive" เองถ้ายืนยันว่าข้อมูลในเครื่องถูกต้อง`
            );
            return false;
          }
          const detail =
            `⚠️ กำลังจะเขียนทับไฟล์บน Drive\n\n${risks.map((r) => `• ${r}`).join("\n")}\n\n` +
            `ในเครื่อง: ${pushing.items.length} รายการ (${countUnits(pushing.items)} หน่วย) · สูตร ${pushing.recipes?.length ?? 0}\n` +
            (meta ? `Drive แก้ล่าสุด: ${new Date(meta.modifiedTime).toLocaleString("th-TH")}\n` : "") +
            `\nไฟล์บน Drive มีชุดเดียว เขียนทับแล้วกู้คืนไม่ได้ — ยืนยันส่งขึ้นหรือไม่?`;
          if (!confirm(detail)) {
            setMessage("ยกเลิกการส่งข้อมูล");
            return false;
          }
        }

        const file = await withToken((t) => uploadDb(t, pushing, meta?.id ?? fileId ?? undefined));
        markSynced(file, pushing);
        setMessage(
          `✅ ${auto ? "ซิงก์อัตโนมัติแล้ว" : "ส่งขึ้น Drive แล้ว"} · ${pushing.items.length} รายการ · ${new Date().toLocaleTimeString("th-TH")}`
        );
        return true;
      } catch (e) {
        if (auto) setAutoPaused(true);
        setMessage(`${auto ? "ซิงก์อัตโนมัติไม่สำเร็จ" : "ส่งข้อมูลไม่สำเร็จ"}: ${(e as Error).message}`);
        return false;
      } finally {
        busyRef.current = false;
        setBusy(false);
      }
    },
    [fileId, markSynced, withToken]
  );

  const pull = async () => {
    if (!tokenRef.current || busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setMessage("กำลังดึงข้อมูลจาก Google Drive...");
    try {
      const result = await withToken(downloadDb);
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
      setDb(() => incoming);
      // ของที่เพิ่งดึงมาตรงกับบน Drive อยู่แล้ว ไม่ต้องส่งกลับขึ้นไปอีก
      markSynced(result.file, incoming);
      setDirty(false);
      setMessage(`✅ ดึงข้อมูลมาแล้ว · ${incoming.items.length} รายการ`);
    } catch (e) {
      setMessage("ดึงข้อมูลไม่สำเร็จ: " + (e as Error).message);
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  const forget = () => {
    setToken(null);
    tokenRef.current = null;
    setFileId(null);
    setRemoteTime(null);
    localStorage.removeItem(REMEMBER_KEY);
    setMessage("เลิกจำการเชื่อมต่อแล้ว");
  };

  // ─── ซิงก์อัตโนมัติ ──────────────────────────────────────────
  /*
   * ก้อนแรกที่โหลดขึ้นมาไม่ใช่การแก้ไข แต่ถ้าจำนวนไม่ตรงกับที่เคยส่งขึ้น Drive ครั้งล่าสุด
   * แปลว่ารอบก่อนแก้แล้วยังไม่ได้ซิงก์ (ปิดแท็บ/เน็ตหลุดไปก่อน) — ต้องส่งขึ้นให้ครบ
   */
  useEffect(() => {
    if (!ready) return;
    if (baselineRef.current === null) {
      baselineRef.current = db;
      const seen = readSeen();
      const local = countsOf(db);
      loadedCountsRef.current = local;
      setDirty(!seen || COUNT_LABELS.some(([k]) => local[k] !== seen[k]));
      return;
    }
    if (baselineRef.current !== db) setDirty(true);
  }, [db, ready]);

  useEffect(() => {
    if (!autoSync || !token || !dirty || autoPaused || busy) return;
    const t = setTimeout(() => void push({ auto: true }), AUTO_PUSH_DELAY_MS);
    return () => clearTimeout(t);
  }, [autoSync, token, dirty, autoPaused, busy, push]);

  // สลับแท็บ/ย่อหน้าจอทิ้งไว้ = อาจไม่ได้กลับมาอีกเลย ของที่ค้างต้องรีบส่งขึ้นไป ไม่ต้องรอครบเวลาหน่วง
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState !== "hidden") return;
      if (!autoSync || !tokenRef.current || !dirty || autoPaused || busyRef.current) return;
      void push({ auto: true });
    };
    document.addEventListener("visibilitychange", onHide);
    return () => document.removeEventListener("visibilitychange", onHide);
  }, [autoSync, dirty, autoPaused, push]);

  return {
    clientId, token, remoteTime, message, busy, checking, origin,
    autoSync, setAutoSync, dirty, autoPaused,
    saveClientId, connect, push, pull, forget,
  };
}
