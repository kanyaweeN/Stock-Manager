"use client";

import { useState } from "react";

interface Props {
  presets: string[];
  onAdd: (name: string) => void;
  onRemove: (name: string) => void;
}

export default function CategoriesTab({ presets, onAdd, onRemove }: Props) {
  const [newCat, setNewCat] = useState("");

  const submit = () => {
    const name = newCat.trim();
    if (!name) return;
    onAdd(name);
    setNewCat("");
  };

  return (
    <div className="field tab-panel">
      <div className="toolbar">
        <input
          type="text"
          placeholder="ชื่อหมวดหมู่ใหม่"
          value={newCat}
          onChange={(e) => setNewCat(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
        />
        <button className="btn-primary" onClick={submit}>+ เพิ่ม</button>
      </div>

      {presets.length === 0 && <div className="empty">ยังไม่มีหมวดหมู่ที่แนะนำ</div>}

      <div className="category-list">
        {presets.map((c) => (
          <div className="category-row" key={c}>
            <span>{c}</span>
            <button className="icon-btn del" title="ลบ" onClick={() => onRemove(c)}>🗑️</button>
          </div>
        ))}
      </div>
    </div>
  );
}
