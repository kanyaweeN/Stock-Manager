"use client";

import { useMemo, useState } from "react";
import FilterChips, { type ChipKey } from "@/components/FilterChips";
import Toolbar from "@/components/Toolbar";
import CategoryMultiSelect from "@/components/CategoryMultiSelect";
import ProductGrid from "@/components/ProductGrid";
import ProductModal from "@/components/ProductModal";
import ImportModal from "@/components/ImportModal";
import RecipeModal from "@/components/RecipeModal";
import { useStockDB } from "@/lib/StockDBProvider";
import { countUnits } from "@/lib/db";
import { baht, emptyRecipe, lineFromItem, recipeTotals } from "@/lib/cost";
import { useProductFilters } from "@/lib/useProductFilters";
import { useProductActions } from "@/lib/useProductActions";
import { useRecipeActions } from "@/lib/useRecipeActions";
import type { Recipe, StockItem } from "@/lib/types";

export default function Home() {
  const { db, setDb } = useStockDB();
  const {
    search, setSearch,
    filterCats, setFilterCats,
    uncategorizedOnly, toggleUncategorizedOnly,
    sortKey, setSortKey,
    stockTab, setStockTab,
    filterTag, setFilterTag,
    excludeTag, setExcludeTag,
    availableTags, withIngredientsCount,
    categorySuggestions, filtered,
    outOfStockCount, lowCount, totalUnits, uncategorizedCount, groupedCount,
  } = useProductFilters(db.items, db.categoryPresets);
  const actions = useProductActions(setDb);
  const recipeActions = useRecipeActions(setDb);
  const recipes = db.recipes ?? [];

  const [modalItem, setModalItem] = useState<StockItem | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [groupNameOpen, setGroupNameOpen] = useState(false);
  const [groupNameInput, setGroupNameInput] = useState("");
  const [moveCatOpen, setMoveCatOpen] = useState(false);
  const [moveCatValue, setMoveCatValue] = useState<string[]>([]);
  const [recipeDraft, setRecipeDraft] = useState<Recipe | null>(null);
  /** สินค้าที่กำลังจะใส่เข้าสูตร — เปิดกล่องให้เลือกว่าจะใส่สูตรไหน (null = ไม่ได้เปิด) */
  const [recipeTargetItems, setRecipeTargetItems] = useState<StockItem[] | null>(null);

  const openAdd = () => { setModalItem(null); setModalOpen(true); };
  const openEdit = (item: StockItem) => { setModalItem(item); setModalOpen(true); };

  const handleSave = (data: Omit<StockItem, "id">, editId: string | null) => {
    actions.save(data, editId);
    setModalOpen(false);
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  /**
   * เลือกทั้งหมด = เฉพาะรายการที่มองเห็นอยู่ตอนนี้ (ผ่านตัวกรอง/คำค้นแล้ว) ไม่ใช่ทั้งสต็อก
   * จะได้ใช้คู่กับตัวกรองเพื่อ "ลบทั้งหมดในหมวดนี้" ได้ และไม่เผลอลบของที่มองไม่เห็น
   */
  const allFilteredSelected = filtered.length > 0 && filtered.every((i) => selectedIds.has(i.id));
  const toggleSelectAllFiltered = () => {
    setSelectedIds(allFilteredSelected ? new Set() : new Set(filtered.map((i) => i.id)));
  };

  const exitSelectMode = () => {
    setSelectMode(false);
    setSelectedIds(new Set());
  };

  const selectedItems = db.items.filter((i) => selectedIds.has(i.id));

  const openGroupNamePrompt = () => {
    setGroupNameInput(selectedItems[0]?.name || "");
    setGroupNameOpen(true);
  };

  const confirmGroupSelected = () => {
    const name = groupNameInput.trim();
    if (!name) return;
    actions.groupItems([...selectedIds], name);
    setGroupNameOpen(false);
    exitSelectMode();
  };

  const openMoveCatPrompt = () => {
    setMoveCatValue([]);
    setMoveCatOpen(true);
  };

  const confirmMoveCat = () => {
    actions.setCatsForItems([...selectedIds], moveCatValue);
    setMoveCatOpen(false);
    exitSelectMode();
  };

  const startNewRecipeWith = (chosen: StockItem[]) => {
    setRecipeTargetItems(null);
    setRecipeDraft({ ...emptyRecipe(), lines: chosen.map(lineFromItem) });
  };

  /** ใส่สินค้าเข้าสูตร — ถ้ายังไม่มีสูตรเลยก็ข้ามไปสร้างสูตรใหม่ให้เลย ไม่ต้องเลือก */
  const openAddToRecipe = (chosen: StockItem[]) => {
    if (chosen.length === 0) return;
    if (recipes.length === 0) startNewRecipeWith(chosen);
    else setRecipeTargetItems(chosen);
  };

  const addToExistingRecipe = (recipe: Recipe) => {
    const chosen = recipeTargetItems ?? [];
    setRecipeTargetItems(null);
    setRecipeDraft({ ...recipe, lines: [...recipe.lines, ...chosen.map(lineFromItem)] });
  };

  const handleSaveRecipe = (recipe: Recipe) => {
    recipeActions.save(recipe);
    setRecipeDraft(null);
  };

  const categoryCount = useMemo(() => new Set(db.items.flatMap((i) => i.cats)).size, [db.items]);

  /** ชิปตัวเลขทั้งแถวเลือกได้ทีละอัน — กดชิปที่เปิดอยู่ซ้ำ = กลับไป "ทั้งหมด" */
  const activeChip: ChipKey = uncategorizedOnly ? "uncategorized" : stockTab;
  const selectChip = (key: ChipKey) => {
    const next = key === activeChip ? "all" : key;
    if (next === "uncategorized") {
      if (!uncategorizedOnly) toggleUncategorizedOnly();
      setStockTab("all");
      return;
    }
    if (uncategorizedOnly) toggleUncategorizedOnly();
    setStockTab(next);
  };

  const clearFilters = () => {
    setSearch("");
    setFilterCats([]);
    setFilterTag("");
    setExcludeTag(false);
  };

  return (
    <div className={`page ${selectMode ? "page--with-select-bar" : ""}`}>
      <Toolbar
        title="สินค้าทั้งหมด"
        search={search}
        onSearch={setSearch}
        categories={categorySuggestions}
        filterCats={filterCats}
        onFilterCats={setFilterCats}
        sortKey={sortKey}
        onSortKey={setSortKey}
        availableTags={availableTags}
        withIngredientsCount={withIngredientsCount}
        filterTag={filterTag}
        onFilterTag={setFilterTag}
        excludeTag={excludeTag}
        onExcludeTag={setExcludeTag}
        onClearFilters={clearFilters}
        onAdd={openAdd}
        onNewRecipe={() => setRecipeDraft(emptyRecipe())}
        onImport={() => setImportOpen(true)}
        onExport={() => actions.exportCsv(db.items)}
        selectMode={selectMode}
        onToggleSelectMode={() => (selectMode ? exitSelectMode() : setSelectMode(true))}
      />

      <FilterChips
        counts={{
          all: countUnits(db.items),
          totalUnits,
          inStock: db.items.length - outOfStockCount,
          low: lowCount,
          outOfStock: outOfStockCount,
          uncategorized: uncategorizedCount,
          grouped: groupedCount,
          categories: categoryCount,
        }}
        active={activeChip}
        onSelect={selectChip}
      />

      {selectMode && (
        <div className="select-action-bar">
          <span>เลือกไว้ {selectedIds.size} รายการ</span>
          <button className="btn-ghost" onClick={toggleSelectAllFiltered}>
            {allFilteredSelected ? "ล้างที่เลือก" : `เลือกทั้งหมด (${filtered.length})`}
          </button>
          <button
            className="btn-primary"
            disabled={selectedIds.size < 2}
            onClick={openGroupNamePrompt}
          >
            👥 จัดกลุ่มที่เลือก
          </button>
          <button
            className="btn-ghost"
            disabled={selectedIds.size < 1}
            onClick={openMoveCatPrompt}
          >
            🏷️ ย้ายหมวดหมู่
          </button>
          <button
            className="btn-ghost"
            disabled={selectedIds.size < 1}
            onClick={() => { openAddToRecipe(selectedItems); exitSelectMode(); }}
          >
            🧮 ใส่ในสูตรต้นทุน
          </button>
          <button
            className="btn-danger"
            disabled={selectedIds.size < 1}
            // ยกเลิกใน confirm แล้วต้องไม่หลุดออกจากโหมดเลือก ไม่งั้นที่เลือกไว้หายหมดฟรีๆ
            onClick={() => { if (actions.removeMany(selectedItems)) exitSelectMode(); }}
          >
            🗑️ ลบที่เลือก
          </button>
          <button className="btn-ghost" onClick={exitSelectMode}>ยกเลิก</button>
        </div>
      )}

      <ProductGrid
        items={filtered}
        avoidIngredients={db.avoidIngredients}
        skinProfile={db.skinProfile}
        onInc={actions.inc}
        onDec={actions.dec}
        onEdit={openEdit}
        onDelete={actions.remove}
        onAddToRecipe={(item) => openAddToRecipe([item])}
        selectMode={selectMode}
        selectedIds={selectedIds}
        onToggleSelect={toggleSelect}
      />

      <ProductModal
        open={modalOpen}
        item={modalItem}
        categories={categorySuggestions}
        avoidIngredients={db.avoidIngredients}
        skinProfile={db.skinProfile}
        onClose={() => setModalOpen(false)}
        onSave={handleSave}
        onUngroup={actions.ungroup}
      />
      <RecipeModal
        open={recipeDraft !== null}
        recipe={recipeDraft}
        items={db.items}
        onClose={() => setRecipeDraft(null)}
        onSave={handleSaveRecipe}
      />

      {recipeTargetItems && (
        <div className="modal-backdrop open">
          <div className="modal">
            <div className="modal-header">
              <h2>ใส่ {recipeTargetItems.length} รายการในสูตรไหน?</h2>
              <button className="modal-close" title="ปิด" onClick={() => setRecipeTargetItems(null)}>×</button>
            </div>
            <div className="modal-body">
              <div className="category-list" style={{ marginBottom: 12 }}>
                {recipeTargetItems.map((i) => (
                  <div className="category-row" key={i.id}>
                    <span>{i.name}{i.price != null ? ` · ฿${i.price}` : ""}{i.size ? ` · ${i.size}` : ""}</span>
                  </div>
                ))}
              </div>
              <label className="text-xs" style={{ color: "var(--muted)" }}>เลือกสูตรที่มีอยู่</label>
              <div className="stock-picker__list">
                {recipes.map((r) => (
                  <button className="stock-picker__row" key={r.id} onClick={() => addToExistingRecipe(r)}>
                    <span className="stock-picker__name">{r.name || "(ไม่มีชื่อ)"}</span>
                    <span className="stock-picker__meta">
                      วัตถุดิบ {r.lines.length} · {baht(recipeTotals(r).perUnitCost)}/{r.yieldUnit}
                    </span>
                  </button>
                ))}
              </div>
            </div>
            <div className="modal-actions">
              <button className="btn-ghost" onClick={() => setRecipeTargetItems(null)}>ยกเลิก</button>
              <button className="btn-primary" onClick={() => startNewRecipeWith(recipeTargetItems)}>+ สูตรใหม่</button>
            </div>
          </div>
        </div>
      )}

      <ImportModal
        open={importOpen}
        categories={categorySuggestions}
        items={db.items}
        onClose={() => setImportOpen(false)}
        onImport={actions.importFromShopee}
      />

      {groupNameOpen && (
        <div className="modal-backdrop open">
          <div className="modal">
            <div className="modal-header">
              <h2>จัดกลุ่ม {selectedItems.length} รายการ</h2>
              <button className="modal-close" title="ปิด" onClick={() => setGroupNameOpen(false)}>×</button>
            </div>
            <div className="modal-body">
              <p className="sub sub-tight text-xs">
                ทุกรายการที่เลือกไว้จะยังอยู่แยกกันเหมือนเดิม (จำนวน/ราคาของใครของมัน) แค่ติดป้ายกลุ่มเดียวกันไว้ให้รู้ว่าเป็นสินค้าตัวเดียวกัน
              </p>
              <div className="category-list" style={{ marginBottom: 12 }}>
                {selectedItems.map((i) => (
                  <div className="category-row" key={i.id}><span>{i.name} · {i.qty} ชิ้น</span></div>
                ))}
              </div>
              <div className="field">
                <label>ชื่อกลุ่ม</label>
                <input
                  type="text"
                  value={groupNameInput}
                  onChange={(e) => setGroupNameInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") confirmGroupSelected(); }}
                  autoFocus
                />
              </div>
            </div>
            <div className="modal-actions">
              <button className="btn-ghost" onClick={() => setGroupNameOpen(false)}>ยกเลิก</button>
              <button className="btn-primary" onClick={confirmGroupSelected}>จัดกลุ่ม</button>
            </div>
          </div>
        </div>
      )}

      {moveCatOpen && (
        <div className="modal-backdrop open">
          <div className="modal">
            <div className="modal-header">
              <h2>ย้ายหมวดหมู่ {selectedItems.length} รายการ</h2>
              <button className="modal-close" title="ปิด" onClick={() => setMoveCatOpen(false)}>×</button>
            </div>
            <div className="modal-body">
              <p className="sub sub-tight text-xs">
                หมวดหมู่ใหม่ที่เลือกจะไปแทนที่หมวดหมู่เดิมของทุกรายการที่เลือกไว้ (เลือกว่างไว้เพื่อลบหมวดหมู่ออกทั้งหมด)
              </p>
              <div className="category-list" style={{ marginBottom: 12 }}>
                {selectedItems.map((i) => (
                  <div className="category-row" key={i.id}><span>{i.name}</span></div>
                ))}
              </div>
              <div className="field">
                <label>หมวดหมู่ใหม่</label>
                <CategoryMultiSelect
                  categories={categorySuggestions}
                  selected={moveCatValue}
                  onChange={setMoveCatValue}
                  allowCreate
                  emptyLabel="ไม่มีหมวดหมู่"
                />
              </div>
            </div>
            <div className="modal-actions">
              <button className="btn-ghost" onClick={() => setMoveCatOpen(false)}>ยกเลิก</button>
              <button className="btn-primary" onClick={confirmMoveCat}>ย้ายหมวดหมู่</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
