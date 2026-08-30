"use client";

import { useMemo, useState } from "react";
import IngredientPanel, { TagChip, WarningList } from "@/components/ingredient/IngredientPanel";
import { useStockDB } from "@/lib/hooks/StockDBProvider";
import { SKIN_TYPE_LABELS, SKIN_CONCERN_LABELS, type SkinType, type SkinConcern } from "@/lib/db";
import { analyzeIngredients, analyzeSkinCompat, COMPAT_META, compareIngredients, TAG_META } from "@/lib/domain/ingredients";

function SkinScoreBadge({ score, level }: { score: number; level: string }) {
  return (
    <span className={`skin-score skin-score--${level}`}>
      {COMPAT_META[level as keyof typeof COMPAT_META]?.emoji} {score}/100
    </span>
  );
}

/** โปรไฟล์ผิวว่างเปล่า — ต้องเป็นค่าคงที่ตัวเดียว ไม่งั้นสร้าง object ใหม่ทุก render แล้ว memo ที่อ้างถึงพังหมด */
const EMPTY_PROFILE = { skinType: "" as SkinType, concerns: [] as SkinConcern[] };

export default function AnalyzePage() {
  const { db, setDb } = useStockDB();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [avoidInput, setAvoidInput] = useState("");
  const [search, setSearch] = useState("");

  const avoid = useMemo(() => db.avoidIngredients || [], [db.avoidIngredients]);
  const profile = db.skinProfile || EMPTY_PROFILE;

  // ทั้งสองตัวต้องอ่านโปรไฟล์จาก `prev` ไม่ใช่ตัวแปร `profile` ที่ปิดทับมาจากตอน render
  // ไม่งั้นถ้ามี setDb ซ้อนกันในรอบเดียว (เช่นกดติ๊ก concern สองอันติดๆ) อันหลังจะเขียนทับด้วยค่าเก่า
  const setSkinType = (skinType: SkinType) =>
    setDb((prev) => ({ ...prev, skinProfile: { ...(prev.skinProfile ?? EMPTY_PROFILE), skinType } }));

  const toggleConcern = (c: SkinConcern) =>
    setDb((prev) => {
      const cur = prev.skinProfile ?? EMPTY_PROFILE;
      return {
        ...prev,
        skinProfile: {
          ...cur,
          concerns: cur.concerns.includes(c) ? cur.concerns.filter((x) => x !== c) : [...cur.concerns, c],
        },
      };
    });

  const withIngredients = useMemo(
    () => db.items.filter((i) => i.ingredients?.trim()),
    [db.items]
  );

  const listed = useMemo(() => {
    const q = search.trim().toLowerCase();
    return withIngredients.filter(
      (i) => !q || i.name.toLowerCase().includes(q) || (i.ingredients || "").toLowerCase().includes(q)
    );
  }, [withIngredients, search]);

  const selected = useMemo(
    () => db.items.filter((i) => selectedIds.includes(i.id)),
    [db.items, selectedIds]
  );

  const comparison = useMemo(() => compareIngredients(selected, avoid), [selected, avoid]);

  const toggle = (id: string) =>
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const addAvoid = () => {
    const term = avoidInput.trim();
    if (!term || avoid.includes(term)) return;
    setDb((prev) => ({ ...prev, avoidIngredients: [...(prev.avoidIngredients || []), term] }));
    setAvoidInput("");
  };

  const removeAvoid = (term: string) => {
    setDb((prev) => ({ ...prev, avoidIngredients: (prev.avoidIngredients || []).filter((t) => t !== term) }));
  };

  return (
    <div className="page">
      <h1>🧪 วิเคราะห์ส่วนผสม</h1>
      <p className="sub sub-tight text-xs">
        ใช้ตารางข้อมูลในแอปล้วนๆ ไม่ได้ต่ออินเทอร์เน็ต เป็นแค่ตัวช่วยอ่านฉลาก ไม่ใช่คำแนะนำทางการแพทย์
      </p>

      {/* ── โปรไฟล์ผิว ── */}
      <h2 className="summary-section-title">🧑 โปรไฟล์ผิวของคุณ</h2>
      <p className="sub sub-tight text-xs">
        ตั้งค่าประเภทผิวและปัญหาผิว แล้วระบบจะวิเคราะห์ให้ว่าสินค้าแต่ละตัวเหมาะกับผิวเราไหม
      </p>
      <div className="toolbar">
        <select value={profile.skinType} onChange={(e) => setSkinType(e.target.value as SkinType)}>
          {(Object.entries(SKIN_TYPE_LABELS) as [SkinType, string][]).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
      </div>
      <div className="ing-tags" style={{ marginTop: 4 }}>
        {(Object.entries(SKIN_CONCERN_LABELS) as [SkinConcern, string][]).map(([k, v]) => (
          <button
            key={k}
            className={`ing-tag ${profile.concerns.includes(k) ? "ing-tag--good" : ""}`}
            onClick={() => toggleConcern(k)}
          >
            {profile.concerns.includes(k) ? "✓ " : ""}{v}
          </button>
        ))}
      </div>

      {/* ── ส่วนผสมที่แพ้/ไม่เอา ── */}
      <h2 className="summary-section-title">🚫 ส่วนผสมที่แพ้/ไม่เอา</h2>
      <div className="toolbar">
        <input
          type="text"
          placeholder="เช่น fragrance, alcohol denat, paraben"
          value={avoidInput}
          onChange={(e) => setAvoidInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") addAvoid(); }}
        />
        <button className="btn-primary" onClick={addAvoid}>+ เพิ่ม</button>
      </div>
      {avoid.length > 0 && (
        <div className="ing-tags">
          {avoid.map((t) => (
            <button className="ing-tag ing-tag--caution" key={t} onClick={() => removeAvoid(t)} title="กดเพื่อลบ">
              🚫 {t} ✕
            </button>
          ))}
        </div>
      )}

      {/* ── เลือกสินค้า ── */}
      <h2 className="summary-section-title">เลือกสินค้าที่จะวิเคราะห์ ({withIngredients.length} รายการมีส่วนผสม)</h2>
      {withIngredients.length === 0 ? (
        <div className="empty">
          ยังไม่มีสินค้าไหนกรอกส่วนผสมไว้ — เปิดแก้ไขสินค้าแล้วใส่ลิสต์ INCI ในช่อง &quot;ส่วนผสม&quot; ก่อน
        </div>
      ) : (
        <>
          <div className="toolbar">
            <input
              type="text"
              placeholder="ค้นหาชื่อสินค้า / ส่วนผสม..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {selectedIds.length > 0 && (
              <button className="btn-ghost" onClick={() => setSelectedIds([])}>ล้างที่เลือก ({selectedIds.length})</button>
            )}
          </div>

          <div className="ing-picker">
            {listed.map((i) => {
              const a = analyzeIngredients(i.ingredients, avoid);
              const warnCount = a.warnings.filter((w) => w.level === "warn").length;
              const compat = analyzeSkinCompat(i.ingredients, profile);
              return (
                <label className={`ing-picker__row ${selectedIds.includes(i.id) ? "ing-picker__row--on" : ""}`} key={i.id}>
                  <input type="checkbox" checked={selectedIds.includes(i.id)} onChange={() => toggle(i.id)} />
                  <span className="ing-picker__name">
                    {i.name}
                    {compat && <SkinScoreBadge score={compat.score} level={compat.level} />}
                  </span>
                  <span className="ing-tags">
                    {warnCount > 0 && <span className="ing-tag ing-tag--caution">⚠️ {warnCount}</span>}
                    {a.tags.slice(0, 4).map((t) => <TagChip key={t} tag={t} />)}
                  </span>
                </label>
              );
            })}
            {listed.length === 0 && <div className="empty">ไม่เจอสินค้าที่ตรงกับคำค้น</div>}
          </div>
        </>
      )}

      {/* ── วิเคราะห์ 1 ตัว ── */}
      {selected.length === 1 && (
        <>
          <h2 className="summary-section-title">{selected[0].name}</h2>
          <IngredientPanel ingredients={selected[0].ingredients} avoidIngredients={avoid} skinProfile={profile} collapsedList={false} />
        </>
      )}

      {/* ── เทียบหลายตัว ── */}
      {selected.length > 1 && (
        <>
          <h2 className="summary-section-title">ใช้ร่วมกัน {selected.length} ตัว — สิ่งที่ควรรู้</h2>
          {comparison.warnings.length === 0 ? (
            <div className="empty">ไม่เจอคู่ที่ตีกันตามกฎที่มีในแอป</div>
          ) : (
            <WarningList warnings={comparison.warnings} />
          )}

          {profile.skinType && (
            <div className="skin-comparison">
              {selected.map((s) => {
                const compat = analyzeSkinCompat(s.ingredients, profile);
                if (!compat) return null;
                return (
                  <div className="skin-card" key={s.id}>
                    <div className="skin-card__header">
                      <strong>{s.name}</strong>
                      <SkinScoreBadge score={compat.score} level={compat.level} />
                    </div>
                    <div className="skin-card__label">{compat.scoreLabel}</div>
                    {compat.pros.length > 0 && (
                      <div className="skin-card__list">
                        {compat.pros.map((c) => (
                          <div className="skin-compat skin-compat--good" key={c.tag}>
                            {COMPAT_META[c.level].emoji} {TAG_META[c.tag].label} — {c.reason}
                          </div>
                        ))}
                      </div>
                    )}
                    {compat.cons.length > 0 && (
                      <div className="skin-card__list">
                        {compat.cons.map((c) => (
                          <div className="skin-compat skin-compat--bad" key={c.tag}>
                            {COMPAT_META[c.level].emoji} {TAG_META[c.tag].label} — {c.reason}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          <h2 className="summary-section-title">
            ส่วนผสมที่ซ้ำกันทุกตัว ({comparison.shared.length} จาก {comparison.rows.length})
          </h2>
          <table>
            <thead>
              <tr>
                <th>ส่วนผสม</th>
                <th>ประเภท</th>
                <th>อยู่ในกี่ตัว</th>
                <th>สินค้า</th>
              </tr>
            </thead>
            <tbody>
              {comparison.rows.map((r) => (
                <tr key={r.key} className={r.itemIds.length === selected.length ? "ing-row--shared" : ""}>
                  <td>
                    {r.raw}
                    {r.th && <span className="ing-item__th">{r.th}</span>}
                  </td>
                  <td>
                    {r.tags.map((t) => (
                      <span className={`ing-tag ing-tag--${TAG_META[t].level}`} key={t}>
                        {TAG_META[t].emoji} {TAG_META[t].label}
                      </span>
                    ))}
                  </td>
                  <td>{r.itemIds.length}</td>
                  <td className="text-xs">
                    {r.itemIds.map((id) => selected.find((s) => s.id === id)?.name).filter(Boolean).join(" · ")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}
