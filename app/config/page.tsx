"use client";

import Link from "next/link";
import { useState } from "react";
import { useStockDB } from "@/lib/StockDBProvider";
import { useGoogleSheetsSync } from "@/lib/useGoogleSheetsSync";
import StorageTab from "@/components/config/StorageTab";
import SheetsTab from "@/components/config/SheetsTab";
import CategoriesTab from "@/components/config/CategoriesTab";
import BackupTab from "@/components/config/BackupTab";

type Tab = "storage" | "sheets" | "categories" | "backup";

const TABS: { id: Tab; label: string }[] = [
  { id: "storage", label: "ที่เก็บข้อมูล" },
  { id: "sheets", label: "Google Sheets" },
  { id: "categories", label: "หมวดหมู่" },
  { id: "backup", label: "สำรอง/กู้คืน" },
];

export default function ConfigPage() {
  const { db, setDb, status, linkedFileName, toggleLink } = useStockDB();
  const sheetsSync = useGoogleSheetsSync(db, setDb);
  const [tab, setTab] = useState<Tab>("storage");

  const setPresets = (updater: (prev: string[]) => string[]) => {
    setDb((prev) => ({ ...prev, categoryPresets: updater(prev.categoryPresets) }));
  };

  const addCategory = (name: string) => {
    if (db.categoryPresets.includes(name)) return;
    setPresets((prev) => [...prev, name].sort((a, b) => a.localeCompare(b, "th")));
  };

  const removeCategory = (name: string) => {
    setPresets((prev) => prev.filter((c) => c !== name));
  };

  return (
    <div className="wrap">
      <Link href="/" className="back-link">← กลับหน้าหลัก</Link>
      <h1>⚙️ ตั้งค่า</h1>

      <div className="tabs">
        {TABS.map((t) => (
          <button
            key={t.id}
            className={`tab-btn ${tab === t.id ? "active" : ""}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "storage" && (
        <StorageTab status={status} linkedFileName={linkedFileName} onToggleLink={toggleLink} />
      )}
      {tab === "sheets" && <SheetsTab {...sheetsSync} />}
      {tab === "categories" && (
        <CategoriesTab presets={db.categoryPresets} onAdd={addCategory} onRemove={removeCategory} />
      )}
      {tab === "backup" && <BackupTab db={db} onRestore={setDb} />}
    </div>
  );
}
