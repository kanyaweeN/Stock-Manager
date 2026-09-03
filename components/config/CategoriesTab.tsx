"use client";

import { useState } from "react";
import { groupCategories, joinCatPath, splitCatPath } from "@/lib/core/cats";

interface Props {
  presets: string[];
  counts: Map<string, number>;
  onAdd: (name: string) => void;
  onRemove: (name: string) => void;
  onRename: (oldName: string, newName: string) => void;
}

type EditState = { name: string; leaf: string; parent: string; isSub: boolean };

export default function CategoriesTab({ presets, counts, onAdd, onRemove, onRename }: Props) {
  const [newRoot, setNewRoot] = useState("");
  const [addingSubFor, setAddingSubFor] = useState<string | null>(null);
  const [newSub, setNewSub] = useState("");
  const [edit, setEdit] = useState<EditState | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const { topList, childrenMap } = groupCategories(presets);

  const toggleExpand = (name: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };
  const expandParent = (name: string) => setExpanded((prev) => new Set(prev).add(name));

  const addRoot = () => {
    const name = newRoot.trim();
    if (!name) return;
    onAdd(name);
    setNewRoot("");
  };

  const openAddSub = (parent: string) => {
    setAddingSubFor(parent);
    setNewSub("");
    expandParent(parent);
  };
  const cancelAddSub = () => { setAddingSubFor(null); setNewSub(""); };
  const addSub = (parent: string) => {
    const leaf = newSub.trim();
    if (!leaf) return;
    onAdd(joinCatPath(parent, leaf));
    cancelAddSub();
  };

  const startEditParent = (name: string) => setEdit({ name, leaf: name, parent: "", isSub: false });
  const startEditSub = (full: string, parent: string, leaf: string) => setEdit({ name: full, leaf, parent, isSub: true });
  const cancelEdit = () => setEdit(null);
  const saveEdit = () => {
    if (!edit) return;
    const leaf = edit.leaf.trim();
    if (!leaf) return cancelEdit();
    const parent = edit.parent.trim();
    const nextName = edit.isSub ? joinCatPath(parent, leaf) : leaf;
    if (nextName !== edit.name) {
      onRename(edit.name, nextName);
      if (edit.isSub && parent) expandParent(parent);
    }
    cancelEdit();
  };

  const countLabel = (name: string) => {
    const n = counts.get(name) ?? 0;
    return n > 0 ? ` (${n})` : "";
  };

  return (
    <div className="field tab-panel">
      <div className="toolbar">
        <input
          type="text"
          placeholder="ชื่อหมวดหลักใหม่ เช่น เครื่องสำอาง"
          value={newRoot}
          onChange={(e) => setNewRoot(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") addRoot(); }}
        />
        <button className="btn-primary" onClick={addRoot}>+ เพิ่มหมวดหลัก</button>
      </div>

      {presets.length === 0 && <div className="empty">ยังไม่มีหมวดหมู่ที่แนะนำ</div>}

      <p className="sub sub-tight text-xs">
        กด <b>+ ซับ</b> เพื่อเพิ่มซับหมวดหมู่ · กด ✏️ เพื่อแก้ชื่อ หรือย้ายไปอยู่ใต้หมวดอื่น · ตัวเลขในวงเล็บคือจำนวนสินค้าที่ใช้หมวดนั้น
      </p>

      <div className="category-list">
        {topList.map((name) => {
          const children = childrenMap.get(name) || [];
          const editingTop = edit?.name === name && !edit.isSub;
          const isAdding = addingSubFor === name;
          const showGroup = (children.length > 0 && expanded.has(name)) || isAdding;
          return (
            <div key={name}>
              <div className="category-row">
                {editingTop ? (
                  <EditFields
                    edit={edit}
                    onLeaf={(v) => setEdit({ ...edit, leaf: v })}
                    onParent={undefined}
                    parents={[]}
                    onSave={saveEdit}
                    onCancel={cancelEdit}
                  />
                ) : (
                  <>
                    <div className="category-row__title">
                      {children.length > 0 ? (
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
                      <span>{name}<span className="category-row__count">{countLabel(name)}</span></span>
                    </div>
                    <div className="category-row__actions">
                      <button className="category-row__add-sub" title="เพิ่มซับหมวดหมู่" onClick={() => openAddSub(name)}>+ ซับ</button>
                      <button className="icon-btn" title="แก้ไข" onClick={() => startEditParent(name)}>✏️</button>
                      <button className="icon-btn del" title="ลบ" onClick={() => onRemove(name)}>🗑️</button>
                    </div>
                  </>
                )}
              </div>
              {showGroup && (
                <div className="category-group">
                  {[...children].sort((a, b) => a.localeCompare(b, "th")).map((c) => {
                    const editingSub = edit?.name === c && edit.isSub;
                    const leafName = splitCatPath(c)?.leaf ?? c;
                    return (
                      <div className="category-row category-row--sub" key={c}>
                        {editingSub ? (
                          <EditFields
                            edit={edit}
                            onLeaf={(v) => setEdit({ ...edit, leaf: v })}
                            onParent={(v) => setEdit({ ...edit, parent: v })}
                            parents={topList}
                            onSave={saveEdit}
                            onCancel={cancelEdit}
                          />
                        ) : (
                          <>
                            <div className="category-row__title">
                              <span>{leafName}<span className="category-row__count">{countLabel(c)}</span></span>
                            </div>
                            <div className="category-row__actions">
                              <button className="icon-btn" title="แก้ชื่อ / ย้ายหมวด" onClick={() => startEditSub(c, name, leafName)}>✏️</button>
                              <button className="icon-btn del" title="ลบ" onClick={() => onRemove(c)}>🗑️</button>
                            </div>
                          </>
                        )}
                      </div>
                    );
                  })}
                  {isAdding && (
                    <div className="category-row category-row--sub category-row--adding">
                      <input
                        type="text"
                        className="category-row__edit-input"
                        placeholder={`ซับหมวดหมู่ใหม่ใต้ "${name}"`}
                        value={newSub}
                        autoFocus
                        onChange={(e) => setNewSub(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") addSub(name);
                          if (e.key === "Escape") cancelAddSub();
                        }}
                      />
                      <button className="icon-btn" title="เพิ่ม" onClick={() => addSub(name)}>✅</button>
                      <button className="icon-btn" title="ยกเลิก" onClick={cancelAddSub}>✖️</button>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

interface EditFieldsProps {
  edit: EditState;
  onLeaf: (v: string) => void;
  /** ถ้ามี = โชว์ dropdown เลือกหมวดหลักปลายทาง (เฉพาะตอนแก้ซับหมวด) */
  onParent: ((v: string) => void) | undefined;
  parents: string[];
  onSave: () => void;
  onCancel: () => void;
}

function EditFields({ edit, onLeaf, onParent, parents, onSave, onCancel }: EditFieldsProps) {
  return (
    <>
      <input
        type="text"
        className="category-row__edit-input"
        placeholder="ชื่อ"
        value={edit.leaf}
        autoFocus
        onChange={(e) => onLeaf(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") onSave();
          if (e.key === "Escape") onCancel();
        }}
      />
      {onParent && (
        <select
          className="category-row__parent-select"
          value={edit.parent}
          onChange={(e) => onParent(e.target.value)}
          title="อยู่ใต้หมวด"
        >
          <option value="">— ยกเป็นหมวดหลัก —</option>
          {parents.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
      )}
      <button className="icon-btn" title="บันทึก" onClick={onSave}>✅</button>
      <button className="icon-btn" title="ยกเลิก" onClick={onCancel}>✖️</button>
    </>
  );
}
