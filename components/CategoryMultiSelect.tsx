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

/** ตำแหน่ง/ขนาดของแผงที่คำนวณเทียบจอ (fixed) — ทางใดทางหนึ่งระหว่าง `top` กับ `bottom` */
type PanelStyle = { top?: number; bottom?: number; left: number; minWidth: number; maxHeight: number };

const PANEL_GAP = 4;
const VIEWPORT_MARGIN = 8;
const PANEL_MIN_WIDTH = 200;
/** สูงได้ถึงครึ่งจอ — จอสูงก็ได้รายการยาวขึ้น ไม่ใช่แผงเตี้ยๆ ทั้งที่ข้างล่างว่างอีกเยอะ */
const PANEL_MAX_RATIO = 0.55;
const PANEL_MAX_MIN = 300;
/** ที่ว่างข้างล่างน้อยกว่านี้ถือว่าคับเกินไป ให้พลิกไปกางขึ้นข้างบนแทน */
const PANEL_MIN_HEIGHT = 200;

export default function CategoryMultiSelect({ categories, selected, onChange, allowCreate, emptyLabel = "ทุกหมวดหมู่" }: Props) {
  /** กางฟอร์ม "เพิ่มหมวดหมู่ใหม่" หรือยัง — พับไว้ก่อน ไม่งั้นฟอร์มกินพื้นที่ไปครึ่งแผงตั้งแต่เปิด */
  const [creating, setCreating] = useState(false);
  const [newParent, setNewParent] = useState("");
  const [newName, setNewName] = useState("");
  const [panelStyle, setPanelStyle] = useState<PanelStyle | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const parentListId = useId();

  // ใช้ position: fixed คำนวณตำแหน่งเอง เพราะ dropdown นี้อาจอยู่ใน modal ที่มี overflow-y: auto
  // ซึ่งจะ clip position: absolute ทิ้งถ้าโผล่พ้นขอบกล่อง
  // แต่ fixed แปลว่าต้องกันขอบจอเอง: ถ้าที่ว่างข้างล่างไม่พอ (เช่นช่องอยู่ท้ายโมดัล)
  // ให้กางขึ้นข้างบนแทน และหนีบความสูงให้พอดีที่ว่าง ไม่งั้นรายการล่างๆ จะหลุดพ้นจอไปกดไม่ได้
  const updatePosition = () => {
    const el = detailsRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const below = window.innerHeight - rect.bottom - PANEL_GAP - VIEWPORT_MARGIN;
    const above = rect.top - PANEL_GAP - VIEWPORT_MARGIN;
    const width = Math.max(rect.width, PANEL_MIN_WIDTH);
    const left = Math.max(VIEWPORT_MARGIN, Math.min(rect.left, window.innerWidth - width - VIEWPORT_MARGIN));
    const cap = Math.max(PANEL_MAX_MIN, Math.round(window.innerHeight * PANEL_MAX_RATIO));
    const flipUp = below < PANEL_MIN_HEIGHT && above > below;
    setPanelStyle(
      flipUp
        ? { bottom: window.innerHeight - rect.top + PANEL_GAP, left, minWidth: rect.width, maxHeight: Math.min(cap, above) }
        : { top: rect.bottom + PANEL_GAP, left, minWidth: rect.width, maxHeight: Math.min(cap, below) },
    );
  };

  useEffect(() => {
    const el = detailsRef.current;
    if (!el) return;
    const onToggle = () => { if (el.open) updatePosition(); else setCreating(false); };
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

  // โชว์ชื่อแรกพอ ที่เหลือสรุปเป็นป้ายนับ — ต่อกันด้วย ", " แล้วช่องแคบๆ จะตัดกลางคำจนอ่านไม่ออก
  const label = selected.length === 0 ? emptyLabel : selected[0];

  const options = [...new Set([...categories, ...selected])];
  const { topList, childrenMap } = groupCategories(options);
  const parentOptions = topList;

  return (
    <details className="cat-multiselect" ref={detailsRef}>
      <summary title={selected.length > 0 ? selected.join(", ") : undefined}>
        <span className={`cat-multiselect__label${selected.length === 0 ? " is-empty" : ""}`}>{label}</span>
        {selected.length > 1 && <span className="cat-multiselect__count">+{selected.length - 1}</span>}
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
        style={panelStyle ?? undefined}
      >
        <div className="cat-multiselect__list">
        {topList.length === 0 && <div className="cat-multiselect__empty">ยังไม่มีหมวดหมู่</div>}
        {topList.map((name) => {
          const children = childrenMap.get(name);
          const isExpanded = expanded.has(name);
          const checked = selected.includes(name);
          // ติ๊กบางส่วน — ยังไม่ได้เลือกหมวดหลักตรงๆ แต่มีซับหมวดข้างในถูกเลือกอยู่
          // (สำคัญตอนหมวดถูกพับไว้ ไม่งั้นช่องติ๊กว่างเปล่าทั้งที่ในนั้นมีของถูกเลือก)
          const indeterminate = !checked && (children?.some((c) => selected.includes(c)) ?? false);
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
                  <input
                    type="checkbox"
                    checked={checked}
                    ref={(el) => { if (el) el.indeterminate = indeterminate; }}
                    onChange={() => toggle(name)}
                  />
                  <span className="cat-multiselect__name">{name}</span>
                </label>
              </div>
              {children && isExpanded && (
                <div className="cat-multiselect__group">
                  {children.sort().map((c) => (
                    <label key={c} className="cat-multiselect__option cat-multiselect__option--sub">
                      <input type="checkbox" checked={selected.includes(c)} onChange={() => toggle(c)} />
                      <span className="cat-multiselect__name">{c.slice(name.length + 3)}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          );
        })}
        </div>
        {(allowCreate || selected.length > 0) && (
          <div className="cat-multiselect__foot">
            {allowCreate && creating && (
              <div className="cat-multiselect__new">
                <div className="cat-multiselect__new-row">
                  <input
                    type="text"
                    list={parentListId}
                    placeholder="หมวดหลัก (เว้นว่างได้)"
                    value={newParent}
                    autoFocus
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
            <div className="cat-multiselect__foot-row">
              {selected.length > 0 && (
                <button type="button" className="cat-multiselect__clear" onClick={() => onChange([])}>
                  ล้างที่เลือก ({selected.length})
                </button>
              )}
              {allowCreate && (
                <button type="button" className="cat-multiselect__create-toggle" onClick={() => setCreating((v) => !v)}>
                  {creating ? "ปิดฟอร์ม" : "+ เพิ่มหมวดหมู่ใหม่"}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </details>
  );
}
