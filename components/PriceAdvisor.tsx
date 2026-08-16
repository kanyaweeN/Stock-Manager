"use client";

import { useMemo, useState } from "react";
import { baht } from "@/lib/cost";
import {
  ROUNDING_OPTIONS,
  pct,
  priceLadder,
  priceOutcome,
  pricingNotes,
  suggestPrice,
} from "@/lib/pricing";
import { usePricingSettings } from "@/lib/usePricingSettings";
import type { PriceRounding } from "@/lib/types";

interface Props {
  /** ต้นทุนต่อ 1 ชิ้น (ผลผลิต 1 หน่วย) */
  cost: number;
  /** หน่วยผลผลิต เช่น "ชิ้น" / "ขวด" */
  unitLabel?: string;
  /** ราคาที่ตั้งไว้อยู่ตอนนี้ (ถ้ามี) — เอาไว้บอกว่าถึงเป้าหรือยัง */
  sellPrice?: number;
  /** ให้กดเลือกราคาไปใส่ช่องราคาขายได้ — ไม่ส่งมา = โหมดดูอย่างเดียว */
  onUsePrice?: (price: number) => void;
}

const n = (v: string) => {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
};

/**
 * "ควรขายเท่าไร" — คิดราคาขายจากต้นทุนต่อชิ้น + กำไรที่อยากได้ + ค่าธรรมเนียม
 * ค่าตั้งต่างๆ อยู่ที่ `db.pricing` (ใช้ร่วมกันทุกสูตร) ตัวคำนวณล้วนๆ อยู่ที่ lib/pricing.ts
 */
export default function PriceAdvisor({ cost, unitLabel = "ชิ้น", sellPrice, onUsePrice }: Props) {
  const [settings, setSettings] = usePricingSettings();

  /** เก็บค่าที่กำลังพิมพ์เป็นสตริง จะได้ลบให้ว่างได้โดยไม่โดนเด้งเป็น 0 (เหมือน RecipeModal) */
  const [draft, setDraft] = useState({
    margin: String(settings.targetMarginPct),
    fee: settings.feePct ? String(settings.feePct) : "",
    perUnit: settings.feePerUnit ? String(settings.feePerUnit) : "",
  });

  const suggested = useMemo(() => suggestPrice(cost, settings), [cost, settings]);
  const ladder = useMemo(() => priceLadder(cost, settings), [cost, settings]);
  const notes = useMemo(() => pricingNotes(cost, settings, sellPrice), [cost, settings, sellPrice]);
  const current = sellPrice != null && sellPrice > 0 ? priceOutcome(sellPrice, cost, settings) : null;

  const patchMargin = (v: string) => {
    setDraft((d) => ({ ...d, margin: v }));
    setSettings({ ...settings, targetMarginPct: Math.min(99, Math.max(0, n(v))) });
  };
  const patchFee = (v: string) => {
    setDraft((d) => ({ ...d, fee: v }));
    setSettings({ ...settings, feePct: Math.min(99, Math.max(0, n(v))) });
  };
  const patchPerUnit = (v: string) => {
    setDraft((d) => ({ ...d, perUnit: v }));
    setSettings({ ...settings, feePerUnit: Math.max(0, n(v)) });
  };
  const patchRounding = (v: PriceRounding) => setSettings({ ...settings, rounding: v });

  /** กดเลือกราคาจากตาราง = เอาราคาไปใส่ + ย้ายเป้ากำไรมาที่แถวนั้น จะได้ไม่ขัดกับหัวข้อด้านบน */
  const useRow = (price: number, targetMarginPct: number) => {
    setDraft((d) => ({ ...d, margin: String(targetMarginPct) }));
    setSettings({ ...settings, targetMarginPct });
    onUsePrice?.(price);
  };

  return (
    <section className="price-advisor">
      <div className="price-advisor__head">
        <div>
          <div className="price-advisor__label">ราคาที่ควรขาย (ต่อ 1 {unitLabel})</div>
          {suggested ? (
            <>
              <div className="price-advisor__price">{baht(suggested.price)}</div>
              <div className="price-advisor__meta text-xs">
                ทุน {baht(cost)} → กำไรชิ้นละ {baht(suggested.outcome.profit)} ({pct(suggested.outcome.marginPct)}) ·{" "}
                {suggested.outcome.multiple.toFixed(1)} เท่าของทุน
              </div>
            </>
          ) : (
            <div className="price-advisor__price price-advisor__price--none">—</div>
          )}
        </div>
        {suggested && onUsePrice && (
          <button className="btn-primary btn-sm" onClick={() => onUsePrice(suggested.price)}>
            ใช้ราคานี้
          </button>
        )}
      </div>

      <div className="price-advisor__controls">
        <label className="cost-num">
          <span>กำไรที่อยากได้ (% ของราคาขาย)</span>
          <input type="number" min="0" max="99" value={draft.margin} onChange={(e) => patchMargin(e.target.value)} />
        </label>
        <label className="cost-num">
          <span>ค่าธรรมเนียมร้าน/แพลตฟอร์ม (%)</span>
          <input type="number" min="0" max="99" placeholder="0" value={draft.fee} onChange={(e) => patchFee(e.target.value)} />
        </label>
        <label className="cost-num">
          <span>ค่ากล่อง/ค่าส่งที่ออกเอง (บาท/{unitLabel})</span>
          <input type="number" min="0" placeholder="0" value={draft.perUnit} onChange={(e) => patchPerUnit(e.target.value)} />
        </label>
        <label className="cost-num">
          <span>ปัดราคา</span>
          <select value={settings.rounding} onChange={(e) => patchRounding(e.target.value as PriceRounding)}>
            {ROUNDING_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </label>
      </div>

      {ladder.length > 0 && (
        <table className="price-table">
          <thead>
            <tr>
              <th>อยากได้กำไร</th>
              <th>ตั้งราคา</th>
              <th>เข้ากระเป๋า</th>
              <th>กำไร/{unitLabel}</th>
              {onUsePrice && <th />}
            </tr>
          </thead>
          <tbody>
            {ladder.map((o) => (
              <tr key={o.targetMarginPct} className={o.targetMarginPct === settings.targetMarginPct ? "price-table__row--active" : ""}>
                <td>{pct(o.targetMarginPct)}</td>
                <td><strong>{baht(o.price)}</strong></td>
                <td>{baht(o.outcome.net)}</td>
                <td className={o.outcome.profit < 0 ? "price-table__loss" : "price-table__profit"}>
                  {baht(o.outcome.profit)} <small>({pct(o.outcome.marginPct)})</small>
                </td>
                {onUsePrice && (
                  <td>
                    <button className="btn-ghost btn-sm" onClick={() => useRow(o.price, o.targetMarginPct)}>ใช้</button>
                  </td>
                )}
              </tr>
            ))}
            {current && (
              <tr className="price-table__row--current">
                <td>ราคาที่ตั้งไว้</td>
                <td><strong>{baht(current.price)}</strong></td>
                <td>{baht(current.net)}</td>
                <td className={current.profit < 0 ? "price-table__loss" : "price-table__profit"}>
                  {baht(current.profit)} <small>({pct(current.marginPct)})</small>
                </td>
                {onUsePrice && <td />}
              </tr>
            )}
          </tbody>
        </table>
      )}

      <ul className="price-notes text-xs">
        {notes.map((t, i) => (
          <li key={i}>{t}</li>
        ))}
      </ul>
    </section>
  );
}
