"use client";

import { useMemo, useState } from "react";
import type { StockItem } from "./types";

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
    return items
      .filter((i) =>
        (!q || i.name.toLowerCase().includes(q)) &&
        (uncategorizedOnly ? i.cats.length === 0 : filterCats.length === 0 || i.cats.some((c) => filterCats.includes(c))) &&
        (stockTab === "all" || stockTab === "grouped" || (stockTab === "out-of-stock" ? i.qty === 0 : i.qty > 0)) &&
        (stockTab !== "grouped" || !!i.groupId)
      )
      .sort(SORTERS[sortKey]);
  }, [items, search, filterCats, uncategorizedOnly, stockTab, sortKey]);

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
    categorySuggestions, filtered,
    outOfStockCount, uncategorizedCount, groupedCount,
  };
}
