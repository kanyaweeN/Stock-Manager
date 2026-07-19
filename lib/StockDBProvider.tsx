"use client";

import { createContext, useContext } from "react";
import { usePersistedStockDB } from "./usePersistedDB";

type StockDBContextValue = ReturnType<typeof usePersistedStockDB>;

const StockDBContext = createContext<StockDBContextValue | null>(null);

export function StockDBProvider({ children }: { children: React.ReactNode }) {
  const value = usePersistedStockDB();
  return <StockDBContext.Provider value={value}>{children}</StockDBContext.Provider>;
}

export function useStockDB() {
  const ctx = useContext(StockDBContext);
  if (!ctx) throw new Error("useStockDB must be used inside StockDBProvider");
  return ctx;
}
