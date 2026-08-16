"use client";

import { todayISO } from "./date";
import type { StockDB } from "./db";
import { priceStats, pushPricePoint } from "./price";
import { uid } from "./uid";
import type { ImportCandidate, StockItem } from "./types";

function exportCsv(items: StockItem[]) {
  const header = "ชื่อสินค้า,หมวดหมู่,จำนวน,ขั้นต่ำ,ราคาต่อชิ้น,ราคาเฉลี่ย,ซื้อไปกี่ครั้ง,ขนาด,หมายเหตุ,ส่วนผสม\n";
  const rows = items
    .map((i) => {
      const stats = priceStats(i.priceHistory);
      return [
        i.name, i.cats.join("; "), i.qty, i.min,
        i.price ?? "", stats?.avg ?? "", stats?.times ?? "",
        i.size ?? "", i.note, i.ingredients ?? "",
      ]
        .map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(",");
    })
    .join("\n");
  const blob = new Blob(["﻿" + header + rows], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `stock-${todayISO()}.csv`;
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
      // createdAt ติดตอนสร้างครั้งเดียว การแก้ไขทีหลังไม่แตะ (ไม่งั้นลำดับ "เพิ่มล่าสุด" จะเพี้ยน)
      setItems((prev) => [...prev, { id: uid(), ...data, createdAt: data.createdAt || new Date().toISOString() }]);
    }
  };

  const remove = (item: StockItem) => {
    if (confirm(`ลบ "${item.name}" ออกจากสต็อก?`)) {
      setItems((prev) => prev.filter((i) => i.id !== item.id));
    }
  };

  /**
   * ลบหลายรายการพร้อมกัน — ยืนยันครั้งเดียวโดยไล่ชื่อให้ดูก่อน (ลบทีละสิบยี่สิบอันแล้วถามทีละอันคงไม่ไหว)
   * ไม่มี undo และไม่มีถังขยะ เลยต้องเห็นชื่อจริงก่อนกดตกลง
   */
  const removeMany = (items: StockItem[]): boolean => {
    if (items.length === 0) return false;
    const SHOW = 8;
    const names = items.slice(0, SHOW).map((i) => `• ${i.name}`).join("\n");
    const more = items.length > SHOW ? `\n…และอีก ${items.length - SHOW} รายการ` : "";
    if (!confirm(`ลบ ${items.length} รายการนี้ออกจากสต็อก?\n\n${names}${more}\n\nลบแล้วกู้คืนไม่ได้`)) return false;
    const ids = new Set(items.map((i) => i.id));
    setItems((prev) => prev.filter((i) => !ids.has(i.id)));
    return true;
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
    const now = new Date().toISOString();
    // วันที่ซื้อต้องอิงเวลาเครื่อง ไม่ใช่ UTC (ดู lib/date.ts) — `now` เป็น timestamp เต็มของ createdAt ไม่เกี่ยวกัน
    const today = todayISO();
    // ซื้อซ้ำ (มี existingId + mergeExisting) ให้บวกจำนวนเข้ารายการเดิมแทนสร้างใหม่
    const toMerge = new Map(chosen.filter((c) => c.existingId && c.mergeExisting).map((c) => [c.existingId!, c]));
    const toAdd = chosen.filter((c) => !(c.existingId && c.mergeExisting));

    setItems((prev) => [
      ...prev.map((i) => {
        const m = toMerge.get(i.id);
        if (!m) return i;
        const use = (field: keyof NonNullable<ImportCandidate["mergeFields"]>) => m.mergeFields?.[field] !== false;
        // ติ๊ก "ราคา" = เชื่อราคาที่แกะมา จึงเอาลงประวัติราคาได้ (ติ๊กออก = ไม่เชื่อ ไม่ควรเอาไปถ่วงค่าเฉลี่ย)
        const logPrice = use("price") && m.price != null;
        // ใช้วันที่สั่งซื้อจริงจากหน้าออเดอร์ถ้าแกะได้ ไม่งั้นค่อยใช้วันที่นำเข้า
        // (นำเข้าออเดอร์เก่าย้อนหลังจะได้ไม่ถูกลงวันที่เป็นวันนี้ทั้งหมด แล้วหน้าสรุปยอดเพี้ยน)
        const boughtAt = m.purchasedAt || today;
        /*
         * `purchasedAt` แปลว่า "ซื้อครั้งล่าสุดเมื่อไร" จึงเดินหน้าได้อย่างเดียว
         * ตั้งแต่ดึงวันที่จริงจากหน้าออเดอร์มาใช้ การนำเข้าออเดอร์เก่าย้อนหลังจะกลายเป็นการ
         * ถอยวันที่ของสินค้าที่มีอยู่แล้วให้เก่าลง (เช่นของที่เพิ่งซื้อเดือนนี้ โดนทับเป็นปี 2019)
         * ซึ่งทำให้ทั้งหน้าสรุปยอดและ "ซื้อครั้งล่าสุด" ผิดหมด
         */
        const isLatestPurchase = boughtAt >= (i.purchasedAt || "");
        return {
          ...i,
          qty: use("qty") ? i.qty + m.qty : i.qty,
          // ช่อง price คือ "ราคาปัจจุบัน" ออเดอร์เก่าที่ลงย้อนหลังจึงลงได้แค่ประวัติ ไม่ทับราคาปัจจุบัน
          price: logPrice && isLatestPurchase ? m.price : i.price,
          // จำนวนที่ซื้อ "ครั้งล่าสุด" — ออเดอร์เก่าที่เพิ่งเอามาลงย้อนหลังไม่ใช่ครั้งล่าสุด
          buyQty: isLatestPurchase ? m.qty : i.buyQty,
          priceHistory: logPrice
            ? pushPricePoint(i.priceHistory, { date: boughtAt, price: m.price!, qty: m.qty || 1 })
            : i.priceHistory,
          // ราคาใหม่มาจากโค้ดที่หารต่อชิ้นแล้ว ไม่ต้องเตือนให้ตรวจอีก (เฉพาะตอนที่ทับราคาปัจจุบันจริงๆ)
          priceUnverified: logPrice && isLatestPurchase ? undefined : i.priceUnverified,
          img: use("img") && m.img ? m.img : i.img,
          variant: use("variant") && m.variant ? m.variant : i.variant,
          size: use("size") && m.size ? m.size : i.size,
          note: use("note") && m.note ? m.note : i.note,
          ingredients: use("ingredients") && m.ingredients ? m.ingredients : i.ingredients,
          status: use("status") && m.status ? m.status : i.status,
          purchasedAt: isLatestPurchase ? boughtAt : i.purchasedAt,
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
        buyQty: c.qty,
        priceHistory: c.price != null ? [{ date: c.purchasedAt || today, price: c.price, qty: c.qty || 1 }] : [],
        size: c.size,
        variant: c.variant,
        purchasedAt: c.purchasedAt || today,
        createdAt: now,
      })),
    ]);
  };

  return { save, remove, removeMany, groupItems, ungroup, setCatsForItems, inc, dec, importFromShopee, exportCsv };
}
