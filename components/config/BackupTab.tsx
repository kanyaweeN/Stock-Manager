"use client";

import { useRef, useState } from "react";
import type { StockDB } from "@/lib/db";
import { migrateDB } from "@/lib/db";

interface Props {
  db: StockDB;
  onRestore: (db: StockDB) => void;
}

export default function BackupTab({ db, onRestore }: Props) {
  const [message, setMessage] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExport = () => {
    const blob = new Blob([JSON.stringify(db, null, 2)], { type: "application/json;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `stock-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
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
    </div>
  );
}
