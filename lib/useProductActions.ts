"use client";

import type { StockDB } from "./db";
import { uid } from "./uid";
import type { ImportCandidate, StockItem } from "./types";

function exportCsv(items: StockItem[]) {
  const header = "ชื่อสินค้า,หมวดหมู่,จำนวน,ขั้นต่ำ,ราคา,ขนาด,หมายเหตุ,ส่วนผสม\n";
  const rows = items
    .map((i) => [i.name, i.cats.join("; "), i.qty, i.min, i.price ?? "", i.size ?? "", i.note, i.ingredients ?? ""]
      .map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(","))
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

  /** ผสาน sourceId เข้ากับ targetId — บวกจำนวนรวมกัน เก็บข้อมูลอื่นๆ ของ target ไว้ แล้วลบ source ทิ้ง */
  /** จัดกลุ่มสินค้าหลายชิ้นที่เป็นตัวเดียวกันเข้าด้วยกัน โดยไม่ลบทิ้ง — แค่ติด groupId/groupName เดียวกันให้ทุกอัน */
  const groupItems = (ids: string[], groupName: string) => {
    const groupId = uid();
    setItems((prev) => prev.map((i) => (ids.includes(i.id) ? { ...i, groupId, groupName } : i)));
  };

  const ungroup = (id: string) => {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, groupId: undefined, groupName: undefined } : i)));
  };

  /** ตั้งหมวดหมู่ให้สินค้าหลายชิ้นพร้อมกัน (ทับของเดิมทั้งหมด) ใช้ตอนเลือกหลายอันแล้วอยากย้ายหมวดหมู่รวด */
  const setCatsForItems = (ids: string[], cats: string[]) => {
    setItems((prev) => prev.map((i) => (ids.includes(i.id) ? { ...i, cats } : i)));
  };

  const inc = (id: string) => setItems((prev) => prev.map((i) => (i.id === id ? { ...i, qty: i.qty + 1 } : i)));
  const dec = (id: string) => setItems((prev) => prev.map((i) => (i.id === id ? { ...i, qty: Math.max(0, i.qty - 1) } : i)));

  const importFromShopee = (chosen: ImportCandidate[]) => {
    if (chosen.length === 0) return;
    const today = new Date().toISOString().slice(0, 10);
    // ซื้อซ้ำ (มี existingId + mergeExisting) ให้บวกจำนวนเข้ารายการเดิมแทนสร้างใหม่
    const toMerge = new Map(chosen.filter((c) => c.existingId && c.mergeExisting).map((c) => [c.existingId!, c]));
    const toAdd = chosen.filter((c) => !(c.existingId && c.mergeExisting));

    setItems((prev) => [
      ...prev.map((i) => {
        const m = toMerge.get(i.id);
        if (!m) return i;
        const use = (field: keyof NonNullable<ImportCandidate["mergeFields"]>) => m.mergeFields?.[field] !== false;
        return {
          ...i,
          qty: use("qty") ? i.qty + m.qty : i.qty,
          price: use("price") && m.price != null ? m.price : i.price,
          img: use("img") && m.img ? m.img : i.img,
          variant: use("variant") && m.variant ? m.variant : i.variant,
          size: use("size") && m.size ? m.size : i.size,
          note: use("note") && m.note ? m.note : i.note,
          ingredients: use("ingredients") && m.ingredients ? m.ingredients : i.ingredients,
          status: use("status") && m.status ? m.status : i.status,
          purchasedAt: today, // ซื้อซ้ำถือเป็นการซื้อครั้งใหม่ อัปเดตวันที่ล่าสุด
        };
      }),
      ...toAdd.map((c) => ({
        id: uid(),
        name: c.name.trim(),
        cats: c.cats,
        qty: c.qty,
        min: 0,
        note: c.note || "",
        ingredients: c.ingredients || "",
        img: c.img,
        link: c.link,
        status: c.status,
        source: "shopee" as const,
        price: c.price,
        size: c.size,
        variant: c.variant,
        purchasedAt: today,
      })),
    ]);
  };

  return { save, remove, groupItems, ungroup, setCatsForItems, inc, dec, importFromShopee, exportCsv };
}
