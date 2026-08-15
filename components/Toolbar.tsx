"use client";

import { useEffect, useRef, useState } from "react";
import CategoryMultiSelect from "@/components/CategoryMultiSelect";
import { TAG_META, type IngredientTag } from "@/lib/ingredients";
import type { SortKey } from "@/lib/useProductFilters";

const SORT_LABELS: Record<SortKey, string> = {
  "added-desc": "เพิ่มล่าสุด",
  "added-asc": "เพิ่มเก่าสุด",
  "name-asc": "ชื่อ ก-ฮ",
  "name-desc": "ชื่อ ฮ-ก",
  "qty-asc": "จำนวนน้อย-มาก",
  "qty-desc": "จำนวนมาก-น้อย",
  "price-asc": "ราคาต่ำ-สูง",
  "price-desc": "ราคาสูง-ต่ำ",
  "cat-asc": "หมวดหมู่ ก-ฮ",
  "cat-desc": "หมวดหมู่ ฮ-ก",
};

interface Props {
  title: string;
  search: string;
  onSearch: (v: string) => void;
  categories: string[];
  filterCats: string[];
  onFilterCats: (v: string[]) => void;
  sortKey: SortKey;
  onSortKey: (v: SortKey) => void;
  availableTags: IngredientTag[];
  withIngredientsCount: number;
  filterTag: IngredientTag | "";
  onFilterTag: (v: IngredientTag | "") => void;
  excludeTag: boolean;
  onExcludeTag: (v: boolean) => void;
  onClearFilters: () => void;
  onAdd: () => void;
  onNewRecipe: () => void;
  onImport: () => void;
  onExport: () => void;
  selectMode: boolean;
  onToggleSelectMode: () => void;
}

/**
 * แถบบนของหน้าสินค้า — เหลือแค่ ค้นหา / ปุ่มหลัก / เมนู ⋯ แล้วผลักคำสั่งที่ใช้นานๆ ครั้ง
 * (นำเข้า, ส่งออก, สร้างสูตร, เลือกหลายอัน) เข้าไปในเมนู ส่วนตัวกรองอยู่แถวล่างและโชว์เฉพาะที่เปิดใช้อยู่
 */
export default function Toolbar(p: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const close = (e: MouseEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [menuOpen]);

  const run = (fn: () => void) => () => { setMenuOpen(false); fn(); };

  const activeFilters = p.filterCats.length + (p.filterTag ? 1 : 0) + (p.search.trim() ? 1 : 0);

  return (
    <>
      <div className="topbar">
        <h1 className="topbar__title">{p.title}</h1>

        <div className="topbar__search">
          <span className="topbar__search-icon" aria-hidden>🔍</span>
          <input
            id="search"
            type="text"
            placeholder="ค้นหาชื่อสินค้า / ส่วนผสม..."
            value={p.search}
            onChange={(e) => p.onSearch(e.target.value)}
          />
          {p.search && (
            <button className="topbar__search-clear" title="ล้างคำค้น" onClick={() => p.onSearch("")}>×</button>
          )}
        </div>

        <button className="btn-primary topbar__add" onClick={p.onAdd}>＋ เพิ่มสินค้า</button>

        <div className="menu" ref={menuRef}>
          <button
            className={`btn-ghost menu__btn ${menuOpen ? "is-open" : ""}`}
            title="เพิ่มเติม"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((v) => !v)}
          >
            ⋯
          </button>
          {menuOpen && (
            <div className="menu__panel">
              <button className="menu__item" onClick={run(p.onImport)}><i>📥</i> นำเข้าจาก Shopee</button>
              <button className="menu__item" onClick={run(p.onExport)}><i>📤</i> ส่งออก CSV</button>
              <button className="menu__item" onClick={run(p.onNewRecipe)}><i>🧮</i> สร้างสูตรต้นทุนใหม่</button>
              <div className="menu__sep" />
              <button className="menu__item" onClick={run(p.onToggleSelectMode)}>
                <i>☑️</i> {p.selectMode ? "ออกจากโหมดเลือก" : "เลือกหลายรายการ"}
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="filterbar">
        <CategoryMultiSelect categories={p.categories} selected={p.filterCats} onChange={p.onFilterCats} />

        <select
          className="filterbar__sort"
          value={p.sortKey}
          onChange={(e) => p.onSortKey(e.target.value as SortKey)}
          title="เรียงลำดับ"
        >
          {(Object.entries(SORT_LABELS) as [SortKey, string][]).map(([k, v]) => (
            <option key={k} value={k}>↓↑ {v}</option>
          ))}
        </select>

        {p.availableTags.length > 0 && (
          <select
            className={p.filterTag ? "is-active" : ""}
            value={p.filterTag}
            onChange={(e) => p.onFilterTag(e.target.value as IngredientTag | "")}
            title={`กรองด้วยส่วนผสม — มีข้อมูล ${p.withIngredientsCount} รายการ`}
          >
            <option value="">🧪 ส่วนผสมทั้งหมด</option>
            {p.availableTags.map((t) => (
              <option key={t} value={t}>{TAG_META[t].emoji} {TAG_META[t].label}</option>
            ))}
          </select>
        )}

        {p.filterTag && (
          <button
            className={`chip-toggle ${p.excludeTag ? "is-active" : ""}`}
            onClick={() => p.onExcludeTag(!p.excludeTag)}
            title="เอาเฉพาะรายการที่ไม่มีส่วนผสมกลุ่มนี้"
          >
            {p.excludeTag ? "✓ " : ""}กลับด้าน
          </button>
        )}

        {activeFilters > 0 && (
          <button className="filterbar__clear" onClick={p.onClearFilters}>ล้างตัวกรอง ({activeFilters})</button>
        )}
      </div>

      <button className="fab" onClick={p.onAdd} title="เพิ่มสินค้า" aria-label="เพิ่มสินค้า">＋</button>
    </>
  );
}
