"use client";

import Link from "next/link";
import { useState } from "react";
import StatsBar from "@/components/StatsBar";
import CategoryMultiSelect from "@/components/CategoryMultiSelect";
import ProductGrid from "@/components/ProductGrid";
import ProductModal from "@/components/ProductModal";
import ImportModal from "@/components/ImportModal";
import { useStockDB } from "@/lib/StockDBProvider";
import { countUnits } from "@/lib/db";
import { useProductFilters, type SortKey, type StockTab } from "@/lib/useProductFilters";
import { useProductActions } from "@/lib/useProductActions";
import type { StockItem } from "@/lib/types";
import packageJson from "@/package.json";

export default function Home() {
  const { db, setDb, status } = useStockDB();
  const {
    search, setSearch,
    filterCats, setFilterCats,
    uncategorizedOnly, toggleUncategorizedOnly,
    sortKey, setSortKey,
    stockTab, setStockTab,
    categorySuggestions, filtered,
    outOfStockCount, uncategorizedCount, groupedCount,
  } = useProductFilters(db.items, db.categoryPresets);
  const actions = useProductActions(setDb);

  const [modalItem, setModalItem] = useState<StockItem | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [groupNameOpen, setGroupNameOpen] = useState(false);
  const [groupNameInput, setGroupNameInput] = useState("");

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

  return (
    <div className={`wrap ${selectMode ? "wrap--with-select-bar" : ""}`}>
      <h1>📦 จัดการสต็อกสินค้า</h1>
      <p className="sub">{status.msg}</p>
      <p className="sub sub-tight text-xs">เวอร์ชัน {packageJson.version}</p>

      <StatsBar items={db.items} />

      <div className="stock-tabs">
        <button className={`stock-tab ${stockTab === "all" ? "active" : ""}`} onClick={() => setStockTab("all")}>
          ทั้งหมด ({countUnits(db.items)})
        </button>
        <button className={`stock-tab ${stockTab === "in-stock" ? "active" : ""}`} onClick={() => setStockTab("in-stock")}>
          มีสินค้า ({db.items.length - outOfStockCount})
        </button>
        <button className={`stock-tab ${stockTab === "out-of-stock" ? "active" : ""}`} onClick={() => setStockTab("out-of-stock")}>
          หมดแล้ว ({outOfStockCount})
        </button>
        <button className={`stock-tab ${uncategorizedOnly ? "active" : ""}`} onClick={toggleUncategorizedOnly}>
          ไม่มีหมวดหมู่ ({uncategorizedCount})
        </button>
        <button className={`stock-tab ${stockTab === "grouped" ? "active" : ""}`} onClick={() => setStockTab("grouped")}>
          👥 กลุ่ม ({groupedCount})
        </button>
      </div>

      <div className="toolbar">
        <input
          id="search"
          type="text"
          placeholder="ค้นหาชื่อสินค้า..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <CategoryMultiSelect categories={categorySuggestions} selected={filterCats} onChange={setFilterCats} />
        <select value={sortKey} onChange={(e) => setSortKey(e.target.value as SortKey)}>
          <option value="name-asc">ชื่อ ก-ฮ</option>
          <option value="name-desc">ชื่อ ฮ-ก</option>
          <option value="qty-asc">จำนวนน้อย-มาก</option>
          <option value="qty-desc">จำนวนมาก-น้อย</option>
          <option value="price-asc">ราคาต่ำ-สูง</option>
          <option value="price-desc">ราคาสูง-ต่ำ</option>
        </select>
        <button className="btn-primary" onClick={openAdd}>+ เพิ่มสินค้า</button>
        <button className="btn-ghost" onClick={() => setImportOpen(true)}>นำเข้าจาก Shopee</button>
        <button className="btn-ghost" onClick={() => actions.exportCsv(db.items)}>ส่งออก CSV</button>
        {selectMode ? (
          <button className="btn-ghost" onClick={exitSelectMode}>ยกเลิกการเลือก</button>
        ) : (
          <button className="btn-ghost" onClick={() => setSelectMode(true)}>☑️ เลือกหลายอัน</button>
        )}
        <Link href="/config" className="btn-ghost">⚙️ ตั้งค่า</Link>
      </div>

      {selectMode && (
        <div className="select-action-bar">
          <span>เลือกไว้ {selectedIds.size} รายการ</span>
          <button
            className="btn-primary"
            disabled={selectedIds.size < 2}
            onClick={openGroupNamePrompt}
          >
            👥 จัดกลุ่มที่เลือก
          </button>
          <button className="btn-ghost" onClick={exitSelectMode}>ยกเลิก</button>
        </div>
      )}

      <ProductGrid
        items={filtered}
        onInc={actions.inc}
        onDec={actions.dec}
        onEdit={openEdit}
        onDelete={actions.remove}
        selectMode={selectMode}
        selectedIds={selectedIds}
        onToggleSelect={toggleSelect}
      />

      <ProductModal
        open={modalOpen}
        item={modalItem}
        categories={categorySuggestions}
        onClose={() => setModalOpen(false)}
        onSave={handleSave}
        onUngroup={actions.ungroup}
      />
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
    </div>
  );
}
