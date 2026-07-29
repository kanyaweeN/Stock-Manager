"use client";

import { useState, type DragEvent } from "react";

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
  const [draggedName, setDraggedName] = useState<string | null>(null);
  const [dragOverTarget, setDragOverTarget] = useState<string | null>(null); // null target = "แยกเป็นหมวดหลัก" drop zone

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

  // ใช้ตัวเดียวกันทั้งหมวดหลัก/ซับหมวดหมู่ — ให้พิมพ์เป็น path เต็มได้เลย เช่นพิมพ์ "เสื้อผ้า" เฉยๆ เพื่อยกเป็นหมวดหลัก
  // หรือพิมพ์ "หมวดอื่น > ชื่อใหม่" เพื่อย้ายไปอยู่ใต้หมวดอื่น (ไม่บังคับให้อยู่หมวดเดิมเหมือนก่อนหน้านี้)
  const saveEdit = (fullName: string) => {
    const next = editValue.trim();
    if (next) onRename(fullName, next);
    cancelEdit();
  };

  // ลากวางเพื่อย้ายหมวดหมู่ — ทางเลือกที่ง่ายกว่าการพิมพ์ path เอง
  const dropOnTarget = (target: string | null) => {
    const dragged = draggedName;
    setDraggedName(null);
    setDragOverTarget(null);
    if (!dragged) return;
    if (target === dragged) return;
    // กันลากไปวางบนซับหมวดหมู่ของตัวเอง (จะเกิด path วนซ้อนกันเอง)
    if (target && (target === dragged || target.startsWith(`${dragged} > `))) return;
    const leaf = dragged.includes(" > ") ? dragged.slice(dragged.lastIndexOf(" > ") + 3) : dragged;
    const newName = target ? `${target} > ${leaf}` : leaf;
    if (newName === dragged) return;
    if (target) setExpanded((prev) => new Set(prev).add(target));
    onRename(dragged, newName);
  };

  const dragHandlers = (name: string) => ({
    draggable: true,
    onDragStart: (e: DragEvent) => {
      e.dataTransfer.effectAllowed = "move";
      setDraggedName(name);
    },
    onDragEnd: () => {
      setDraggedName(null);
      setDragOverTarget(null);
    },
  });

  const dropHandlers = (target: string | null) => ({
    onDragOver: (e: DragEvent) => {
      if (!draggedName || draggedName === target) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      setDragOverTarget(target);
    },
    onDragLeave: () => setDragOverTarget((prev) => (prev === target ? null : prev)),
    onDrop: (e: DragEvent) => {
      e.preventDefault();
      dropOnTarget(target);
    },
  });

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

      <p className="sub sub-tight text-xs">
        ลากหมวดหมู่ไปวางบนหมวดอื่นเพื่อย้ายเข้าไปเป็นซับหมวดหมู่ หรือวางที่กล่องด้านล่างเพื่อยกเป็นหมวดหลัก — หรือจะกด ✏️ แล้วพิมพ์เองก็ได้
      </p>

      {draggedName && (
        <div
          className={`category-drop-top ${dragOverTarget === null ? "category-drop-top--active" : ""}`}
          {...dropHandlers(null)}
        >
          ⬆️ วางตรงนี้เพื่อยกเป็นหมวดหลัก
        </div>
      )}

      <div className="category-list">
        {topList.map((name) => {
          const children = childrenMap.get(name);
          const isEditingTop = editing === name;
          return (
            <div key={name}>
              <div
                className={`category-row ${draggedName === name ? "category-row--dragging" : ""} ${dragOverTarget === name ? "category-row--drag-over" : ""}`}
                {...(isEditingTop ? {} : dragHandlers(name))}
                {...dropHandlers(name)}
              >
                {isEditingTop ? (
                  <>
                    <input
                      type="text"
                      list="parent-cat-list"
                      className="category-row__edit-input"
                      value={editValue}
                      autoFocus
                      onChange={(e) => setEditValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") saveEdit(name);
                        if (e.key === "Escape") cancelEdit();
                      }}
                    />
                    <button className="icon-btn" title="บันทึก" onClick={() => saveEdit(name)}>✅</button>
                    <button className="icon-btn" title="ยกเลิก" onClick={cancelEdit}>✖️</button>
                  </>
                ) : (
                  <>
                    <div className="category-row__title">
                      <span className="category-row__drag-handle" title="ลากเพื่อย้ายหมวดหมู่">⠿</span>
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
                      <button className="icon-btn" title="แก้ไข / ย้ายหมวดหมู่" onClick={() => startEdit(name, name)}>✏️</button>
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
                      <div
                        className={`category-row category-row--sub ${draggedName === c ? "category-row--dragging" : ""} ${dragOverTarget === c ? "category-row--drag-over" : ""}`}
                        {...(isEditingSub ? {} : dragHandlers(c))}
                        {...dropHandlers(c)}
                        key={c}
                      >
                        {isEditingSub ? (
                          <>
                            <input
                              type="text"
                              list="parent-cat-list"
                              className="category-row__edit-input"
                              value={editValue}
                              autoFocus
                              onChange={(e) => setEditValue(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") saveEdit(c);
                                if (e.key === "Escape") cancelEdit();
                              }}
                            />
                            <button className="icon-btn" title="บันทึก" onClick={() => saveEdit(c)}>✅</button>
                            <button className="icon-btn" title="ยกเลิก" onClick={cancelEdit}>✖️</button>
                          </>
                        ) : (
                          <>
                            <div className="category-row__title">
                              <span className="category-row__drag-handle" title="ลากเพื่อย้ายหมวดหมู่">⠿</span>
                              <span>{leafName}</span>
                            </div>
                            <div className="category-row__actions">
                              <button className="icon-btn" title="แก้ไข / ย้ายหมวดหมู่" onClick={() => startEdit(c, c)}>✏️</button>
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
