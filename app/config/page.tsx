"use client";

import { useState } from "react";
import { useStockDB } from "@/lib/StockDBProvider";
import { useGoogleSheetsSync } from "@/lib/useGoogleSheetsSync";
import { useGoogleDriveSync } from "@/lib/useGoogleDriveSync";
import StorageTab from "@/components/config/StorageTab";
import DriveTab from "@/components/config/DriveTab";
import SheetsTab from "@/components/config/SheetsTab";
import CategoriesTab from "@/components/config/CategoriesTab";
import BackupTab from "@/components/config/BackupTab";
import packageJson from "@/package.json";

type Tab = "storage" | "drive" | "sheets" | "categories" | "backup";

const TABS: { id: Tab; label: string }[] = [
  { id: "storage", label: "ที่เก็บข้อมูล" },
  { id: "drive", label: "Google Drive" },
  { id: "sheets", label: "ส่งออก Sheet" },
  { id: "categories", label: "หมวดหมู่" },
  { id: "backup", label: "สำรอง/กู้คืน" },
];

export default function ConfigPage() {
  const { db, setDb, status, linkedFileName, toggleLink } = useStockDB();
  const driveSync = useGoogleDriveSync(db, setDb);
  const sheetsSync = useGoogleSheetsSync(db);
  const [tab, setTab] = useState<Tab>("storage");

  const setPresets = (updater: (prev: string[]) => string[]) => {
    setDb((prev) => ({ ...prev, categoryPresets: updater(prev.categoryPresets) }));
  };

  // หมวดหมู่ที่ใช้งานจริงในสินค้าแต่ยังไม่ได้ลงทะเบียนเป็น preset (เช่น พิมพ์สร้างใหม่จากในฟอร์มสินค้า/นำเข้า) ก็ควรให้เห็น/จัดการได้ในหน้านี้ด้วย
  const usedCategories = [...new Set(db.items.flatMap((i) => i.cats))];
  const allCategories = [...new Set([...db.categoryPresets, ...usedCategories])].sort((a, b) => a.localeCompare(b, "th"));

  const addCategory = (name: string) => {
    if (db.categoryPresets.includes(name)) return;
    setPresets((prev) => [...prev, name].sort((a, b) => a.localeCompare(b, "th")));
  };

  const removeCategory = (name: string) => {
    const usedByCount = db.items.filter((i) => i.cats.includes(name)).length;
    if (usedByCount > 0) {
      const ok = confirm(`หมวดหมู่ "${name}" ถูกใช้อยู่ใน ${usedByCount} รายการสินค้า — ลบแล้วจะเอาหมวดหมู่นี้ออกจากสินค้าเหล่านั้นด้วย ต้องการดำเนินการต่อหรือไม่?`);
      if (!ok) return;
    }
    setPresets((prev) => prev.filter((c) => c !== name));
    setDb((prev) => ({
      ...prev,
      items: prev.items.map((i) => (i.cats.includes(name) ? { ...i, cats: i.cats.filter((c) => c !== name) } : i)),
    }));
  };

  // แก้ชื่อหมวดหมู่ — ถ้าเป็นหมวดหลักที่มีซับหมวดหมู่อยู่ ต้องเปลี่ยนคำนำหน้าของลูกๆ ตามไปด้วย
  const renameCategory = (oldName: string, newNameRaw: string) => {
    const newName = newNameRaw.trim();
    if (!newName || newName === oldName) return;
    const remap = (c: string) => {
      if (c === oldName) return newName;
      if (c.startsWith(`${oldName} > `)) return newName + c.slice(oldName.length);
      return c;
    };
    setDb((prev) => ({
      ...prev,
      categoryPresets: [...new Set(prev.categoryPresets.map(remap))].sort((a, b) => a.localeCompare(b, "th")),
      items: prev.items.map((i) => ({ ...i, cats: [...new Set(i.cats.map(remap))] })),
    }));
  };

  return (
    <div className="page">
      <h1>⚙️ ตั้งค่า</h1>
      <p className="sub sub-tight text-xs">เวอร์ชัน {packageJson.version}</p>

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
      {tab === "drive" && <DriveTab {...driveSync} />}
      {tab === "sheets" && <SheetsTab {...sheetsSync} />}
      {tab === "categories" && (
        <CategoriesTab presets={allCategories} onAdd={addCategory} onRemove={removeCategory} onRename={renameCategory} />
      )}
      {tab === "backup" && <BackupTab db={db} onRestore={setDb} />}
    </div>
  );
}
