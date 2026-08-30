"use client";

import { applyCatEdit, type CatEditMode } from "./cats";
import { todayISO } from "./date";
import type { StockDB } from "./db";
import { csvRows, downloadFile } from "./download";
import { effectiveExpiry } from "./expiry";
import { priceStats, pushPricePoint } from "./price";
import { pushToTrash, takeFromTrash } from "./trash";
import { pushUsage } from "./usage";
import { uid } from "./uid";
import type { ImportCandidate, PurchaseOrder, StockItem } from "./types";

/** ส่งออกสต็อกเป็น CSV — 1 แถวต่อสินค้า 1 ชิ้น (ของในถังขยะไม่ถูกส่งออก) */
function exportCsv(items: StockItem[]) {
  const header = "ชื่อสินค้า,หมวดหมู่,จำนวน,ขั้นต่ำ,ราคาต่อชิ้น,ราคาเฉลี่ย,ซื้อไปกี่ครั้ง,ขนาด,ร้านค้า,ที่เก็บ,เปิดแล้วเหลือ %,ซื้อทีละ,วันหมดอายุ,หมายเหตุ,ส่วนผสม\n";
  const rows = csvRows(
    items.map((i) => {
      const stats = priceStats(i.priceHistory);
      return [
        i.name, i.cats.join("; "), i.qty, i.min,
        i.price ?? "", stats?.avg ?? "", stats?.times ?? "",
        i.size ?? "", i.shop ?? "", i.location ?? "",
        i.openPct ?? "", i.reorderQty ?? "", effectiveExpiry(i)?.date ?? "",
        i.note, i.ingredients ?? "",
      ];
    })
  );
  downloadFile(`stock-${todayISO()}.csv`, header + rows);
}

/** รวม CRUD ทั้งหมดของรายการสินค้า (เพิ่ม/แก้ไข/ลบ/ปรับจำนวน/นำเข้าออเดอร์จากร้านออนไลน์/ส่งออก CSV) */
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

  /** ลบ = ย้ายเข้าถังขยะ (กู้คืนได้ที่หน้าตั้งค่า) ไม่ใช่ลบถาวร — ดู lib/trash.ts */
  const remove = (item: StockItem) => {
    if (!confirm(`ลบ "${item.name}" ออกจากสต็อก?\n\nย้ายไปถังขยะ กู้คืนได้ที่ ตั้งค่า > สำรอง/กู้คืน`)) return;
    setDb((prev) => ({
      ...prev,
      items: prev.items.filter((i) => i.id !== item.id),
      trash: pushToTrash(prev.trash, [item]),
    }));
  };

  /**
   * ลบหลายรายการพร้อมกัน — ยืนยันครั้งเดียวโดยไล่ชื่อให้ดูก่อน (ลบทีละสิบยี่สิบอันแล้วถามทีละอันคงไม่ไหว)
   * ยังต้องเห็นชื่อจริงก่อนกดตกลง ถึงจะกู้คืนจากถังขยะได้ก็ตาม เพราะถังขยะเก็บได้จำกัด (`TRASH_MAX`)
   */
  const removeMany = (items: StockItem[]): boolean => {
    if (items.length === 0) return false;
    const SHOW = 8;
    const names = items.slice(0, SHOW).map((i) => `• ${i.name}`).join("\n");
    const more = items.length > SHOW ? `\n…และอีก ${items.length - SHOW} รายการ` : "";
    if (!confirm(`ลบ ${items.length} รายการนี้ออกจากสต็อก?\n\n${names}${more}\n\nย้ายไปถังขยะ กู้คืนได้ที่ ตั้งค่า > สำรอง/กู้คืน`)) return false;
    const ids = new Set(items.map((i) => i.id));
    setDb((prev) => ({
      ...prev,
      items: prev.items.filter((i) => !ids.has(i.id)),
      trash: pushToTrash(prev.trash, prev.items.filter((i) => ids.has(i.id))),
    }));
    return true;
  };

  /** กู้ของกลับเข้าสต็อก — ต่อท้ายลิสต์เหมือนของที่เพิ่มใหม่ (ดู `sorters` ใน useProductFilters) */
  const restoreFromTrash = (id: string) => {
    setDb((prev) => {
      const { item, trash } = takeFromTrash(prev.trash, id, new Set(prev.items.map((i) => i.id)), uid);
      if (!item) return prev;
      return { ...prev, items: [...prev.items, item], trash };
    });
  };

  const deleteForever = (item: StockItem) => {
    if (!confirm(`ลบ "${item.name}" ทิ้งถาวร?\n\nรอบนี้กู้คืนไม่ได้จริงๆ`)) return;
    setDb((prev) => ({ ...prev, trash: (prev.trash ?? []).filter((i) => i.id !== item.id) }));
  };

  /**
   * ล้างถังขยะทิ้งถาวร — รับ `count` มาจากผู้เรียกเพื่อ**ถามยืนยันนอก updater ของ `setDb`**
   *
   * ห้ามเรียก `confirm()` ข้างใน updater เด็ดขาด: updater ต้องเป็นฟังก์ชันบริสุทธิ์
   * React เรียกซ้ำได้ (StrictMode เรียกสองรอบใน dev) ผู้ใช้จะเจอกล่องยืนยันเด้งสองครั้ง
   */
  const emptyTrash = (count: number) => {
    if (count <= 0) return;
    if (!confirm(`ล้างถังขยะ ${count} รายการทิ้งถาวร?\n\nรอบนี้กู้คืนไม่ได้จริงๆ`)) return;
    setDb((prev) => ({ ...prev, trash: [] }));
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

  /**
   * แก้หมวดหมู่ให้สินค้าหลายชิ้นพร้อมกัน ใช้ตอนเลือกหลายอันแล้วอยากจัดหมวดรวดเดียว
   *
   * `mode` ตัดสินว่าหมวดเดิมของแต่ละชิ้นจะเป็นยังไง — `add` ติดเพิ่ม, `remove` เอาเฉพาะที่เลือกออก,
   * `replace` ทับทั้งหมด (พฤติกรรมเดิม) ตรรกะจริงอยู่ที่ `applyCatEdit` ใน lib/cats.ts
   * ซึ่งกล่องยืนยันเรียกตัวเดียวกันไปแสดงตัวอย่างผลลัพธ์ ที่เห็นกับที่ได้จริงจึงตรงกันเสมอ
   */
  const setCatsForItems = (ids: string[], cats: string[], mode: CatEditMode = "replace") => {
    const target = new Set(ids);
    setItems((prev) => prev.map((i) => (target.has(i.id) ? { ...i, cats: applyCatEdit(i.cats, cats, mode) } : i)));
  };

  /** ปัก/เอาดาวออก — เก็บเฉพาะตอนเป็นของโปรดจริงๆ (ดู normalizeItem ใน lib/db.ts) */
  const toggleFav = (id: string) =>
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, fav: i.fav ? undefined : true } : i)));

  /**
   * ปรับจำนวนทีละ 1 พร้อมจดลงประวัติการใช้ — ประวัตินี้คือข้อมูลเดียวที่บอกได้ว่า
   * "ของจะหมดอีกกี่วัน" (ดู lib/usage.ts) ตัว `qty` เฉยๆ บอกไม่ได้ว่าใช้เร็วแค่ไหน
   *
   * `dec` ตอนของหมดอยู่แล้วไม่จด เพราะจำนวนไม่ได้ลดจริง (`Math.max(0, ...)` กันไว้)
   * จดไปจะกลายเป็นการใช้ปลอมๆ ที่ดันอัตราการใช้ให้สูงเกินจริง
   */
  const changeQty = (id: string, delta: number) =>
    setItems((prev) =>
      prev.map((i) => {
        if (i.id !== id) return i;
        const qty = Math.max(0, i.qty + delta);
        const real = qty - i.qty;
        if (real === 0) return i;
        return {
          ...i,
          qty,
          // ใช้จนหมดแล้ว = ไม่มีขวดที่เปิดค้างอยู่อีก ต้องล้าง `openPct` ทิ้ง
          // ไม่งั้นพอซื้อรอบใหม่ ของใหม่ที่ยังไม่ได้แกะจะถูกคิดว่าเหลือแค่ n% ตามค่าเก่าที่ค้าง
          openPct: qty === 0 ? undefined : i.openPct,
          usageLog: pushUsage(i.usageLog, real),
        };
      })
    );

  const inc = (id: string) => changeQty(id, 1);
  const dec = (id: string) => changeQty(id, -1);

  /**
   * นำเข้ารายการจากออเดอร์ร้านออนไลน์ (Shopee / Lazada / Watsons / Konvy — ดู lib/importSites.ts)
   *
   * `extras` คือค่าส่ง/ส่วนลดระดับออเดอร์ที่ไม่ได้อยู่ในราคาสินค้า — ถ้ามีจริง (ไม่ใช่ 0 ทั้งคู่)
   * จะบันทึกเป็น `PurchaseOrder` 1 ก้อนใน `db.orders` แล้วปั๊ม `orderId` ลงจุดราคาทุกจุดของรอบนี้
   * หน้าสรุปยอดจะได้บวกเงินก้อนนี้ **ครั้งเดียวต่อออเดอร์** ไม่ใช่ซ้ำตามจำนวนชิ้นในออเดอร์
   */
  const importOrder = (
    chosen: ImportCandidate[],
    extras?: { shipping: number; discount: number; date?: string; shop?: string; note?: string }
  ) => {
    if (chosen.length === 0) return;
    const now = new Date().toISOString();
    // วันที่ซื้อต้องอิงเวลาเครื่อง ไม่ใช่ UTC (ดู lib/date.ts) — `now` เป็น timestamp เต็มของ createdAt ไม่เกี่ยวกัน
    const today = todayISO();
    const hasExtras = !!extras && (extras.shipping > 0 || extras.discount > 0);
    const orderId = hasExtras ? uid() : undefined;
    // ซื้อซ้ำ (มี existingId + mergeExisting) ให้บวกจำนวนเข้ารายการเดิมแทนสร้างใหม่
    const toMerge = new Map(chosen.filter((c) => c.existingId && c.mergeExisting).map((c) => [c.existingId!, c]));
    const toAdd = chosen.filter((c) => !(c.existingId && c.mergeExisting));

    const nextItems = (prev: StockItem[]): StockItem[] => [
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
            ? pushPricePoint(i.priceHistory, {
                date: boughtAt,
                price: m.price!,
                qty: m.qty || 1,
                ...(m.shop ? { shop: m.shop } : {}),
                ...(orderId ? { orderId } : {}),
              })
            : i.priceHistory,
          // ราคาใหม่มาจากโค้ดที่หารต่อชิ้นแล้ว ไม่ต้องเตือนให้ตรวจอีก (เฉพาะตอนที่ทับราคาปัจจุบันจริงๆ)
          priceUnverified: logPrice && isLatestPurchase ? undefined : i.priceUnverified,
          img: use("img") && m.img ? m.img : i.img,
          variant: use("variant") && m.variant ? m.variant : i.variant,
          size: use("size") && m.size ? m.size : i.size,
          note: use("note") && m.note ? m.note : i.note,
          ingredients: use("ingredients") && m.ingredients ? m.ingredients : i.ingredients,
          status: use("status") && m.status ? m.status : i.status,
          // ร้านของ "ครั้งล่าสุด" เดินตาม purchasedAt — ออเดอร์เก่าที่ลงย้อนหลังลงได้แค่ในประวัติราคา
          shop: use("shop") && m.shop && isLatestPurchase ? m.shop : i.shop,
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
        source: c.source,
        price: c.price,
        buyQty: c.qty,
        priceHistory: c.price != null
          ? [{
              date: c.purchasedAt || today,
              price: c.price,
              qty: c.qty || 1,
              ...(c.shop ? { shop: c.shop } : {}),
              ...(orderId ? { orderId } : {}),
            }]
          : [],
        size: c.size,
        variant: c.variant,
        shop: c.shop,
        purchasedAt: c.purchasedAt || today,
        createdAt: now,
      })),
    ];

    setDb((prev) => {
      const items = nextItems(prev.items);
      if (!hasExtras) return { ...prev, items };
      const order: PurchaseOrder = {
        id: orderId!,
        date: extras!.date || chosen.find((c) => c.purchasedAt)?.purchasedAt || today,
        shop: extras!.shop || chosen.find((c) => c.shop)?.shop,
        shipping: Math.max(0, extras!.shipping),
        discount: Math.max(0, extras!.discount),
        note: extras!.note || "",
        createdAt: now,
      };
      return { ...prev, items, orders: [...(prev.orders ?? []), order] };
    });
  };

  /** ปักดาวให้หลายรายการพร้อมกัน — ยังไม่โปรดครบทุกอัน = ปักให้ทั้งหมด, โปรดครบแล้ว = เอาออกทั้งหมด */
  const toggleFavForItems = (ids: string[]) => {
    setItems((prev) => {
      const allFav = prev.filter((i) => ids.includes(i.id)).every((i) => i.fav);
      return prev.map((i) => (ids.includes(i.id) ? { ...i, fav: allFav ? undefined : true } : i));
    });
  };

  return {
    save, remove, removeMany, restoreFromTrash, deleteForever, emptyTrash,
    groupItems, ungroup, setCatsForItems, toggleFav, toggleFavForItems, inc, dec, importOrder, exportCsv,
  };
}
