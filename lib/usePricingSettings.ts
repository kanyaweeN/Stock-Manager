"use client";

import { useStockDB } from "./StockDBProvider";
import { DEFAULT_PRICING } from "./pricing";
import type { PricingSettings } from "./types";

/**
 * ตั้งค่าคิดราคาขายที่ใช้ร่วมกันทุกสูตร (เก็บที่ `db.pricing` เลยติดไป Drive sync/แบ็กอัปด้วย)
 * แก้ตรงไหนก็เซฟทันที ไม่ต้องรอกดบันทึกสูตร เพราะเป็น "ค่าตั้งของร้าน" ไม่ใช่ข้อมูลของสูตรใดสูตรหนึ่ง
 */
export function usePricingSettings() {
  const { db, setDb } = useStockDB();
  const settings = db.pricing ?? DEFAULT_PRICING;
  const setSettings = (next: PricingSettings) => setDb((prev) => ({ ...prev, pricing: next }));
  return [settings, setSettings] as const;
}
