"use client";

import type { StockDB } from "./db";
import { uid } from "./uid";
import type { ImportCandidate, StockItem } from "./types";

function exportCsv(items: StockItem[]) {
  const header = "ชื่อสินค้า,หมวดหมู่,จำนวน,ขั้นต่ำ,หมายเหตุ\n";
  const rows = items
    .map((i) => [i.name, i.cat, i.qty, i.min, i.note].map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(","))
    .join("\n");
  const blob = new Blob(["﻿" + header + rows], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `stock-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

/** รวม CRUD ทั้งหมดของรายการสินค้า (เพิ่ม/แก้ไข/ลบ/ปรับจำนวน/นำเข้าจาก Shopee/ส่งออก CSV) */
export function useProductActions(setDb: (updater: (prev: StockDB) => StockDB) => void) {
  const setItems = (updater: (prev: StockItem[]) => StockItem[]) => {
    setDb((prev) => ({ ...prev, items: updater(prev.items) }));
  };

  const save = (data: Omit<StockItem, "id">, editId: string | null) => {
    if (editId) {
      setItems((prev) => prev.map((i) => (i.id === editId ? { ...i, ...data } : i)));
    } else {
      setItems((prev) => [...prev, { id: uid(), ...data }]);
    }
  };

  const remove = (item: StockItem) => {
    if (confirm(`ลบ "${item.name}" ออกจากสต็อก?`)) {
      setItems((prev) => prev.filter((i) => i.id !== item.id));
    }
  };

  const inc = (id: string) => setItems((prev) => prev.map((i) => (i.id === id ? { ...i, qty: i.qty + 1 } : i)));
  const dec = (id: string) => setItems((prev) => prev.map((i) => (i.id === id ? { ...i, qty: Math.max(0, i.qty - 1) } : i)));

  const importFromShopee = (chosen: ImportCandidate[]) => {
    if (chosen.length === 0) return;
    setItems((prev) => [
      ...prev,
      ...chosen.map((c) => ({
        id: uid(),
        name: c.name.trim(),
        cat: c.cat.trim(),
        qty: c.qty,
        min: 0,
        note: "",
        img: c.img,
        link: c.link,
        status: c.status,
        source: "shopee" as const,
      })),
    ]);
  };

  return { save, remove, inc, dec, importFromShopee, exportCsv };
}
