"use client";

import type { StockDB } from "./db";
import type { PurchaseOrder } from "./types";

/**
 * แก้/ลบออเดอร์ (ค่าส่ง/ส่วนลด) — **ไม่มี `add`**
 *
 * ออเดอร์ถูกสร้างที่เดียวคือตอนนำเข้าจาก Shopee (`useProductActions.importFromShopee`)
 * เพราะมันต้องผูก `orderId` เข้ากับจุดราคาที่สร้างพร้อมกันในธุรกรรมเดียว การเพิ่มออเดอร์
 * ลอยๆ ทีหลังจะได้ก้อนเงินที่ไม่มีสินค้าชิ้นไหนอ้างถึง — ที่นี่จึงมีแค่แก้ยอดกับลบทิ้ง
 *
 * ลบออเดอร์ **ไม่แตะ `priceHistory`** ที่ชี้มาหา — `orderId` ที่ค้างอยู่ไม่มีผลกับการคำนวณ
 * ใดๆ (หน้าสรุปวนจาก `db.orders` ไม่ใช่จากจุดราคา) และการไล่ล้างจะไปแก้ประวัติราคาที่
 * ผู้ใช้ไม่ได้สั่งให้แก้
 */
export function useOrderActions(setDb: (updater: (prev: StockDB) => StockDB) => void) {
  const setOrders = (updater: (prev: PurchaseOrder[]) => PurchaseOrder[]) => {
    setDb((prev) => ({ ...prev, orders: updater(prev.orders ?? []) }));
  };

  /** แก้ทีละฟิลด์ — บันทึกทันทีเหมือนค่าตั้งราคาขาย ไม่มีปุ่ม "บันทึก" แยก */
  const patchOrder = (id: string, patch: Partial<PurchaseOrder>) => {
    setOrders((prev) =>
      prev.map((o) =>
        o.id === id
          ? {
              ...o,
              ...patch,
              // ยอดติดลบทำให้สรุปยอดเพี้ยนแบบหาสาเหตุยาก — หนีบตั้งแต่ตรงนี้เลย
              shipping: Math.max(0, patch.shipping ?? o.shipping),
              discount: Math.max(0, patch.discount ?? o.discount),
              updatedAt: new Date().toISOString(),
            }
          : o
      )
    );
  };

  const removeOrder = (order: PurchaseOrder) => {
    const label = [order.date || "ไม่ทราบวันที่", order.shop].filter(Boolean).join(" · ");
    if (!confirm(`ลบค่าส่ง/ส่วนลดของออเดอร์ "${label}"?\n\nสินค้ากับประวัติราคาไม่ถูกลบ — หายไปเฉพาะเงินก้อนนี้ในหน้าสรุปยอด`)) return;
    setOrders((prev) => prev.filter((o) => o.id !== order.id));
  };

  return { patchOrder, removeOrder };
}
