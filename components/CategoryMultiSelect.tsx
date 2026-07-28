"use client";

import { useEffect, useId, useRef, useState } from "react";

interface Props {
  categories: string[];
  selected: string[];
  onChange: (cats: string[]) => void;
  /** ถ้ากำหนดไว้ จะมีช่องให้พิมพ์เพิ่มหมวดหมู่ใหม่ (ใช้ตอนเพิ่ม/แก้ไขสินค้า) */
  allowCreate?: boolean;
  emptyLabel?: string;
}

/**
 * หมวดหมู่ย่อยตั้งชื่อแบบ "หลัก > ย่อย" — จัดกลุ่มเป็นรายการหมวดหลัก 1 แถวต่อชื่อ (ไม่ซ้ำ)
 * แต่ละหมวดหลักอาจมีทั้งค่าของตัวเอง (standalone) และมีลูกซ้อนอยู่ก็ได้
 */
function groupCategories(categories: string[]) {
  const topNames = new Set<string>();
  const childrenMap = new Map<string, string[]>();
  for (const c of categories) {
    const idx = c.indexOf(" > ");
    if (idx === -1) {
      topNames.add(c);
    } else {
      const parent = c.slice(0, idx);
      topNames.add(parent);
      childrenMap.set(parent, [...(childrenMap.get(parent) || []), c]);
    }
  }
  return { topList: [...topNames].sort(), childrenMap };
}

export default function CategoryMultiSelect({ categories, selected, onChange, allowCreate, emptyLabel = "ทุกหมวดหมู่" }: Props) {
  const [newParent, setNewParent] = useState("");
  const [newName, setNewName] = useState("");
  const [panelStyle, setPanelStyle] = useState<{ top: number; left: number; minWidth: number } | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const parentListId = useId();

  // ใช้ position: fixed คำนวณตำแหน่งเอง เพราะ dropdown นี้อาจอยู่ใน modal ที่มี overflow-y: auto
  // ซึ่งจะ clip position: absolute ทิ้งถ้าโผล่พ้นขอบกล่อง
  const updatePosition = () => {
    const el = detailsRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setPanelStyle({ top: rect.bottom + 4, left: rect.left, minWidth: rect.width });
  };

  useEffect(() => {
    const el = detailsRef.current;
    if (!el) return;
    const onToggle = () => { if (el.open) updatePosition(); };
    el.addEventListener("toggle", onToggle);
    return () => el.removeEventListener("toggle", onToggle);
  }, []);

  useEffect(() => {
    if (!panelStyle) return;
    const onScrollOrResize = () => updatePosition();
    window.addEventListener("scroll", onScrollOrResize, true);
    window.addEventListener("resize", onScrollOrResize);
    return () => {
      window.removeEventListener("scroll", onScrollOrResize, true);
      window.removeEventListener("resize", onScrollOrResize);
    };
  }, [panelStyle]);

  // คลิกข้างนอกแล้วให้ dropdown หุบ
  useEffect(() => {
    const onDocMouseDown = (e: MouseEvent) => {
      const el = detailsRef.current;
      if (el && el.open && !el.contains(e.target as Node)) el.open = false;
    };
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, []);

  // ถ้ามีลูกที่ถูกเลือกไว้อยู่แล้ว (เช่นตอนเปิดฟอร์มแก้ไขสินค้าที่มีซับหมวดหมู่) ให้กางหมวดหลักนั้นไว้ให้เห็นเลย
  useEffect(() => {
    setExpanded((prev) => {
      const next = new Set(prev);
      for (const c of selected) {
        const idx = c.indexOf(" > ");
        if (idx !== -1) next.add(c.slice(0, idx));
      }
      return next;
    });
  }, [selected]);

  const toggle = (cat: string) => {
    if (selected.includes(cat)) {
      onChange(selected.filter((c) => c !== cat));
      return;
    }
    let next = [...selected, cat];
    const idx = cat.indexOf(" > ");
    if (idx !== -1) {
      // เลือกซับหมวดหมู่แล้ว ไม่ต้องเก็บหมวดหลักเปล่าๆ ซ้อนไว้ด้วย เพราะซับหมวดหมู่ระบุชัดเจนกว่าอยู่แล้ว
      const parent = cat.slice(0, idx);
      next = next.filter((c) => c !== parent);
    }
    onChange(next);
  };

  const toggleExpand = (name: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const addNew = () => {
    const name = newName.trim();
    if (!name) return;
    const parent = newParent.trim();
    const cat = parent ? `${parent} > ${name}` : name;
    if (parent) setExpanded((prev) => new Set(prev).add(parent));
    if (!selected.includes(cat)) toggle(cat);
    setNewName("");
  };

  const label = selected.length === 0 ? emptyLabel : selected.join(", ");

  const options = [...new Set([...categories, ...selected])];
  const { topList, childrenMap } = groupCategories(options);
  const parentOptions = topList;

  return (
    <details className="cat-multiselect" ref={detailsRef}>
      <summary title={selected.length > 0 ? selected.join(", ") : undefined}>
        <span className="cat-multiselect__label">{label}</span>
        {selected.length > 0 && (
          <span
            className="cat-multiselect__x"
            role="button"
            title="ล้างตัวเลือก"
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); onChange([]); }}
          >
            ×
          </span>
        )}
      </summary>
      <div
        className="cat-multiselect__panel"
        style={panelStyle ? { top: panelStyle.top, left: panelStyle.left, minWidth: panelStyle.minWidth } : undefined}
      >
        {allowCreate && (
          <div className="cat-multiselect__new">
            <div className="cat-multiselect__new-row">
              <input
                type="text"
                list={parentListId}
                placeholder="หมวดหลัก (เว้นว่างได้)"
                value={newParent}
                onChange={(e) => setNewParent(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addNew(); } }}
              />
              <datalist id={parentListId}>
                {parentOptions.map((p) => <option key={p} value={p} />)}
              </datalist>
              <input
                type="text"
                placeholder="ชื่อหมวดหมู่ใหม่"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addNew(); } }}
              />
            </div>
            <button type="button" className="cat-multiselect__add-btn" onClick={addNew}>+ เพิ่มหมวดหมู่</button>
          </div>
        )}
        {selected.length > 0 && (
          <button type="button" className="cat-multiselect__clear" onClick={() => onChange([])}>
            ล้างตัวเลือกทั้งหมด
          </button>
        )}
        {topList.map((name) => {
          const children = childrenMap.get(name);
          const isExpanded = expanded.has(name);
          return (
            <div key={name}>
              <div className="cat-multiselect__option cat-multiselect__option--top">
                {children && children.length > 0 ? (
                  <button
                    type="button"
                    className="cat-multiselect__expand"
                    onClick={() => toggleExpand(name)}
                    title={isExpanded ? "ซ่อนซับหมวดหมู่" : "แสดงซับหมวดหมู่"}
                  >
                    {isExpanded ? "▾" : "▸"}
                  </button>
                ) : (
                  <span className="cat-multiselect__expand-spacer" />
                )}
                <label>
                  <input type="checkbox" checked={selected.includes(name)} onChange={() => toggle(name)} />
                  {name}
                </label>
              </div>
              {children && isExpanded && (
                <div className="cat-multiselect__group">
                  {children.sort().map((c) => (
                    <label key={c} className="cat-multiselect__option cat-multiselect__option--sub">
                      <input type="checkbox" checked={selected.includes(c)} onChange={() => toggle(c)} />
                      {c.slice(name.length + 3)}
                    </label>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </details>
  );
}
