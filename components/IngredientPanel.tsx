"use client";

import { useMemo, useState } from "react";
import {
  analyzeIngredients,
  analyzeSkinCompat,
  COMPAT_META,
  TAG_META,
  type IngredientTag,
  type IngredientWarning,
} from "@/lib/domain/ingredients";
import type { SkinProfile } from "@/lib/db";

/** ป้ายแท็กส่วนผสมหนึ่งอัน (สีตามระดับ good/neutral/caution) */
export function TagChip({ tag, count }: { tag: IngredientTag; count?: number }) {
  const meta = TAG_META[tag];
  return (
    <span className={`ing-tag ing-tag--${meta.level}`}>
      {meta.emoji} {meta.label}
      {count != null && count > 1 && <span className="ing-tag__count">{count}</span>}
    </span>
  );
}

/** กล่องคำเตือน (ตัวที่ตีกัน / ตัวที่ตั้งไว้ว่าแพ้) */
export function WarningList({ warnings }: { warnings: IngredientWarning[] }) {
  if (warnings.length === 0) return null;
  return (
    <div className="ing-warnings">
      {warnings.map((w) => (
        <div className={`ing-warn ing-warn--${w.level}`} key={w.id}>
          <div className="ing-warn__title">
            {w.level === "warn" ? "⚠️" : "ℹ️"} {w.title}
          </div>
          <div className="ing-warn__detail">{w.detail}</div>
          <div className="ing-warn__culprits">{w.culprits.join(" · ")}</div>
        </div>
      ))}
    </div>
  );
}

interface Props {
  ingredients: string | undefined;
  avoidIngredients?: string[];
  skinProfile?: SkinProfile;
  /** ซ่อนลิสต์ส่วนผสมทีละตัวไว้ก่อน (ใช้ในที่แคบๆ อย่าง modal) */
  collapsedList?: boolean;
}

/** สรุปผลวิเคราะห์ส่วนผสมของสินค้าชิ้นเดียว: แท็ก + คำเตือน + ลิสต์ส่วนผสมที่แยกได้ */
export default function IngredientPanel({ ingredients, avoidIngredients = [], skinProfile, collapsedList = true }: Props) {
  const [showList, setShowList] = useState(!collapsedList);
  const analysis = useMemo(
    () => analyzeIngredients(ingredients, avoidIngredients),
    [ingredients, avoidIngredients]
  );
  const compat = useMemo(
    () => analyzeSkinCompat(ingredients, skinProfile),
    [ingredients, skinProfile]
  );

  if (analysis.list.length === 0) return null;

  return (
    <div className="ing-panel">
      <div className="ing-summary">
        แยกได้ {analysis.list.length} ตัว · รู้จัก {analysis.known.length} ตัว
        {analysis.unknown.length > 0 && ` · ไม่รู้จัก ${analysis.unknown.length} ตัว`}
      </div>

      {compat && (
        <div className={`skin-compat-bar skin-compat-bar--${compat.level}`}>
          <div className="skin-compat-bar__score">
            <span className={`skin-score skin-score--${compat.level}`}>
              {COMPAT_META[compat.level].emoji} {compat.score}/100
            </span>
            <span className="skin-compat-bar__label">{compat.scoreLabel}</span>
          </div>
          {compat.pros.length > 0 && (
            <div className="skin-compat-bar__list">
              {compat.pros.map((c) => (
                <span className="skin-compat skin-compat--good" key={c.tag}>
                  {COMPAT_META[c.level].emoji} {TAG_META[c.tag].label} — {c.reason}
                </span>
              ))}
            </div>
          )}
          {compat.cons.length > 0 && (
            <div className="skin-compat-bar__list">
              {compat.cons.map((c) => (
                <span className="skin-compat skin-compat--bad" key={c.tag}>
                  {COMPAT_META[c.level].emoji} {TAG_META[c.tag].label} — {c.reason}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {analysis.tags.length > 0 && (
        <div className="ing-tags">
          {analysis.tags.map((t) => <TagChip key={t} tag={t} count={analysis.tagCounts[t]} />)}
        </div>
      )}

      <WarningList warnings={analysis.warnings} />

      <button type="button" className="back-link" onClick={() => setShowList((v) => !v)}>
        {showList ? "▲ ซ่อนรายชื่อส่วนผสม" : `▼ ดูรายชื่อส่วนผสม (${analysis.list.length})`}
      </button>

      {showList && (
        <ol className="ing-list">
          {analysis.list.map((p) => (
            <li className={`ing-item ${p.defs.length === 0 ? "ing-item--unknown" : ""}`} key={p.key}>
              <span className="ing-item__name">
                {p.raw}
                {p.pct != null && <span className="ing-item__pct"> {p.pct}%</span>}
              </span>
              {p.defs[0]?.th && <span className="ing-item__th">{p.defs[0].th}</span>}
              {p.tags.length > 0 && (
                <span className="ing-item__tags">
                  {p.tags.map((t) => <TagChip key={t} tag={t} />)}
                </span>
              )}
              {p.defs.find((def) => def.note) && (
                <span className="ing-item__note">{p.defs.find((def) => def.note)!.note}</span>
              )}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
