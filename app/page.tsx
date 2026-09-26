"use client";

import { useEffect, useMemo, useState } from "react";
import FilterChips, { type ChipKey } from "@/components/product/FilterChips";
import Toolbar from "@/components/product/Toolbar";
import CategoryMultiSelect from "@/components/ui/CategoryMultiSelect";
import ProductGrid from "@/components/product/ProductGrid";
import ProductModal from "@/components/product/ProductModal";
import ImportModal from "@/components/import/ImportModal";
import RecipeModal from "@/components/recipe/RecipeModal";
import PlanModal from "@/components/plan/PlanModal";
import ModalShell from "@/components/ui/ModalShell";
import AddToTargetModal from "@/components/product/AddToTargetModal";
import GroupNamePromptModal from "@/components/product/GroupNamePromptModal";
import SelectActionBar from "@/components/product/SelectActionBar";
import { useStockDB } from "@/hooks/StockDBProvider";
import { useClientValue } from "@/hooks/useClientValue";
import { baht, emptyRecipe, lineFromItem, recipeTotals } from "@/lib/domain/cost";
import { groupNameMap } from "@/lib/domain/groups";
import { formatThaiShortDate } from "@/lib/core/date";
import { defaultDueDate, emptyPlan, isPlanDone, planLineFromItem, planTotals, sortPlans } from "@/lib/domain/plan";
import { useProductFilters } from "@/hooks/useProductFilters";
import { useProductActions } from "@/hooks/useProductActions";
import { useSelection } from "@/hooks/useSelection";
import { CAT_EDIT_MODES, useCatEditor } from "@/hooks/useCatEditor";
import { useTargetDraft } from "@/hooks/useTargetDraft";
import { useRecipeActions } from "@/hooks/useRecipeActions";
import { usePlanActions } from "@/hooks/usePlanActions";
import type { PurchasePlan, Recipe, StockItem } from "@/lib/types";
import { cn } from "@/lib/utils";

export default function Home() {
  const { db, setDb } = useStockDB();
  const {
    search, setSearch,
    filterCats, setFilterCats, toggleCatFilter,
    uncategorizedOnly, toggleUncategorizedOnly,
    sortKey, setSortKey,
    stockTab, setStockTab,
    filterTag, setFilterTag,
    excludeTag, setExcludeTag,
    filterShop, setFilterShop, filterShopLabel, toggleShopFilter,
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
  const forecastIds = useMemo(() => new Set(db.forecastItemIds ?? []), [db.forecastItemIds]);
  const groupNames = useMemo(() => groupNameMap(db.groups), [db.groups]);

  const [modalItem, setModalItem] = useState<StockItem | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [groupNameOpen, setGroupNameOpen] = useState(false);

  /**
   * ลิงก์จากหน้าอื่นมาหาการ์ดสินค้าชิ้นเดียว (`/?item=<id>` เช่นจากรายการในแผนซื้อของ)
   * อ่านจาก `window.location` ตอน mount แทน `useSearchParams` เพราะตัวหลังบังคับให้ต้องห่อทั้งหน้าด้วย <Suspense>
   * แล้วลบพารามิเตอร์ทิ้งทันที ไม่ให้ค้างบน URL ตอนผู้ใช้รีเฟรชหรือบุ๊กมาร์กหน้านี้ไว้
   */
  // อ่านตอนเรนเดอร์ (หลัง hydrate) ไม่ใช่ setState ใน effect — ฝั่ง server ไม่มี URL ให้อ่านอยู่แล้ว
  const highlightId = useClientValue(
    () => new URLSearchParams(window.location.search).get("item") ?? undefined,
    undefined,
  );
  // ลบพารามิเตอร์ทิ้งหลังอ่านแล้ว — แตะ history เป็น side effect จริง จึงยังอยู่ใน effect
  useEffect(() => {
    if (!highlightId) return;
    window.history.replaceState(null, "", window.location.pathname);
  }, [highlightId]);

  const catEditor = useCatEditor({
    selectedItems,
    suggestions: categorySuggestions,
    apply: (cats, mode) => actions.setCatsForItems([...selectedIds], cats, mode),
    onDone: exitSelectMode,
  });
  const recipe = useTargetDraft<Recipe>({
    targets: recipes,
    emptyTarget: emptyRecipe,
    lineFromItem,
    save: recipeActions.save,
  });
  const plan = useTargetDraft<PurchasePlan>({
    targets: plans,
    emptyTarget: () => emptyPlan("", defaultDueDate()),
    lineFromItem: planLineFromItem,
    save: planActions.save,
  });
  // อ่านออกมาเป็น const ก่อน เพื่อให้ TS แคบชนิดเป็น StockItem[] ให้ในบล็อก JSX ข้างล่าง
  const recipeTargets = recipe.targetItems;
  const planTargets = plan.targetItems;

  const openAdd = () => { setModalItem(null); setModalOpen(true); };
  const openEdit = (item: StockItem) => { setModalItem(item); setModalOpen(true); };

  const handleSave = (data: Omit<StockItem, "id">, editId: string | null) => {
    actions.save(data, editId);
    setModalOpen(false);
  };


  const openGroupNamePrompt = () => setGroupNameOpen(true);

  const confirmGroupSelected = (name: string) => {
    actions.groupItems([...selectedIds], name);
    setGroupNameOpen(false);
    exitSelectMode();
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
    setFilterShop("");
  };

  return (
    <div className={cn("page", selectMode && "page--with-select-bar")}>
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
        filterShop={filterShop}
        filterShopLabel={filterShopLabel}
        onClearShop={() => setFilterShop("")}
        onClearFilters={clearFilters}
        onAdd={openAdd}
        onNewRecipe={() => recipe.setDraft(emptyRecipe())}
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
          onMoveCats={catEditor.openPrompt}
          onToggleFav={() => { actions.toggleFavForItems([...selectedIds]); exitSelectMode(); }}
          onAddToRecipe={() => { recipe.openAddTo(selectedItems); exitSelectMode(); }}
          onAddToPlan={() => { plan.openAddTo(selectedItems); exitSelectMode(); }}
          onAddToForecast={() => { actions.addToForecastMany([...selectedIds]); exitSelectMode(); }}
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
        onIncPiece={actions.incPiece}
        onDecPiece={actions.decPiece}
        onEdit={openEdit}
        onDelete={actions.remove}
        onToggleFav={actions.toggleFav}
        onAddToRecipe={(item) => recipe.openAddTo([item])}
        onAddToPlan={(item) => plan.openAddTo([item])}
        onToggleForecast={(item) => actions.toggleForecast(item.id)}
        forecastIds={forecastIds}
        onFilterShop={toggleShopFilter}
        activeShopKey={filterShop}
        onFilterCat={toggleCatFilter}
        activeCats={filterCats}
        selectMode={selectMode}
        selectedIds={selectedIds}
        onToggleSelect={toggleSelect}
        groups={db.groups}
        onRenameGroup={actions.renameGroup}
        highlightId={highlightId}
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
        groupName={modalItem?.groupId ? groupNames.get(modalItem.groupId) : undefined}
      />
      <RecipeModal
        open={recipe.draft !== null}
        recipe={recipe.draft}
        items={db.items}
        onClose={() => recipe.closeDraft()}
        onSave={recipe.saveDraft}
        runs={recipes.find((r) => r.id === recipe.draft?.id)?.runs}
        onLogRun={recipeActions.logRun}
        onRemoveRun={recipeActions.removeRun}
      />
      <PlanModal
        open={plan.draft !== null}
        plan={plan.draft}
        items={db.items}
        onClose={() => plan.closeDraft()}
        onSave={plan.saveDraft}
      />

      {planTargets && (
        <AddToTargetModal
          title={`จด ${planTargets.length} รายการไว้ในแผนไหน?`}
          items={planTargets}
          itemLine={(i) => `${i.name}${i.price != null ? ` · ฿${i.price}` : ""} · เหลือ ${i.qty}`}
          pickLabel="เลือกแผนที่มีอยู่"
          targets={plans}
          targetKey={(p) => p.id}
          targetName={(p) => {
            const already = planTargets.filter((i) => p.lines.some((l) => l.itemId === i.id)).length;
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
          onPick={plan.addToExisting}
          newLabel="+ แผนใหม่"
          onNew={() => plan.startNewWith(planTargets)}
          onClose={() => plan.closePicker()}
        />
      )}

      {recipeTargets && (
        <AddToTargetModal
          title={`ใส่ ${recipeTargets.length} รายการในสูตรไหน?`}
          items={recipeTargets}
          itemLine={(i) => `${i.name}${i.price != null ? ` · ฿${i.price}` : ""}${i.size ? ` · ${i.size}` : ""}`}
          pickLabel="เลือกสูตรที่มีอยู่"
          targets={recipes}
          targetKey={(r) => r.id}
          targetName={(r) => {
            const already = recipeTargets.filter((i) => r.lines.some((l) => l.itemId === i.id)).length;
            return (
              <>
                {r.name || "(ไม่มีชื่อ)"}
                {already > 0 && <small> · มีอยู่แล้ว {already}</small>}
              </>
            );
          }}
          targetMeta={(r) => `วัตถุดิบ ${r.lines.length} · ${baht(recipeTotals(r).perUnitCost)}/${r.yieldUnit}`}
          onPick={recipe.addToExisting}
          newLabel="+ สูตรใหม่"
          onNew={() => recipe.startNewWith(recipeTargets)}
          onClose={() => recipe.closePicker()}
        />
      )}

      <ImportModal
        open={importOpen}
        categories={categorySuggestions}
        items={db.items}
        orders={db.orders}
        onClose={() => setImportOpen(false)}
        onImport={actions.importOrder}
      />

      <GroupNamePromptModal
        open={groupNameOpen}
        title={`จัดกลุ่ม ${selectedItems.length} รายการ`}
        initialValue={selectedItems[0]?.name || ""}
        saveLabel="จัดกลุ่ม"
        onSave={confirmGroupSelected}
        onClose={() => setGroupNameOpen(false)}
      >
        <p className="sub sub-tight text-xs">
          ทุกรายการที่เลือกไว้จะยังอยู่แยกกันเหมือนเดิม (จำนวน/ราคาของใครของมัน) แค่ติดป้ายกลุ่มเดียวกันไว้ให้รู้ว่าเป็นสินค้าตัวเดียวกัน
        </p>
        <div className="category-list" style={{ marginBottom: 12 }}>
          {selectedItems.map((i) => (
            <div className="category-row" key={i.id}><span>{i.name} · {i.qty} ชิ้น</span></div>
          ))}
        </div>
      </GroupNamePromptModal>

      {catEditor.open && (
        <ModalShell open title={`จัดหมวดหมู่ ${selectedItems.length} รายการ`} onClose={() => catEditor.close()}>
          <div className="modal-body">
            <div className="cat-modes">
              {CAT_EDIT_MODES.map((m) => (
                <button
                  key={m.key}
                  type="button"
                  className={cn("chip-toggle", catEditor.mode === m.key && "is-active")}
                  aria-pressed={catEditor.mode === m.key}
                  onClick={() => catEditor.changeMode(m.key)}
                >
                  {m.label}
                </button>
              ))}
            </div>
            <p className="sub sub-tight text-xs">{catEditor.meta.hint}</p>
            <div className="field">
              <label>{catEditor.meta.field}</label>
              <CategoryMultiSelect
                categories={catEditor.options}
                selected={catEditor.value}
                onChange={catEditor.setValue}
                allowCreate={catEditor.mode !== "remove"}
                emptyLabel={catEditor.mode === "replace" ? "ไม่มีหมวดหมู่" : "ยังไม่ได้เลือก"}
              />
            </div>
            <div className="cat-preview__head">
              ผลลัพธ์ · เปลี่ยน {catEditor.changedCount} จาก {selectedItems.length} รายการ
            </div>
            <div className="cat-preview">
              {catEditor.preview.map(({ item, after, added, removed, changed }) => (
                <div className={cn("cat-preview__row", changed && "is-changed")} key={item.id}>
                  <span className="cat-preview__name">{item.name}</span>
                  <span className="cat-preview__cats">
                    {after.length === 0 && removed.length === 0 && <span className="cat-preview__none">ไม่มีหมวดหมู่</span>}
                    {after.map((c) => (
                      <span key={c} className={cn("cat-preview__chip", added.includes(c) && "cat-preview__chip--add")}>{c}</span>
                    ))}
                    {removed.map((c) => (
                      <span key={`-${c}`} className="cat-preview__chip cat-preview__chip--del">{c}</span>
                    ))}
                  </span>
                </div>
              ))}
            </div>
          </div>
          <div className="modal-actions">
            <button className="btn-ghost" onClick={() => catEditor.close()}>ยกเลิก</button>
            <button className="btn-primary" onClick={catEditor.confirm} disabled={catEditor.changedCount === 0}>{catEditor.meta.confirm}</button>
          </div>
        </ModalShell>
      )}
    </div>
  );
}
