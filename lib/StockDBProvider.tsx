"use client";

import { createContext, useContext } from "react";
import { usePersistedStockDB } from "./usePersistedDB";
import { useGoogleDriveSync } from "./useGoogleDriveSync";

type StockDBContextValue = ReturnType<typeof usePersistedStockDB> & {
  /** ซิงก์ขึ้น Google Drive — อยู่ตรงนี้เพื่อให้ทำงานทุกหน้า ไม่ใช่เฉพาะตอนเปิด /config */
  driveSync: ReturnType<typeof useGoogleDriveSync>;
};

const StockDBContext = createContext<StockDBContextValue | null>(null);

export function StockDBProvider({ children }: { children: React.ReactNode }) {
  const stock = usePersistedStockDB();
  // ห้ามให้ซิงก์อัตโนมัติเริ่มทำงานก่อนโหลดข้อมูลในเครื่องเสร็จ ไม่งั้นมีสิทธิ์ส่ง db เปล่าไปทับไฟล์จริง
  const driveSync = useGoogleDriveSync(stock.db, stock.setDb, stock.status.type !== "loading");
  return <StockDBContext.Provider value={{ ...stock, driveSync }}>{children}</StockDBContext.Provider>;
}

export function useStockDB() {
  const ctx = useContext(StockDBContext);
  if (!ctx) throw new Error("useStockDB must be used inside StockDBProvider");
  return ctx;
}
