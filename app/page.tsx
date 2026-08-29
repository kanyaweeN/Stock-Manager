"use client";

import { useMemo, useState } from "react";
import FilterChips, { type ChipKey } from "@/components/FilterChips";
import Toolbar from "@/components/Toolbar";
import CategoryMultiSelect from "@/components/CategoryMultiSelect";
import ProductGrid from "@/components/ProductGrid";
import ProductModal from "@/components/ProductModal";
import ImportModal from "@/components/ImportModal";
import RecipeModal from "@/components/RecipeModal";
import PlanModal from "@/components/PlanModal";
import ModalShell from "@/components/ModalShell";
import AddToTargetModal from "@/components/AddToTargetModal";
import SelectActionBar from "@/components/SelectActionBar";
import { useStockDB } from "@/lib/StockDBProvider";
import { baht, emptyRecipe, lineFromItem, recipeTotals } from "@/lib/cost";
import { formatThaiShortDate } from "@/lib/date";
import { defaultDueDate, emptyPlan, isPlanDone, planLineFromItem, planTotals, sortPlans } from "@/lib/plan";
import { useProductFilters } from "@/lib/useProductFilters";
import { useProductActions } from "@/lib/useProductActions";
import { useSelection } from "@/lib/useSelection";
import { useRecipeActions } from "@/lib/useRecipeActions";
import { usePlanActions } from "@/lib/usePlanActions";
import type { PurchasePlan, Recipe, StockItem } from "@/lib/types";

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
    outOfStockCount, lowCount, totalUnits, uncategorizedCount, groupedCount, favCount, frequentCount, expiringCount,
  } = useProductFilters(db.items, db.categoryPresets);
  const actions = useProductActions(setDb);
  const {
    selectMode, setSelectMode, selectedIds, selectedItems,
    toggleSelect, allFilteredSelected, toggleSelectAllFiltered, exitSelectMode,
  } = useSelection(db.items, filtered);
  const recipeActions = useRecipeActions(setDb);
  const planActions = usePlanActions(setDb);
  const recipes = db.recipes ?? [];
  const plans = useMemo(() => sortPlans(db.plans ?? []), [db.plans]);

  const [modalItem, setModalItem] = useState<StockItem | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [groupNameOpen, setGroupNameOpen] = useState(false);
  const [groupNameInput, setGroupNameInput] = useState("");
  const [moveCatOpen, setMoveCatOpen] = useState(false);
  const [moveCatValue, setMoveCatValue] = useState<string[]>([]);
  const [recipeDraft, setRecipeDraft] = useState<Recipe | null>(null);
  /** สินค้าที่กำลังจะใส่เข้าสูตร — เปิดกล่องให้เลือกว่าจะใส่สูตรไหน (null = ไม่ได้เปิด) */
  const [recipeTargetItems, setRecipeTargetItems] = useState<StockItem[] | null>(null);
  const [planDraft, setPlanDraft] = useState<PurchasePlan | null>(null);
  /** สินค้าที่กำลังจะจดเข้าแผนซื้อของ — เปิดกล่องให้เลือกว่าจะใส่แผนไหน (null = ไม่ได้เปิด) */
  const [planTargetItems, setPlanTargetItems] = useState<StockItem[] | null>(null);

  const openAdd = () => { setModalItem(null); setModalOpen(true); };
  const openEdit = (item: StockItem) => { setModalItem(item); setModalOpen(true); };

  const handleSave = (data: Omit<StockItem, "id">, editId: string | null) => {
    actions.save(data, editId);
    setModalOpen(false);
  };


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

  const startNewPlanWith = (chosen: StockItem[]) => {
    setPlanTargetItems(null);
    setPlanDraft({ ...emptyPlan("", defaultDueDate()), lines: chosen.map(planLineFromItem) });
  };

  /** จดสินค้าไว้ในแผนซื้อของ — ถ้ายังไม่มีแผนเลยก็ข้ามไปสร้างแผนใหม่ให้เลย ไม่ต้องเลือก */
  const openAddToPlan = (chosen: StockItem[]) => {
    if (chosen.length === 0) return;
    if (plans.length === 0) startNewPlanWith(chosen);
    else setPlanTargetItems(chosen);
  };

  /**
   * ของที่ผูกกับแผนนั้นอยู่แล้วจะไม่เพิ่มซ้ำ — บรรทัดที่ itemId เดียวกันคือยอดเดียวกันที่ถูกนับสองรอบ
   * (ยังไม่บันทึกให้ตรงนี้ เปิด PlanModal ให้แก้จำนวน/ราคาก่อนแล้วค่อยกดบันทึกเอง)
   */
  const addToExistingPlan = (plan: PurchasePlan) => {
    const inPlan = new Set(plan.lines.map((l) => l.itemId).filter(Boolean));
    const chosen = (planTargetItems ?? []).filter((i) => !inPlan.has(i.id));
    setPlanTargetItems(null);
    setPlanDraft({ ...plan, lines: [...plan.lines, ...chosen.map(planLineFromItem)] });
  };

  const handleSavePlan = (plan: PurchasePlan) => {
    planActions.save(plan);
    setPlanDraft(null);
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
          // นับแถวดิบเหมือนชิปอื่นทุกตัว — เดิมใช้ `countUnits` (กลุ่มนับรวมเป็น 1) ทำให้
          // "ทั้งหมด" น้อยกว่า "มีสินค้า" ได้เมื่อมีการจัดกลุ่มไว้ ซึ่งอ่านแล้วขัดกัน
          all: db.items.length,
          totalUnits,
          inStock: db.items.length - outOfStockCount,
          low: lowCount,
          outOfStock: outOfStockCount,
          uncategorized: uncategorizedCount,
          grouped: groupedCount,
          fav: favCount,
          frequent: frequentCount,
          expiring: expiringCount,
          categories: categoryCount,
        }}
        active={activeChip}
        onSelect={selectChip}
      />

      {selectMode && (
        <SelectActionBar
          selectedCount={selectedIds.size}
          filteredCount={filtered.length}
          allFilteredSelected={allFilteredSelected}
          onToggleSelectAll={toggleSelectAllFiltered}
          onGroup={openGroupNamePrompt}
          onMoveCats={openMoveCatPrompt}
          onToggleFav={() => { actions.toggleFavForItems([...selectedIds]); exitSelectMode(); }}
          onAddToRecipe={() => { openAddToRecipe(selectedItems); exitSelectMode(); }}
          onAddToPlan={() => { openAddToPlan(selectedItems); exitSelectMode(); }}
          // ยกเลิกใน confirm แล้วต้องไม่หลุดออกจากโหมดเลือก ไม่งั้นที่เลือกไว้หายหมดฟรีๆ
          onRemove={() => { if (actions.removeMany(selectedItems)) exitSelectMode(); }}
          onCancel={exitSelectMode}
        />
      )}

      <ProductGrid
        items={filtered}
        avoidIngredients={db.avoidIngredients}
        skinProfile={db.skinProfile}
        onInc={actions.inc}
        onDec={actions.dec}
        onEdit={openEdit}
        onDelete={actions.remove}
        onToggleFav={actions.toggleFav}
        onAddToRecipe={(item) => openAddToRecipe([item])}
        onAddToPlan={(item) => openAddToPlan([item])}
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
        runs={recipeDraft ? recipes.find((r) => r.id === recipeDraft.id)?.runs : undefined}
        onLogRun={recipeActions.logRun}
        onRemoveRun={recipeActions.removeRun}
      />
      <PlanModal
        open={planDraft !== null}
        plan={planDraft}
        items={db.items}
        onClose={() => setPlanDraft(null)}
        onSave={handleSavePlan}
      />

      {planTargetItems && (
        <AddToTargetModal
          title={`จด ${planTargetItems.length} รายการไว้ในแผนไหน?`}
          items={planTargetItems}
          itemLine={(i) => `${i.name}${i.price != null ? ` · ฿${i.price}` : ""} · เหลือ ${i.qty}`}
          pickLabel="เลือกแผนที่มีอยู่"
          targets={plans}
          targetKey={(p) => p.id}
          targetName={(p) => {
            const already = planTargetItems.filter((i) => p.lines.some((l) => l.itemId === i.id)).length;
            return (
              <>
                {isPlanDone(p) && "✅ "}
                {p.name || "(ไม่มีชื่อ)"}
                {already > 0 && <small> · มีอยู่แล้ว {already}</small>}
              </>
            );
          }}
          targetMeta={(p) => {
            const t = planTotals(p);
            return `${t.lines} รายการ · ยังต้องจ่าย ${baht(t.remaining)}${p.dueDate ? ` · ภายใน ${formatThaiShortDate(p.dueDate)}` : ""}`;
          }}
          onPick={addToExistingPlan}
          newLabel="+ แผนใหม่"
          onNew={() => startNewPlanWith(planTargetItems)}
          onClose={() => setPlanTargetItems(null)}
        />
      )}

      {recipeTargetItems && (
        <AddToTargetModal
          title={`ใส่ ${recipeTargetItems.length} รายการในสูตรไหน?`}
          items={recipeTargetItems}
          itemLine={(i) => `${i.name}${i.price != null ? ` · ฿${i.price}` : ""}${i.size ? ` · ${i.size}` : ""}`}
          pickLabel="เลือกสูตรที่มีอยู่"
          targets={recipes}
          targetKey={(r) => r.id}
          targetName={(r) => r.name || "(ไม่มีชื่อ)"}
          targetMeta={(r) => `วัตถุดิบ ${r.lines.length} · ${baht(recipeTotals(r).perUnitCost)}/${r.yieldUnit}`}
          onPick={addToExistingRecipe}
          newLabel="+ สูตรใหม่"
          onNew={() => startNewRecipeWith(recipeTargetItems)}
          onClose={() => setRecipeTargetItems(null)}
        />
      )}

      <ImportModal
        open={importOpen}
        categories={categorySuggestions}
        items={db.items}
        orders={db.orders}
        onClose={() => setImportOpen(false)}
        onImport={actions.importFromShopee}
      />

      {groupNameOpen && (
        <ModalShell open title={`จัดกลุ่ม ${selectedItems.length} รายการ`} onClose={() => setGroupNameOpen(false)}>
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
        </ModalShell>
      )}

      {moveCatOpen && (
        <ModalShell open title={`ย้ายหมวดหมู่ ${selectedItems.length} รายการ`} onClose={() => setMoveCatOpen(false)}>
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
        </ModalShell>
      )}
    </div>
  );
}
