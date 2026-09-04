"use client";

import { createContext, useContext, useMemo } from "react";
import { usePersistedStockDB } from "@/lib/hooks/usePersistedDB";
import { useGoogleDriveSync } from "@/lib/hooks/useGoogleDriveSync";

type StockDBContextValue = ReturnType<typeof usePersistedStockDB> & {
  /** ซิงก์ขึ้น Google Drive — อยู่ตรงนี้เพื่อให้ทำงานทุกหน้า ไม่ใช่เฉพาะตอนเปิด /config */
  driveSync: ReturnType<typeof useGoogleDriveSync>;
};

const StockDBContext = createContext<StockDBContextValue | null>(null);

export function StockDBProvider({ children }: { children: React.ReactNode }) {
  const stock = usePersistedStockDB();
  // ห้ามให้ซิงก์อัตโนมัติเริ่มทำงานก่อนโหลดข้อมูลในเครื่องเสร็จ ไม่งั้นมีสิทธิ์ส่ง db เปล่าไปทับไฟล์จริง
  const driveSync = useGoogleDriveSync(stock.db, stock.setDb, stock.status.type !== "loading");
  // stock/driveSync ต่างก็ memoize identity ของตัวเองมาแล้ว (ที่ hook ต้นทาง) — spread ตรงนี้จึงคงที่
  // ถ้า field ในนั้นไม่เปลี่ยน แล้วทุกหน้าที่ useStockDB() ไม่ต้อง re-render เพราะ Provider สร้าง value ใหม่
  const value = useMemo<StockDBContextValue>(() => ({ ...stock, driveSync }), [stock, driveSync]);
  return <StockDBContext.Provider value={value}>{children}</StockDBContext.Provider>;
}

export function useStockDB() {
  const ctx = useContext(StockDBContext);
  if (!ctx) throw new Error("useStockDB must be used inside StockDBProvider");
  return ctx;
}
