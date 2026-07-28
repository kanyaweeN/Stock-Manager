"use client";

import { useState } from "react";

interface Props {
  presets: string[];
  onAdd: (name: string) => void;
  onRemove: (name: string) => void;
  onRename: (oldName: string, newName: string) => void;
}

export default function CategoriesTab({ presets, onAdd, onRemove, onRename }: Props) {
  const [newParent, setNewParent] = useState("");
  const [newName, setNewName] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const toggleExpand = (name: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const topNames = new Set<string>();
  const childrenMap = new Map<string, string[]>();
  for (const c of presets) {
    const idx = c.indexOf(" > ");
    if (idx === -1) {
      topNames.add(c);
    } else {
      const parent = c.slice(0, idx);
      topNames.add(parent);
      childrenMap.set(parent, [...(childrenMap.get(parent) || []), c]);
    }
  }
  const topList = [...topNames].sort();

  const submit = () => {
    const name = newName.trim();
    if (!name) return;
    const parent = newParent.trim();
    onAdd(parent ? `${parent} > ${name}` : name);
    setNewName("");
  };

  const startEdit = (fullName: string, displayValue: string) => {
    setEditing(fullName);
    setEditValue(displayValue);
  };

  const cancelEdit = () => {
    setEditing(null);
    setEditValue("");
  };

  const saveTopEdit = (name: string) => {
    onRename(name, editValue);
    cancelEdit();
  };

  const saveSubEdit = (fullName: string, parent: string) => {
    const leaf = editValue.trim();
    if (leaf) onRename(fullName, `${parent} > ${leaf}`);
    cancelEdit();
  };

  return (
    <div className="field tab-panel">
      <div className="toolbar">
        <input
          type="text"
          list="parent-cat-list"
          placeholder="หมวดหลัก (เว้นว่างได้)"
          value={newParent}
          onChange={(e) => setNewParent(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
        />
        <datalist id="parent-cat-list">
          {topList.map((p) => <option key={p} value={p} />)}
        </datalist>
        <input
          type="text"
          placeholder="ชื่อหมวดหมู่ใหม่"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
        />
        <button className="btn-primary" onClick={submit}>+ เพิ่ม</button>
      </div>

      {presets.length === 0 && <div className="empty">ยังไม่มีหมวดหมู่ที่แนะนำ</div>}

      <div className="category-list">
        {topList.map((name) => {
          const children = childrenMap.get(name);
          const isEditingTop = editing === name;
          return (
            <div key={name}>
              <div className="category-row">
                {isEditingTop ? (
                  <>
                    <input
                      type="text"
                      className="category-row__edit-input"
                      value={editValue}
                      autoFocus
                      onChange={(e) => setEditValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") saveTopEdit(name);
                        if (e.key === "Escape") cancelEdit();
                      }}
                    />
                    <button className="icon-btn" title="บันทึก" onClick={() => saveTopEdit(name)}>✅</button>
                    <button className="icon-btn" title="ยกเลิก" onClick={cancelEdit}>✖️</button>
                  </>
                ) : (
                  <>
                    <div className="category-row__title">
                      {children && children.length > 0 ? (
                        <button
                          type="button"
                          className="cat-multiselect__expand"
                          onClick={() => toggleExpand(name)}
                          title={expanded.has(name) ? "ซ่อนซับหมวดหมู่" : "แสดงซับหมวดหมู่"}
                        >
                          {expanded.has(name) ? "▾" : "▸"}
                        </button>
                      ) : (
                        <span className="cat-multiselect__expand-spacer" />
                      )}
                      <span>{name}</span>
                    </div>
                    <div className="category-row__actions">
                      <button className="icon-btn" title="แก้ไข" onClick={() => startEdit(name, name)}>✏️</button>
                      {presets.includes(name) && (
                        <button className="icon-btn del" title="ลบ" onClick={() => onRemove(name)}>🗑️</button>
                      )}
                    </div>
                  </>
                )}
              </div>
              {children && expanded.has(name) && (
                <div className="category-group">
                  {children.sort().map((c) => {
                    const isEditingSub = editing === c;
                    const leafName = c.slice(name.length + 3);
                    return (
                      <div className="category-row category-row--sub" key={c}>
                        {isEditingSub ? (
                          <>
                            <input
                              type="text"
                              className="category-row__edit-input"
                              value={editValue}
                              autoFocus
                              onChange={(e) => setEditValue(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") saveSubEdit(c, name);
                                if (e.key === "Escape") cancelEdit();
                              }}
                            />
                            <button className="icon-btn" title="บันทึก" onClick={() => saveSubEdit(c, name)}>✅</button>
                            <button className="icon-btn" title="ยกเลิก" onClick={cancelEdit}>✖️</button>
                          </>
                        ) : (
                          <>
                            <span>{leafName}</span>
                            <div className="category-row__actions">
                              <button className="icon-btn" title="แก้ไข" onClick={() => startEdit(c, leafName)}>✏️</button>
                              <button className="icon-btn del" title="ลบ" onClick={() => onRemove(c)}>🗑️</button>
                            </div>
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
