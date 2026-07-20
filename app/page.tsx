"use client";

import Link from "next/link";
import { useState } from "react";
import StatsBar from "@/components/StatsBar";
import ProductGrid from "@/components/ProductGrid";
import ProductModal from "@/components/ProductModal";
import ImportModal from "@/components/ImportModal";
import { useStockDB } from "@/lib/StockDBProvider";
import { useProductFilters } from "@/lib/useProductFilters";
import { useProductActions } from "@/lib/useProductActions";
import type { StockItem } from "@/lib/types";

export default function Home() {
  const { db, setDb, status } = useStockDB();
  const { search, setSearch, filterCat, setFilterCat, categorySuggestions, filtered } =
    useProductFilters(db.items, db.categoryPresets);
  const actions = useProductActions(setDb);

  const [modalItem, setModalItem] = useState<StockItem | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

  const openAdd = () => { setModalItem(null); setModalOpen(true); };
  const openEdit = (item: StockItem) => { setModalItem(item); setModalOpen(true); };

  const handleSave = (data: Omit<StockItem, "id">, editId: string | null) => {
    actions.save(data, editId);
    setModalOpen(false);
  };

  return (
    <div className="wrap">
      <h1>📦 จัดการสต็อกสินค้า</h1>
      <p className="sub">{status.msg}</p>

      <StatsBar items={db.items} />

      <div className="toolbar">
        <input
          id="search"
          type="text"
          placeholder="ค้นหาชื่อสินค้า..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select value={filterCat} onChange={(e) => setFilterCat(e.target.value)}>
          <option value="">ทุกหมวดหมู่</option>
          {categorySuggestions.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <button className="btn-primary" onClick={openAdd}>+ เพิ่มสินค้า</button>
        <button className="btn-ghost" onClick={() => setImportOpen(true)}>นำเข้าจาก Shopee</button>
        <button className="btn-ghost" onClick={() => actions.exportCsv(db.items)}>ส่งออก CSV</button>
        <Link href="/config" className="btn-ghost">⚙️ ตั้งค่า</Link>
      </div>

      <ProductGrid items={filtered} onInc={actions.inc} onDec={actions.dec} onEdit={openEdit} onDelete={actions.remove} />

      <ProductModal
        open={modalOpen}
        item={modalItem}
        categories={categorySuggestions}
        onClose={() => setModalOpen(false)}
        onSave={handleSave}
      />
      <ImportModal
        open={importOpen}
        categories={categorySuggestions}
        items={db.items}
        onClose={() => setImportOpen(false)}
        onImport={actions.importFromShopee}
      />
    </div>
  );
}
