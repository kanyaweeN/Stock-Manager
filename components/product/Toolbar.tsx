"use client";

import { useEffect, useRef, useState } from "react";
import CategoryMultiSelect from "@/components/ui/CategoryMultiSelect";
import { TAG_META, type IngredientTag } from "@/lib/domain/ingredients";
import type { SortKey } from "@/lib/hooks/useProductFilters";

const SORT_LABELS: Record<SortKey, string> = {
  "bought-desc": "ซื้อล่าสุด",
  "bought-asc": "ซื้อเก่าสุด",
  "added-desc": "เพิ่มล่าสุด",
  "added-asc": "เพิ่มเก่าสุด",
  "times-desc": "🔁 ซื้อบ่อยสุด",
  "times-asc": "ซื้อน้อยครั้งสุด",
  "expiry-asc": "⏰ ใกล้หมดอายุก่อน",
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
  /** ร้านที่กรองอยู่ — ตั้งค่าด้วยการกดแท็ก 🏪 บนการ์ดสินค้า ที่นี่แค่โชว์ให้เห็นว่ากรองค้างอยู่ + กดปิด */
  filterShop: string;
  filterShopLabel: string;
  onClearShop: () => void;
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
 * (ส่งออก, สร้างสูตร) เข้าไปในเมนู ส่วนตัวกรองอยู่แถวล่างและโชว์เฉพาะที่เปิดใช้อยู่
 * ยกเว้น "เลือกหลายรายการ" ที่เป็นปุ่มโชว์ตลอดท้ายแถวตัวกรอง — ใช้บ่อยเกินกว่าจะซ่อนในเมนู
 * และเป็นปุ่มเดียวที่ต้องกดก่อนเสมอเวลาจะจัดกลุ่ม/ย้ายหมวด/ลบทีละหลายชิ้น
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

  const activeFilters =
    p.filterCats.length + (p.filterTag ? 1 : 0) + (p.filterShop ? 1 : 0) + (p.search.trim() ? 1 : 0);

  return (
    <>
      {/* ตรึงแถบบน+ตัวกรองไว้บนสุดตอนเลื่อน — ช่องค้นหากับเมนู ⋯ (เลือกหลายรายการ/ส่งออก)
          จะได้กดได้จากทุกจุดของหน้า ไม่ต้องเลื่อนกลับขึ้นไปบนสุดก่อน */}
      <div className="toolbar-sticky">
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

          {/* นำเข้าออเดอร์จากร้านออนไลน์เป็นทางหลักที่ของเข้าสต็อก เลยเป็นปุ่มหลัก ส่วนกรอกเองเป็นปุ่มรอง */}
          <button className="btn-primary topbar__import" onClick={p.onImport}>📥 นำเข้าออเดอร์</button>
          <button className="btn-ghost topbar__add" onClick={p.onAdd}>＋ เพิ่มเอง</button>

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
                <button className="menu__item" onClick={run(p.onExport)}><i>📤</i> ส่งออก CSV</button>
                <button className="menu__item" onClick={run(p.onNewRecipe)}><i>🧮</i> สร้างสูตรต้นทุนใหม่</button>
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

          {p.filterShop && (
            <button
              className="chip-toggle is-active"
              onClick={p.onClearShop}
              title="เลิกกรองร้านนี้ (หรือกดแท็ก 🏪 บนการ์ดซ้ำก็ได้)"
            >
              🏪 {p.filterShopLabel || "ร้านที่เลือก"} ×
            </button>
          )}

          {activeFilters > 0 && (
            <button className="filterbar__clear" onClick={p.onClearFilters}>ล้างตัวกรอง ({activeFilters})</button>
          )}

          {/* "เลือกหลายรายการ" เคยอยู่ในเมนู ⋯ — เอาออกมาไว้ท้ายแถวตัวกรองที่ตรึงไว้ จะได้กดทีเดียวติด */}
          <button
            className={`select-mode-toggle ${p.selectMode ? "is-active" : ""}`}
            onClick={p.onToggleSelectMode}
            aria-pressed={p.selectMode}
            title={p.selectMode ? "ออกจากโหมดเลือกหลายรายการ" : "เลือกหลายรายการพร้อมกัน"}
          >
            <span aria-hidden>{p.selectMode ? "✕" : "☑️"}</span>
            {p.selectMode ? "ออกจากโหมดเลือก" : "เลือกหลายรายการ"}
          </button>
        </div>
      </div>

      {/* มือถือ: ปุ่มลอยสองชั้น — ตัวล่างเด่นคือนำเข้าออเดอร์ ตัวเล็กด้านบนคือกรอกเอง */}
      <button className="fab fab--add" onClick={p.onAdd} title="เพิ่มสินค้าเอง" aria-label="เพิ่มสินค้าเอง">＋</button>
      <button className="fab" onClick={p.onImport} title="นำเข้าออเดอร์จากร้านออนไลน์" aria-label="นำเข้าออเดอร์จากร้านออนไลน์">📥</button>
    </>
  );
}
