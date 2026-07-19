"use client";

import { useMemo, useState } from "react";
import type { StockItem } from "./types";

/** จัดการ state และ logic การค้นหา/กรองหมวดหมู่ของรายการสินค้า */
export function useProductFilters(items: StockItem[], presets: string[]) {
  const [search, setSearch] = useState("");
  const [filterCat, setFilterCat] = useState("");

  const categories = useMemo(
    () => [...new Set(items.map((i) => i.cat).filter(Boolean))].sort(),
    [items]
  );

  const categorySuggestions = useMemo(
    () => [...new Set([...presets, ...categories])].sort(),
    [presets, categories]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items
      .filter((i) => (!q || i.name.toLowerCase().includes(q)) && (!filterCat || i.cat === filterCat))
      .sort((a, b) => a.name.localeCompare(b.name, "th"));
  }, [items, search, filterCat]);

  return { search, setSearch, filterCat, setFilterCat, categorySuggestions, filtered };
}
