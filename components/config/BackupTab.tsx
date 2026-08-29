"use client";

import { useRef, useState } from "react";
import { formatThaiShortDate, todayISO } from "@/lib/date";
import { downloadFile } from "@/lib/download";
import { sortTrash, TRASH_MAX } from "@/lib/trash";
import type { StockItem } from "@/lib/types";
import type { StockDB } from "@/lib/db";
import { DEFAULT_DB, migrateDB } from "@/lib/db";

interface Props {
  db: StockDB;
  onRestore: (db: StockDB) => void;
  /** กู้ของกลับเข้าสต็อก / ลบถาวร — มาจาก `useProductActions` (ดู lib/trash.ts) */
  onRestoreItem: (id: string) => void;
  onDeleteForever: (item: StockItem) => void;
  onEmptyTrash: (count: number) => void;
}

export default function BackupTab({ db, onRestore, onRestoreItem, onDeleteForever, onEmptyTrash }: Props) {
  const trash = sortTrash(db.trash ?? []);
  const [message, setMessage] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExport = () => {
    downloadFile(`stock-backup-${todayISO()}.json`, JSON.stringify(db, null, 2), "json");
  };

  const handleImport = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = migrateDB(JSON.parse(String(reader.result)));
        const ok = confirm(`จะแทนที่ข้อมูลปัจจุบันด้วยไฟล์สำรอง (${parsed.items.length} รายการสินค้า) ต้องการดำเนินการต่อหรือไม่?`);
        if (!ok) return;
        onRestore(parsed);
        setMessage("กู้คืนข้อมูลสำเร็จ");
      } catch {
        setMessage("ไม่สามารถอ่านไฟล์นี้ได้ ตรวจสอบว่าเป็นไฟล์ JSON ที่ส่งออกจากระบบนี้");
      }
    };
    reader.readAsText(file);
  };

  const handleClearAll = () => {
    const ok = confirm(
      `ต้องการล้างข้อมูลสินค้าทั้งหมด (${db.items.length} รายการ) ทิ้งจริงหรือไม่? การกระทำนี้ย้อนกลับไม่ได้ — แนะนำให้กด "สำรองข้อมูล" ไว้ก่อน`
    );
    if (!ok) return;
    onRestore(DEFAULT_DB);
    setMessage("ล้างข้อมูลทั้งหมดแล้ว");
  };

  return (
    <div className="field tab-panel">
      <p className="sub sub-tight">
        บันทึกข้อมูลสินค้าและหมวดหมู่ทั้งหมดเป็นไฟล์ เผื่อย้ายเครื่อง หรือกันข้อมูลหายจากเบราว์เซอร์
      </p>
      <div className="toolbar">
        <button className="btn-primary" onClick={handleExport}>⬇️ สำรองข้อมูล (ดาวน์โหลด)</button>
        <button className="btn-ghost" onClick={() => fileInputRef.current?.click()}>⬆️ กู้คืนจากไฟล์</button>
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        className="hidden-input"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleImport(file);
          e.target.value = "";
        }}
      />
      {message && <p className="sub">{message}</p>}

      <h3 className="summary-sub-title">🗑️ ถังขยะ ({trash.length})</h3>
      <p className="sub sub-tight text-xs">
        ของที่ลบออกจากสต็อกมาพักไว้ที่นี่ กดกู้คืนได้ — เก็บได้มากสุด {TRASH_MAX} รายการ
        เกินแล้วตัวที่ลบนานสุดจะหลุดออกถาวร (ประวัติราคา/ส่วนผสมกลับมาครบตอนกู้คืน)
      </p>
      {trash.length === 0 ? (
        <p className="sub text-xs">ยังไม่มีของในถังขยะ</p>
      ) : (
        <>
          <div className="trash-list">
            {trash.map((i) => (
              <div className="trash-row" key={i.id}>
                <span className="trash-row__name">{i.name || "(ไม่มีชื่อ)"}</span>
                <span className="trash-row__meta">
                  {i.qty} ชิ้น
                  {i.deletedAt ? ` · ลบเมื่อ ${formatThaiShortDate(i.deletedAt.slice(0, 10)) || i.deletedAt.slice(0, 10)}` : ""}
                </span>
                <button className="btn-ghost btn-sm" onClick={() => onRestoreItem(i.id)}>↩️ กู้คืน</button>
                <button className="icon-btn del" title="ลบถาวร" onClick={() => onDeleteForever(i)}>🗑️</button>
              </div>
            ))}
          </div>
          <button className="btn-ghost btn-sm" onClick={() => onEmptyTrash(trash.length)}>ล้างถังขยะทั้งหมด</button>
        </>
      )}

      <div className="danger-zone">
        <p className="sub sub-tight text-xs">
          ลบข้อมูลสินค้าและหมวดหมู่ทั้งหมดทิ้ง <b>รวมถังขยะด้วย</b> (แนะนำให้สำรองข้อมูลไว้ก่อนกด)
        </p>
        <button className="btn-danger" onClick={handleClearAll}>🗑️ ล้างข้อมูลทั้งหมด</button>
      </div>
    </div>
  );
}
