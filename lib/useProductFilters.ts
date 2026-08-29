"use client";

import { useMemo, useState } from "react";
import type { StockItem } from "./types";
import { itemTags, TAG_PRIORITY, type IngredientTag } from "./ingredients";
import { buyTimes, isFrequent } from "./price";
import { effectiveExpiry, needsAttention } from "./expiry";
import { isLow, isOutOfStock } from "./stock";

export type SortKey =
  | "bought-desc" | "bought-asc"
  | "added-desc" | "added-asc"
  | "times-desc" | "times-asc"
  | "expiry-asc"
  | "name-asc" | "name-desc" | "qty-asc" | "qty-desc" | "price-asc" | "price-desc" | "cat-asc" | "cat-desc";
export type StockTab = "all" | "in-stock" | "low" | "out-of-stock" | "grouped" | "fav" | "frequent" | "expiring";

/**
 * ตัวเรียงที่ต้องรู้ข้อมูลระดับทั้งลิสต์ (ตำแหน่งใน db.items ไว้ tie-break / จำนวนครั้งที่ซื้อ)
 * เลยแยกออกมาสร้างทีหลังใน `sorters` แทนที่จะอยู่ใน `SORTERS` ที่เป็นค่าคงที่ระดับโมดูล
 */
type DerivedSortKey =
  | "added-desc" | "added-asc" | "bought-desc" | "bought-asc" | "times-desc" | "times-asc" | "expiry-asc";

// สินค้าไม่มีหมวดหมู่ให้ไปอยู่ท้ายสุดเสมอไม่ว่าจะเรียง ก-ฮ หรือ ฮ-ก
const catKey = (i: StockItem) => i.cats.slice().sort().join(", ");

const SORTERS: Record<Exclude<SortKey, DerivedSortKey>, (a: StockItem, b: StockItem) => number> = {
  "name-asc": (a, b) => a.name.localeCompare(b.name, "th"),
  "name-desc": (a, b) => b.name.localeCompare(a.name, "th"),
  "qty-asc": (a, b) => a.qty - b.qty,
  "qty-desc": (a, b) => b.qty - a.qty,
  "price-asc": (a, b) => (a.price ?? Infinity) - (b.price ?? Infinity),
  "price-desc": (a, b) => (b.price ?? -Infinity) - (a.price ?? -Infinity),
  "cat-asc": (a, b) => {
    if (a.cats.length === 0 && b.cats.length === 0) return a.name.localeCompare(b.name, "th");
    if (a.cats.length === 0) return 1;
    if (b.cats.length === 0) return -1;
    return catKey(a).localeCompare(catKey(b), "th") || a.name.localeCompare(b.name, "th");
  },
  "cat-desc": (a, b) => {
    if (a.cats.length === 0 && b.cats.length === 0) return a.name.localeCompare(b.name, "th");
    if (a.cats.length === 0) return 1;
    if (b.cats.length === 0) return -1;
    return catKey(b).localeCompare(catKey(a), "th") || a.name.localeCompare(b.name, "th");
  },
};

/** จัดการ state และ logic การค้นหา/กรองหมวดหมู่/เรียงลำดับของรายการสินค้า */
export function useProductFilters(items: StockItem[], presets: string[]) {
  const [search, setSearch] = useState("");
  const [filterCats, setFilterCats] = useState<string[]>([]);
  const [uncategorizedOnly, setUncategorizedOnly] = useState(false);
  // ค่าเริ่มต้นเป็น "ซื้อล่าสุด" ไม่ใช่ "เพิ่มล่าสุด" เพราะของส่วนใหญ่เข้าสต็อกด้วยการนำเข้าออเดอร์ Shopee
  // ซึ่งการซื้อซ้ำจะรวมเข้ารายการเดิม (createdAt ไม่ขยับ) ของที่เพิ่งซื้อจึงไม่โผล่ขึ้นบนถ้าเรียงตาม createdAt
  const [sortKey, setSortKey] = useState<SortKey>("bought-desc");
  const [stockTab, setStockTab] = useState<StockTab>("all");
  const [filterTag, setFilterTag] = useState<IngredientTag | "">("");
  /** true = เอาเฉพาะตัวที่ "ไม่มี" แท็กนั้น (เช่น อยากได้ตัวที่ไม่มีน้ำหอม) */
  const [excludeTag, setExcludeTag] = useState(false);

  // แท็กส่วนผสมของแต่ละสินค้า — แยก memo ไว้เพราะ parse ลิสต์ INCI หนักกว่าการกรองอย่างอื่นมาก
  const tagsByItem = useMemo(() => {
    const map = new Map<string, IngredientTag[]>();
    for (const i of items) if (i.ingredients?.trim()) map.set(i.id, itemTags(i.ingredients));
    return map;
  }, [items]);

  /** แท็กที่มีอยู่จริงในสต็อก (ไม่ต้องโชว์ตัวเลือกที่กรองแล้วได้ 0 รายการ) */
  const availableTags = useMemo(
    () => [...new Set([...tagsByItem.values()].flat())].sort(
      (a, b) => TAG_PRIORITY.indexOf(a) - TAG_PRIORITY.indexOf(b)
    ),
    [tagsByItem]
  );

  const withIngredientsCount = useMemo(() => tagsByItem.size, [tagsByItem]);

  /**
   * ตัวเรียงลำดับที่ต้องใช้ตำแหน่งใน `db.items` มา tie-break
   *
   * - `added-*` เรียงตาม `item.createdAt` = "เพิ่มเข้าระบบเมื่อไร" ซึ่ง**ไม่ขยับตอนซื้อซ้ำ**
   * - `bought-*` เรียงตาม `item.purchasedAt` = "ซื้อครั้งล่าสุดเมื่อไร" ซึ่งขยับทุกครั้งที่นำเข้าออเดอร์ใหม่
   *   (ของที่ซื้อซ้ำจึงเด้งขึ้นบนสุดด้วยตัวนี้เท่านั้น ไม่ใช่ `added-*`)
   *
   * - `times-*` เรียงตามจำนวนครั้งที่ซื้อ (`buyTimes`) = ตัวเดียวกับที่ชิป "ซื้อบ่อย" ใช้
   *
   * ของที่ไม่รู้วันที่ (ค่าว่าง) ถือว่าเก่าสุดเสมอ แล้วจัดเรียงกันเองตามลำดับใน `db.items`
   * (ของใหม่ถูก append ต่อท้ายเสมอ ดู useProductActions.save/importFromShopee)
   */
  const sorters = useMemo(() => {
    const order = new Map(items.map((i, idx) => [i.id, idx]));
    const pos = (i: StockItem) => order.get(i.id) ?? 0;
    // นับครั้งที่ซื้อล่วงหน้าทีเดียว ไม่งั้น buyTimes (ที่วนอ่าน priceHistory) ถูกเรียกใหม่ทุกคู่ที่เทียบ
    const times = new Map(items.map((i) => [i.id, buyTimes(i)]));
    // ของที่ไม่รู้วันหมดอายุไปท้ายสุดเสมอ (ไม่ใช่ "ยังอีกนาน" — เราแค่ไม่รู้ ดู lib/expiry.ts)
    const expiry = new Map(items.map((i) => [i.id, effectiveExpiry(i)?.date ?? ""]));
    const byAdded = (a: StockItem, b: StockItem) =>
      (a.createdAt || "").localeCompare(b.createdAt || "") || pos(a) - pos(b);
    // วันที่ซื้อเป็น YYYY-MM-DD ซ้ำกันได้ง่าย (ออเดอร์เดียวกันได้วันเดียวกันทั้งชุด) จึง tie-break ด้วยวันที่เพิ่มต่อ
    const byBought = (a: StockItem, b: StockItem) =>
      (a.purchasedAt || "").localeCompare(b.purchasedAt || "") || byAdded(a, b);
    // ซื้อเท่ากันให้ตัวที่ซื้อล่าสุดขึ้นก่อน (พอกลับด้านเป็น times-desc ก็ยังได้ตัวล่าสุดขึ้นก่อน)
    const byTimes = (a: StockItem, b: StockItem) =>
      (times.get(a.id) ?? 0) - (times.get(b.id) ?? 0) || byBought(a, b);
    return {
      ...SORTERS,
      "added-desc": (a: StockItem, b: StockItem) => -byAdded(a, b),
      "added-asc": byAdded,
      "bought-desc": (a: StockItem, b: StockItem) => -byBought(a, b),
      "bought-asc": byBought,
      "times-desc": (a: StockItem, b: StockItem) => -byTimes(a, b),
      "times-asc": byTimes,
      "expiry-asc": (a: StockItem, b: StockItem) => {
        const ea = expiry.get(a.id) || "";
        const eb = expiry.get(b.id) || "";
        if (!ea && !eb) return byBought(b, a);
        if (!ea) return 1;
        if (!eb) return -1;
        return ea.localeCompare(eb) || byAdded(a, b);
      },
    } satisfies Record<SortKey, (a: StockItem, b: StockItem) => number>;
  }, [items]);

  const categories = useMemo(
    () => [...new Set(items.flatMap((i) => i.cats))].sort(),
    [items]
  );

  const categorySuggestions = useMemo(
    () => [...new Set([...presets, ...categories])].sort(),
    [presets, categories]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const matchTag = (i: StockItem) => {
      if (!filterTag) return true;
      const has = tagsByItem.get(i.id)?.includes(filterTag) ?? false;
      return excludeTag ? !has : has;
    };
    const matchStock = (i: StockItem) => {
      switch (stockTab) {
        case "in-stock": return !isOutOfStock(i);
        case "low": return isLow(i);
        case "out-of-stock": return isOutOfStock(i);
        case "grouped": return !!i.groupId;
        case "fav": return !!i.fav;
        case "frequent": return isFrequent(i);
        case "expiring": return needsAttention(i);
        default: return true;
      }
    };
    return items
      .filter((i) =>
        // ค้นหาชนส่วนผสม/ที่เก็บ/ร้านด้วย จะได้พิมพ์ "niacinamide" แล้วเจอทุกขวดที่มีตัวนี้
        // หรือพิมพ์ "ลิ้นชักบน" แล้วเห็นว่ามีอะไรอยู่ในนั้นบ้าง
        (!q ||
          i.name.toLowerCase().includes(q) ||
          (i.ingredients || "").toLowerCase().includes(q) ||
          (i.location || "").toLowerCase().includes(q) ||
          (i.shop || "").toLowerCase().includes(q)) &&
        (uncategorizedOnly ? i.cats.length === 0 : filterCats.length === 0 || i.cats.some((c) => filterCats.includes(c))) &&
        matchStock(i) &&
        matchTag(i)
      )
      .sort(sorters[sortKey]);
  }, [items, search, filterCats, uncategorizedOnly, stockTab, sortKey, filterTag, excludeTag, tagsByItem, sorters]);

  const outOfStockCount = useMemo(() => items.filter(isOutOfStock).length, [items]);
  const lowCount = useMemo(() => items.filter(isLow).length, [items]);
  const totalUnits = useMemo(() => items.reduce((s, i) => s + Number(i.qty || 0), 0), [items]);
  const uncategorizedCount = useMemo(() => items.filter((i) => i.cats.length === 0).length, [items]);
  const favCount = useMemo(() => items.filter((i) => i.fav).length, [items]);
  const frequentCount = useMemo(() => items.filter(isFrequent).length, [items]);
  const expiringCount = useMemo(() => items.filter((i) => needsAttention(i)).length, [items]);
  const groupedCount = useMemo(
    () => new Set(items.filter((i) => i.groupId).map((i) => i.groupId)).size,
    [items]
  );

  const setFilterCatsExclusive = (cats: string[]) => {
    if (cats.length > 0) setUncategorizedOnly(false);
    setFilterCats(cats);
  };

  const toggleUncategorizedOnly = () => {
    setUncategorizedOnly((prev) => {
      if (!prev) setFilterCats([]);
      return !prev;
    });
  };

  return {
    search, setSearch,
    filterCats, setFilterCats: setFilterCatsExclusive,
    uncategorizedOnly, toggleUncategorizedOnly,
    sortKey, setSortKey,
    stockTab, setStockTab,
    filterTag, setFilterTag,
    excludeTag, setExcludeTag,
    availableTags, withIngredientsCount,
    categorySuggestions, filtered,
    outOfStockCount, lowCount, totalUnits, uncategorizedCount, groupedCount, favCount, frequentCount, expiringCount,
  };
}
