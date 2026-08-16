"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { DEFAULT_DB, migrateDB, type StockDB } from "./db";

const DB_FILENAME = "stock-manager-db.json";
const LS_KEY = "stock_manager_db_v1";
/** หน่วงก่อนเขียนไฟล์ — กดปุ่ม +/- รัวๆ จะได้เขียนรอบเดียวแทนที่จะเขียนทั้งก้อนทุกคลิก */
const SAVE_DEBOUNCE_MS = 500;

interface WritableLike {
  write(data: string): Promise<void>;
  close(): Promise<void>;
}
interface FileHandleLike {
  name: string;
  createWritable(): Promise<WritableLike>;
}
interface OPFSHandleLike extends FileHandleLike {
  getFile(): Promise<{ text(): Promise<string> }>;
}

export type DbStatus = { type: "loading" | "ok" | "err"; msg: string };

type ExperimentalWindow = Window & {
  showSaveFilePicker?(opts: {
    suggestedName: string;
    types: { description: string; accept: Record<string, string[]> }[];
  }): Promise<FileHandleLike>;
};
type ExperimentalNavigator = Navigator & {
  storage: {
    getDirectory(): Promise<{ getFileHandle(name: string, opts: { create: boolean }): Promise<OPFSHandleLike> }>;
  };
};

/**
 * บันทึกข้อมูลจริงลงไฟล์ (OPFS) แทน localStorage ล้วนๆ — ทำงานคล้ายกับแอปในกลุ่ม investment-tools
 * ลำดับความสำคัญ: OPFS (ไฟล์จริงในเบราว์เซอร์) → localStorage (สำรอง) → ไฟล์บนเครื่องที่ผู้ใช้เลือกผูกไว้ (ถ้ามี)
 */
export function usePersistedStockDB() {
  const [db, setDb] = useState<StockDB>(DEFAULT_DB);
  const [loaded, setLoaded] = useState(false);
  const [status, setStatus] = useState<DbStatus>({ type: "loading", msg: "⏳ กำลังโหลด..." });
  const [linkedFile, setLinkedFile] = useState<FileHandleLike | null>(null);

  const opfsHandleRef = useRef<OPFSHandleLike | null>(null);

  const persist = useCallback(
    async (data: StockDB) => {
      const withTimestamp = { ...data, updatedAt: new Date().toISOString() };
      // OPFS/localStorage เป็นที่เก็บของเครื่อง ไม่มีใครเปิดอ่านด้วยตา — เขียนแบบไม่จัดรูปแบบเล็กลงเยอะ
      // (localStorage มีเพดานราว 5MB ต่อโดเมน การเว้นวรรคทิ้งกินโควตาฟรีๆ)
      // ส่วนไฟล์บนเครื่องที่ผู้ใช้เลือกผูกเอาไว้เปิดอ่าน/แก้เอง ยังจัดรูปแบบให้อยู่ข้างล่าง
      const json = JSON.stringify(withTimestamp);
      const savedTo: string[] = [];
      const failedTo: string[] = [];

      try {
        if (opfsHandleRef.current) {
          const w = await opfsHandleRef.current.createWritable();
          await w.write(json);
          await w.close();
          savedTo.push("ไฟล์ OPFS ในเบราว์เซอร์");
        }
      } catch (e) {
        console.warn("OPFS write failed:", e);
        failedTo.push("OPFS");
      }
      try {
        localStorage.setItem(LS_KEY, json);
        savedTo.push("localStorage");
      } catch {
        // ignore — localStorage อาจเต็มหรือถูกปิดใช้งาน
        failedTo.push("localStorage");
      }
      if (linkedFile) {
        try {
          const w = await linkedFile.createWritable();
          await w.write(JSON.stringify(withTimestamp, null, 2));
          await w.close();
          savedTo.push(`ไฟล์ "${linkedFile.name}" บนเครื่อง`);
        } catch (e) {
          console.warn("FS write failed:", e);
          failedTo.push(`ไฟล์ "${linkedFile.name}"`);
        }
      }

      const time = new Date().toLocaleTimeString("th-TH");
      const failTip = failedTo.length ? ` · ⚠ บันทึกไม่สำเร็จ: ${failedTo.join(", ")}` : "";
      setStatus({
        type: failedTo.length && savedTo.length === 0 ? "err" : "ok",
        msg: `✅ บันทึกแล้วที่ ${savedTo.join(" + ") || "ไม่มีที่เก็บข้อมูลที่ใช้งานได้"} · ${withTimestamp.items.length} รายการ · ${time}${failTip}`,
      });
    },
    [linkedFile]
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      let loadedDb: StockDB = DEFAULT_DB;
      try {
        await Promise.race([
          (async () => {
            const nav = navigator as ExperimentalNavigator;
            const root = await nav.storage.getDirectory();
            const handle = await root.getFileHandle(DB_FILENAME, { create: true });
            opfsHandleRef.current = handle;
            const text = await (await handle.getFile()).text();
            if (text.trim()) loadedDb = migrateDB(JSON.parse(text));
          })(),
          new Promise((_, reject) => setTimeout(() => reject(new Error("OPFS timeout")), 2500)),
        ]);
        if (!cancelled) setStatus({ type: "ok", msg: `✅ พร้อมใช้งาน (ไฟล์ OPFS) · ${loadedDb.items.length} รายการ` });
      } catch {
        opfsHandleRef.current = null;
        try {
          const ls = localStorage.getItem(LS_KEY);
          if (ls) loadedDb = migrateDB(JSON.parse(ls));
          if (!cancelled) setStatus({ type: "ok", msg: `✅ พร้อมใช้งาน (localStorage) · ${loadedDb.items.length} รายการ` });
        } catch (e2) {
          if (!cancelled) setStatus({ type: "err", msg: "⚠ โหลดข้อมูลไม่ได้: " + (e2 as Error).message });
        }
      }
      if (!cancelled) {
        setDb(loadedDb);
        setLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // เก็บ db ที่ยังไม่ได้เขียนลงไฟล์ไว้ เผื่อต้องรีบ flush ตอนปิดแท็บ/ออกจากหน้า
  const pendingRef = useRef<StockDB | null>(null);
  const persistRef = useRef(persist);
  persistRef.current = persist;

  useEffect(() => {
    if (!loaded) return;
    pendingRef.current = db;
    const t = setTimeout(() => {
      pendingRef.current = null;
      persist(db);
    }, SAVE_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [db, loaded, persist]);

  // ปิดแท็บ/สลับไปแท็บอื่น/unmount ระหว่างที่ยังหน่วงอยู่ ต้องเขียนทันที ไม่งั้นการแก้ล่าสุดหาย
  useEffect(() => {
    const flush = () => {
      const pending = pendingRef.current;
      if (!pending) return;
      pendingRef.current = null;
      persistRef.current(pending);
    };
    const onHide = () => {
      if (document.visibilityState === "hidden") flush();
    };
    window.addEventListener("beforeunload", flush);
    document.addEventListener("visibilitychange", onHide);
    return () => {
      window.removeEventListener("beforeunload", flush);
      document.removeEventListener("visibilitychange", onHide);
      flush();
    };
  }, []);

  const toggleLink = useCallback(async () => {
    if (linkedFile) {
      if (confirm(`เลิกผูกไฟล์ "${linkedFile.name}"? จะกลับไปบันทึกในไฟล์ภายในเบราว์เซอร์เท่านั้น`)) {
        setLinkedFile(null);
      }
      return;
    }
    const picker = (window as ExperimentalWindow).showSaveFilePicker;
    if (!picker) {
      alert("เบราว์เซอร์นี้ไม่รองรับการเลือกไฟล์บนเครื่อง — ใช้ Chrome/Edge เวอร์ชันใหม่");
      return;
    }
    try {
      const handle = await picker({
        suggestedName: DB_FILENAME,
        types: [{ description: "JSON", accept: { "application/json": [".json"] } }],
      });
      setLinkedFile(handle);
    } catch (e) {
      if ((e as Error).name !== "AbortError") console.warn(e);
    }
  }, [linkedFile]);

  const replaceDb = useCallback((next: StockDB) => {
    setDb(next);
  }, []);

  return { db, setDb, replaceDb, status, linkedFileName: linkedFile?.name ?? null, toggleLink, loaded };
}
