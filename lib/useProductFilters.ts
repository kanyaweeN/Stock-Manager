"use client";

import { useMemo, useState } from "react";
import type { StockItem } from "./types";
import { itemTags, TAG_PRIORITY, type IngredientTag } from "./ingredients";

export type SortKey = "name-asc" | "name-desc" | "qty-asc" | "qty-desc" | "price-asc" | "price-desc" | "cat-asc" | "cat-desc";
export type StockTab = "all" | "in-stock" | "out-of-stock" | "grouped";

// สินค้าไม่มีหมวดหมู่ให้ไปอยู่ท้ายสุดเสมอไม่ว่าจะเรียง ก-ฮ หรือ ฮ-ก
const catKey = (i: StockItem) => i.cats.slice().sort().join(", ");

const SORTERS: Record<SortKey, (a: StockItem, b: StockItem) => number> = {
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
  const [sortKey, setSortKey] = useState<SortKey>("name-asc");
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
    return items
      .filter((i) =>
        // ค้นหาชนส่วนผสมด้วย จะได้พิมพ์ "niacinamide" แล้วเจอทุกขวดที่มีตัวนี้
        (!q || i.name.toLowerCase().includes(q) || (i.ingredients || "").toLowerCase().includes(q)) &&
        (uncategorizedOnly ? i.cats.length === 0 : filterCats.length === 0 || i.cats.some((c) => filterCats.includes(c))) &&
        (stockTab === "all" || stockTab === "grouped" || (stockTab === "out-of-stock" ? i.qty === 0 : i.qty > 0)) &&
        (stockTab !== "grouped" || !!i.groupId) &&
        matchTag(i)
      )
      .sort(SORTERS[sortKey]);
  }, [items, search, filterCats, uncategorizedOnly, stockTab, sortKey, filterTag, excludeTag, tagsByItem]);

  const outOfStockCount = useMemo(() => items.filter((i) => i.qty === 0).length, [items]);
  const uncategorizedCount = useMemo(() => items.filter((i) => i.cats.length === 0).length, [items]);
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
    outOfStockCount, uncategorizedCount, groupedCount,
  };
}
