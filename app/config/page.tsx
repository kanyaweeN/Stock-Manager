"use client";

import { useState } from "react";
import { useStockDB } from "@/lib/hooks/StockDBProvider";
import { useGoogleSheetsSync } from "@/lib/hooks/useGoogleSheetsSync";
import { useProductActions } from "@/lib/hooks/useProductActions";
import StorageTab from "@/components/config/StorageTab";
import DriveTab from "@/components/config/DriveTab";
import SheetsTab from "@/components/config/SheetsTab";
import CategoriesTab from "@/components/config/CategoriesTab";
import BackupTab from "@/components/config/BackupTab";
import { CAT_SEP } from "@/lib/core/cats";
import packageJson from "@/package.json";

type Tab = "storage" | "drive" | "sheets" | "categories" | "backup";

const TABS: { id: Tab; label: string; icon: string; desc: string }[] = [
  { id: "storage", label: "ที่เก็บข้อมูล", icon: "💾", desc: "ข้อมูลถูกบันทึกในเบราว์เซอร์อัตโนมัติ หรือจะผูกกับไฟล์บนเครื่องก็ได้" },
  { id: "drive", label: "Google Drive", icon: "☁️", desc: "สำรองข้อมูลทั้งหมดขึ้น Google Drive เป็นไฟล์เดียว ซิงก์อัตโนมัติได้" },
  { id: "sheets", label: "ส่งออก Sheet", icon: "📊", desc: "ส่งออกเฉพาะรายการสินค้าไปดู/แก้เป็นตารางใน Google Sheet" },
  { id: "categories", label: "หมวดหมู่", icon: "🏷️", desc: "เพิ่ม/แก้/ย้ายหมวดหลักและซับหมวดหมู่ที่ใช้ในสินค้า" },
  { id: "backup", label: "สำรอง/กู้คืน", icon: "🗂️", desc: "ดาวน์โหลดไฟล์สำรอง กู้คืนจากไฟล์ และถังขยะ" },
];

export default function ConfigPage() {
  const { db, setDb, status, linkedFileName, toggleLink, driveSync } = useStockDB();
  const sheetsSync = useGoogleSheetsSync(db);
  const productActions = useProductActions(setDb);
  const [tab, setTab] = useState<Tab>("storage");

  const setPresets = (updater: (prev: string[]) => string[]) => {
    setDb((prev) => ({ ...prev, categoryPresets: updater(prev.categoryPresets) }));
  };

  // หมวดหมู่ที่ใช้งานจริงในสินค้าแต่ยังไม่ได้ลงทะเบียนเป็น preset (เช่น พิมพ์สร้างใหม่จากในฟอร์มสินค้า/นำเข้า) ก็ควรให้เห็น/จัดการได้ในหน้านี้ด้วย
  const catCounts = new Map<string, number>();
  for (const it of db.items) for (const c of it.cats) catCounts.set(c, (catCounts.get(c) ?? 0) + 1);
  const usedCategories = [...catCounts.keys()];
  const allCategories = [...new Set([...db.categoryPresets, ...usedCategories])].sort((a, b) => a.localeCompare(b, "th"));

  const addCategory = (name: string) => {
    if (db.categoryPresets.includes(name)) return;
    setPresets((prev) => [...prev, name].sort((a, b) => a.localeCompare(b, "th")));
  };

  // ลบหมวดหมู่ + ซับหมวดของมันทุกตัว (รวมทั้งที่ยังไม่ได้ลงทะเบียนเป็น preset แต่โผล่มาเพราะมีของใช้อยู่)
  // ไม่งั้นลบหมวดหลักแล้วซับหมวดยังค้าง → แถวหมวดหลักโผล่กลับมาเองรอบถัดไป (groupCategories สร้างหมวดหลักจาก prefix ของซับ)
  const removeCategory = (name: string) => {
    const isTarget = (c: string) => c === name || c.startsWith(`${name}${CAT_SEP}`);
    const targets = allCategories.filter(isTarget);
    const usedByCount = db.items.filter((i) => i.cats.some(isTarget)).length;
    const subCount = targets.length - 1;
    if (usedByCount > 0 || subCount > 0) {
      const parts = [`หมวดหมู่ "${name}"`];
      if (subCount > 0) parts.push(`+ ซับหมวด ${subCount} รายการ`);
      if (usedByCount > 0) parts.push(`— ใช้อยู่ใน ${usedByCount} สินค้า`);
      const ok = confirm(`${parts.join(" ")}\n\nลบทั้งหมดออกจากพรีเซ็ตและจากสินค้าที่ใช้อยู่?`);
      if (!ok) return;
    }
    setDb((prev) => ({
      ...prev,
      categoryPresets: prev.categoryPresets.filter((c) => !isTarget(c)),
      items: prev.items.map((i) => i.cats.some(isTarget) ? { ...i, cats: i.cats.filter((c) => !isTarget(c)) } : i),
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

  const active = TABS.find((t) => t.id === tab) ?? TABS[0];

  return (
    <div className="page">
      <h1>⚙️ ตั้งค่า</h1>
      <p className="sub sub-tight text-xs">เวอร์ชัน {packageJson.version}</p>

      <div className="config-tabs" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            className={`config-tab ${tab === t.id ? "active" : ""}`}
            onClick={() => setTab(t.id)}
          >
            <span className="config-tab__icon" aria-hidden="true">{t.icon}</span>
            {t.label}
          </button>
        ))}
      </div>

      <section className="config-panel">
        <header className="config-panel__head">
          <span className="config-panel__icon" aria-hidden="true">{active.icon}</span>
          <div>
            <h2 className="config-panel__title">{active.label}</h2>
            <p className="config-panel__desc">{active.desc}</p>
          </div>
        </header>

        {tab === "storage" && (
          <StorageTab status={status} linkedFileName={linkedFileName} onToggleLink={toggleLink} />
        )}
        {tab === "drive" && <DriveTab {...driveSync} />}
        {tab === "sheets" && <SheetsTab {...sheetsSync} />}
        {tab === "categories" && (
          <CategoriesTab presets={allCategories} counts={catCounts} onAdd={addCategory} onRemove={removeCategory} onRename={renameCategory} />
        )}
        {tab === "backup" && (
          <BackupTab
            db={db}
            onRestore={setDb}
            onRestoreItem={productActions.restoreFromTrash}
            onDeleteForever={productActions.deleteForever}
            onEmptyTrash={productActions.emptyTrash}
          />
        )}
      </section>
    </div>
  );
}
