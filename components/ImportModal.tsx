"use client";

import { useEffect, useState } from "react";
import { roundBaht } from "@/lib/price";
import { extractShopeePage } from "@/lib/shopee";
import { STATUS_OPTIONS } from "@/lib/statusOptions";
import CategoryMultiSelect from "@/components/CategoryMultiSelect";
import { ClearIcon, PasteIcon } from "@/components/icons";
import type { ImportCandidate, ItemStatus, StockItem } from "@/lib/types";

interface Props {
  open: boolean;
  categories: string[];
  items: StockItem[];
  onClose: () => void;
  onImport: (candidates: ImportCandidate[]) => void;
}

type MergeField = "qty" | "price" | "img" | "variant" | "size" | "note" | "status" | "ingredients";
const MERGE_FIELD_LABELS: Record<MergeField, string> = {
  qty: "จำนวน",
  price: "ราคา",
  img: "รูปภาพ",
  variant: "แท็กรอง",
  size: "ขนาด",
  note: "หมายเหตุ",
  status: "สถานะ",
  ingredients: "ส่วนผสม",
};

function norm(s: string) {
  return s.trim().toLowerCase();
}

/**
 * เช็คว่าสินค้าที่แยกได้ตรงกับสินค้าที่มีอยู่แล้วไหม (ดูจากลิงก์ก่อน ถ้าไม่มีลิงก์ค่อยดูชื่อ) — เผื่อกรณีซื้อซ้ำ
 * ต้องเช็คตัวเลือกสินค้า (variant) ด้วย ไม่งั้นสินค้าชื่อ/ลิงก์เดียวกันแต่คนละสี/ไซซ์จะถูกมองว่าซื้อซ้ำผิดๆ
 */
function findExisting(c: ImportCandidate, items: StockItem[]): StockItem | undefined {
  const sameVariant = (i: StockItem) => norm(i.variant || "") === norm(c.variant || "");
  if (c.link) {
    const byLink = items.find((i) => i.link && norm(i.link) === norm(c.link) && sameVariant(i));
    if (byLink) return byLink;
  }
  return items.find((i) => norm(i.name) === norm(c.name) && sameVariant(i));
}

/** ค่าใหม่ของฟิลด์นี้จากรายการนำเข้า (เทียบกับของเดิม) ถ้ามีค่าจริงและต่างจากเดิมจึงถือเป็นฟิลด์ที่ "มีค่าใหม่" ให้เลือกอัปเดตได้ */
function newFieldValue(field: MergeField, c: ImportCandidate, existing: StockItem): string | number | undefined {
  if (field === "qty") return c.qty;
  if (field === "price") return c.price;
  if (field === "img") return c.img && c.img !== existing.img ? c.img : undefined;
  if (field === "variant") return c.variant && c.variant !== existing.variant ? c.variant : undefined;
  if (field === "size") return c.size && c.size !== existing.size ? c.size : undefined;
  if (field === "note") return c.note && c.note !== existing.note ? c.note : undefined;
  if (field === "status") return c.status && c.status !== existing.status ? c.status : undefined;
  if (field === "ingredients") return c.ingredients && c.ingredients !== existing.ingredients ? c.ingredients : undefined;
  return undefined;
}

/**
 * บางครั้ง Shopee แยกสินค้าเดียวกัน (ลิงก์เดียวกัน) ออกเป็นหลาย anchor ในหน้าเดียว
 * (เช่น มีทั้งเวอร์ชัน mobile/desktop ซ้อนกันในหน้าเดียว) — รวมแถวพวกนี้เป็นแถวเดียวก่อนแสดงผล
 * ต้องดูลิงก์ด้วย ไม่ใช่แค่ชื่อ+ตัวเลือกสินค้า เพราะซื้อของเดียวกันจากคนละร้านคือคนละคำสั่งซื้อ ไม่ควรรวมกันเอง
 */
function mergeWithinBatch(list: ImportCandidate[]): ImportCandidate[] {
  const keyOf = (c: ImportCandidate) => `${norm(c.link)}||${norm(c.name)}||${norm(c.variant || "")}`;
  const order: string[] = [];
  const merged = new Map<string, ImportCandidate>();
  for (const c of list) {
    const key = keyOf(c);
    const existing = merged.get(key);
    if (existing) {
      const qty = existing.qty + c.qty;
      const lineTotal = (existing.lineTotal ?? 0) + (c.lineTotal ?? 0) || undefined;
      merged.set(key, {
        ...existing,
        qty,
        lineTotal,
        // รวมยอดแล้วหารใหม่ ไม่หยิบราคาเดิมมาดื้อๆ — จำนวนเปลี่ยนไปแล้วราคาต่อชิ้นต้องคิดจากยอดรวมใหม่
        price: lineTotal != null && qty > 0 ? roundBaht(lineTotal / qty) : existing.price ?? c.price,
        img: existing.img || c.img,
        link: existing.link || c.link,
      });
    } else {
      merged.set(key, c);
      order.push(key);
    }
  }
  return order.map((k) => merged.get(k)!);
}

/**
 * คิดช่อง `price` (ต่อชิ้น) ใหม่จากยอดรวมทั้งแถวที่แกะมาได้
 * `perUnit = false` = หน้าที่วางมาโชว์ราคาต่อชิ้นอยู่แล้ว ใช้ตัวเลขนั้นตรงๆ ไม่ต้องหาร
 */
function applyPriceMode(list: ImportCandidate[], perUnit: boolean): ImportCandidate[] {
  return list.map((c) =>
    c.lineTotal == null ? c : { ...c, price: perUnit && c.qty > 0 ? roundBaht(c.lineTotal / c.qty) : c.lineTotal }
  );
}

/** ออเดอร์ที่กำลังนำเข้าเก่ากว่าครั้งล่าสุดที่บันทึกไว้ = กำลังลงข้อมูลย้อนหลัง */
function isBackdated(c: ImportCandidate, existing: StockItem): boolean {
  return !!c.purchasedAt && !!existing.purchasedAt && c.purchasedAt < existing.purchasedAt;
}

function computeMergeFields(c: ImportCandidate, existing: StockItem): NonNullable<ImportCandidate["mergeFields"]> {
  const mergeFields: NonNullable<ImportCandidate["mergeFields"]> = {};
  (Object.keys(MERGE_FIELD_LABELS) as MergeField[]).forEach((f) => {
    mergeFields[f] = newFieldValue(f, c, existing) !== undefined;
  });
  return mergeFields;
}

function oldFieldValue(field: MergeField, existing: StockItem): string | number | undefined {
  if (field === "qty") return existing.qty;
  if (field === "price") return existing.price;
  if (field === "img") return existing.img;
  if (field === "variant") return existing.variant;
  if (field === "size") return existing.size;
  if (field === "note") return existing.note;
  if (field === "status") return existing.status;
  if (field === "ingredients") return existing.ingredients;
  return undefined;
}

export default function ImportModal({ open, categories, items, onClose, onImport }: Props) {
  const [html, setHtml] = useState("");
  const [candidates, setCandidates] = useState<ImportCandidate[]>([]);
  const [step, setStep] = useState<"input" | "review">("input");
  const [bulkCats, setBulkCats] = useState<string[]>([]);
  const [pricePerUnit, setPricePerUnit] = useState(true);
  /** ยอด "รวมค่าสินค้า" ที่หน้าออเดอร์บอกไว้ — ใช้เทียบว่าแกะรายการมาครบไหม */
  const [goodsSubtotal, setGoodsSubtotal] = useState<number | undefined>(undefined);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => { if (e.key === "Escape") handleClose(); };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;

  const handleParse = () => {
    const page = extractShopeePage(html);
    setGoodsSubtotal(page.goodsSubtotal);
    const parsed = applyPriceMode(mergeWithinBatch(page.items), pricePerUnit).map((c) => {
      const existing = findExisting(c, items);
      if (!existing) return c;
      // ข้อมูล Shopee ไม่มีหมวดหมู่/หมายเหตุอยู่แล้ว ถ้าเป็นการซื้อซ้ำให้ดึงค่าที่ตั้งไว้ของสินค้าเดิมมาโชว์ก่อนเลย ไม่ต้องเลือกหมวดหมู่ใหม่ทุกครั้ง
      return {
        ...c,
        cats: existing.cats,
        note: c.note || existing.note,
        existingId: existing.id,
        mergeExisting: true,
        mergeFields: computeMergeFields(c, existing),
      };
    });
    setCandidates(parsed);
    setStep("review");
  };

  const updateCandidate = (idx: number, patch: Partial<ImportCandidate>) => {
    setCandidates((prev) => prev.map((c, i) => (i === idx ? { ...c, ...patch } : c)));
  };

  /**
   * แก้จำนวนแล้วต้องคิดราคาต่อชิ้นใหม่ด้วย — ราคาที่โชว์อยู่หารมาจากจำนวนเดิม
   * (แก้ 3 → 1 แล้วปล่อยราคาไว้ = ราคาต่อชิ้นเหลือ 1 ใน 3 ของจริง)
   */
  const changeQty = (idx: number, qty: number) => {
    setCandidates((prev) =>
      prev.map((c, i) => {
        if (i !== idx) return c;
        const next = { ...c, qty };
        return c.lineTotal == null ? next : applyPriceMode([next], pricePerUnit)[0];
      })
    );
  };

  const unlinkExisting = (idx: number) => {
    setCandidates((prev) => prev.map((c, i) => (i === idx ? {
      ...c,
      existingId: undefined,
      mergeExisting: false,
      mergeFields: undefined,
    } : c)));
  };

  const toggleMergeField = (idx: number, field: MergeField, checked: boolean) => {
    setCandidates((prev) => prev.map((c, i) => (i === idx ? { ...c, mergeFields: { ...c.mergeFields, [field]: checked } } : c)));
  };

  const changePriceMode = (perUnit: boolean) => {
    setPricePerUnit(perUnit);
    setCandidates((prev) => applyPriceMode(prev, perUnit));
  };

  /**
   * เทียบผลรวมที่แกะได้กับ "รวมค่าสินค้า" บนหน้าออเดอร์ — จับเคสที่มีแถวหล่นหายแบบเงียบๆ
   * ใช้ `lineTotal` (ยอดดิบจากหน้าเว็บ) ไม่ใช่ `price` ที่ผู้ใช้แก้ได้ จะได้วัดเฉพาะว่า "แกะครบไหม"
   */
  const subtotalCheck = (() => {
    if (goodsSubtotal == null || candidates.length === 0) return null;
    const parsed = candidates.reduce((s, c) => s + (c.lineTotal ?? (c.price ?? 0) * c.qty), 0);
    return { parsed, expected: goodsSubtotal, ok: Math.abs(parsed - goodsSubtotal) < 0.5 };
  })();

  const orderDate = candidates.find((c) => c.purchasedAt)?.purchasedAt;

  const handleClose = () => {
    setHtml("");
    setCandidates([]);
    setStep("input");
    setBulkCats([]);
    setPricePerUnit(true);
    setGoodsSubtotal(undefined);
    onClose();
  };

  const pasteHtml = async () => {
    try {
      const text = await navigator.clipboard.readText();
      setHtml(text);
    } catch {
      alert("วางจากคลิปบอร์ดไม่ได้ — เบราว์เซอร์ไม่อนุญาต ลองกด Ctrl+V ในกล่องข้อความแทน");
    }
  };

  const handleConfirm = () => {
    const chosen = candidates.filter((c) => c.include && c.name.trim());
    onImport(chosen);
    handleClose();
  };

  return (
    <div className="modal-backdrop open">
      <div className="modal modal-wide">
        <div className="modal-header">
          <h2>นำเข้ารายการจาก Shopee</h2>
          <button className="modal-close" title="ปิด" onClick={handleClose}>×</button>
        </div>

        <div className="modal-body">
        {step === "input" ? (
          <>
            <p className="sub" style={{ marginTop: -8 }}>
              เปิดหน้า &quot;คำสั่งซื้อของฉัน&quot; ใน Shopee กด Ctrl+U หรือคลิกขวา &gt; &quot;ดูซอร์สหน้าเว็บ&quot; (View Page Source)
              แล้วคัดลอกโค้ด HTML ทั้งหมดมาวางในกล่องด้านล่าง ระบบจะพยายามดึงชื่อสินค้า จำนวน และรูปภาพให้อัตโนมัติ —
              กรุณาตรวจสอบและแก้ไขรายการก่อนนำเข้าจริง เพราะโครงสร้างหน้าเว็บของ Shopee อาจไม่แน่นอน
            </p>
            <div className="field">
              <textarea
                className="import-textarea"
                placeholder="วางโค้ด HTML ของหน้าออเดอร์ Shopee ที่นี่..."
                value={html}
                onChange={(e) => setHtml(e.target.value)}
              />
            </div>
            <div className="modal-actions modal-actions-inline">
              <button className="btn-ghost btn-icon-label" onClick={pasteHtml}>
                <PasteIcon /> วาง
              </button>
              {(html || candidates.length > 0) && (
                <button className="btn-ghost btn-icon-label" onClick={() => { setHtml(""); setCandidates([]); }}>
                  <ClearIcon /> ล้าง
                </button>
              )}
              <button className="btn-primary" onClick={handleParse}>แยกรายการ</button>
            </div>
          </>
        ) : (
          <>
            <button className="back-link import-back" onClick={() => setStep("input")}>
              ‹ ย้อนกลับไปแก้ไข HTML
            </button>

            {subtotalCheck && (
              <div className={`import-total-check ${subtotalCheck.ok ? "is-ok" : "is-warn"}`}>
                {subtotalCheck.ok ? (
                  <span>
                    ✅ ยอดตรงกับหน้าออเดอร์ — แกะได้ {candidates.length} รายการ รวม ฿
                    {roundBaht(subtotalCheck.parsed).toLocaleString("th-TH")} เท่ากับ &quot;รวมค่าสินค้า&quot;
                  </span>
                ) : (
                  <span>
                    ⚠️ <strong>ยอดไม่ตรงกับหน้าออเดอร์</strong> — แกะได้ {candidates.length} รายการ รวม ฿
                    {roundBaht(subtotalCheck.parsed).toLocaleString("th-TH")} แต่หน้าออเดอร์บอก &quot;รวมค่าสินค้า&quot; ฿
                    {roundBaht(subtotalCheck.expected).toLocaleString("th-TH")}
                    <span className="sub text-xs">
                      {" "}
                      (ส่วนต่าง ฿{roundBaht(Math.abs(subtotalCheck.expected - subtotalCheck.parsed)).toLocaleString("th-TH")}) —
                      อาจมีแถวที่แกะไม่เจอ ลองวาง HTML ใหม่ให้ครบทั้งหน้า ถ้าออเดอร์นี้มีของที่คืนเงินไปแล้วก็ถือว่าปกติ
                      เพราะระบบไม่นับของที่คืนเข้าสต็อก
                    </span>
                  </span>
                )}
              </div>
            )}

            {orderDate && (
              <div className="import-order-date text-xs">
                📅 วันที่สั่งซื้อที่แกะได้: <strong>{orderDate}</strong> — จะใช้เป็นวันที่ซื้อของทุกรายการแทนวันนี้
              </div>
            )}

            {candidates.length > 0 && (
              <label className="import-price-mode">
                <input
                  type="checkbox"
                  checked={pricePerUnit}
                  onChange={(e) => changePriceMode(e.target.checked)}
                />
                <span>
                  ราคาที่ Shopee โชว์เป็น<strong>ยอดรวมทั้งแถว</strong> — หารด้วยจำนวนให้เป็นราคาต่อชิ้น
                  <span className="sub text-xs"> (ติ๊กออกถ้าหน้าที่วางมาโชว์ราคาต่อชิ้นอยู่แล้ว)</span>
                </span>
              </label>
            )}

            {candidates.length > 0 && (
              <div className="import-bulk-row">
                <span>ตั้งหมวดหมู่ให้ทุกรายการ ({candidates.length} รายการ):</span>
                <CategoryMultiSelect
                  categories={categories}
                  selected={bulkCats}
                  onChange={(cats) => {
                    setBulkCats(cats);
                    setCandidates((prev) => prev.map((c) => ({ ...c, cats })));
                  }}
                  allowCreate
                  emptyLabel="เลือกหมวดหมู่..."
                />
              </div>
            )}

            <div className="import-list-wrap">
              {candidates.map((c, idx) => {
                const existingItem = c.existingId ? items.find((i) => i.id === c.existingId) : undefined;
                return (
                  <div className={`import-row ${existingItem ? "import-row--dup" : ""}`} key={idx}>
                    <input
                      type="checkbox"
                      checked={c.include}
                      onChange={(e) => updateCandidate(idx, { include: e.target.checked })}
                    />
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={c.img}
                      alt=""
                      onError={(e) => { (e.currentTarget as HTMLImageElement).style.visibility = "hidden"; }}
                    />
                    <div className="import-fields">
                      {existingItem && (
                        <div className="dup-box">
                          <label className="dup-note">
                            <input
                              type="checkbox"
                              checked={!!c.mergeExisting}
                              onChange={(e) => updateCandidate(idx, { mergeExisting: e.target.checked })}
                            />
                            🔁 ซื้อซ้ำ — มีอยู่แล้ว {existingItem.qty} ชิ้น {c.mergeExisting ? "(จะรวมเข้ารายการเดิม)" : "(จะเพิ่มเป็นรายการใหม่)"}
                          </label>
                          {c.mergeExisting && isBackdated(c, existingItem) && (
                            <div className="dup-backdated text-xs">
                              🕓 ออเดอร์นี้ ({c.purchasedAt}) <strong>เก่ากว่า</strong>ครั้งล่าสุดที่บันทึกไว้ ({existingItem.purchasedAt}) —
                              จำนวนยังบวกเข้าสต็อก และราคาลงประวัติตามวันที่ของออเดอร์ แต่จะไม่ถอย &quot;วันที่ซื้อล่าสุด&quot;
                              กับราคาปัจจุบันให้เก่าลง
                            </div>
                          )}
                          {c.mergeExisting && (
                            <div className="dup-fields">
                              {(Object.keys(MERGE_FIELD_LABELS) as MergeField[]).map((field) => {
                                const newVal = newFieldValue(field, c, existingItem);
                                if (newVal === undefined) return null;
                                const oldVal = oldFieldValue(field, existingItem);
                                return (
                                  <label key={field} className="dup-field-row">
                                    <input
                                      type="checkbox"
                                      checked={c.mergeFields?.[field] !== false}
                                      onChange={(e) => toggleMergeField(idx, field, e.target.checked)}
                                    />
                                    <span className="dup-field-label">{MERGE_FIELD_LABELS[field]}</span>
                                    <span className="dup-field-diff">
                                      {field === "qty"
                                        ? `${oldVal} + ${c.qty}`
                                        : field === "price"
                                          ? isBackdated(c, existingItem)
                                            // ออเดอร์ย้อนหลังลงได้แค่ประวัติ ราคาปัจจุบันไม่ขยับ อย่าเขียนลูกศรให้เข้าใจผิด
                                            ? `฿${newVal} /ชิ้น → ลงประวัติราคา (ราคาปัจจุบัน ฿${oldVal ?? "-"} คงเดิม)`
                                            : `฿${oldVal ?? "-"} → ฿${newVal} /ชิ้น`
                                          : `${oldVal ?? "-"} → ${newVal}`}
                                    </span>
                                  </label>
                                );
                              })}
                            </div>
                          )}
                          <button type="button" className="dup-unlink" onClick={() => unlinkExisting(idx)}>
                            ✖️ ยกเลิกการจับคู่ (ไม่ใช่สินค้าเดียวกัน)
                          </button>
                        </div>
                      )}
                      <input
                        type="text"
                        placeholder="ชื่อสินค้า"
                        value={c.name}
                        onChange={(e) => updateCandidate(idx, { name: e.target.value })}
                      />
                      <CategoryMultiSelect
                        categories={categories}
                        selected={c.cats}
                        onChange={(cats) => updateCandidate(idx, { cats })}
                        allowCreate
                        emptyLabel="หมวดหมู่ (ไม่บังคับ)"
                      />
                      <input
                        type="text"
                        placeholder="แท็กรอง เช่น ตัวเลือกสินค้า/สี/รุ่น (ไม่บังคับ)"
                        value={c.variant || ""}
                        onChange={(e) => updateCandidate(idx, { variant: e.target.value })}
                      />
                      <input
                        type="text"
                        placeholder="ขนาด เช่น S, M, L (ไม่บังคับ)"
                        value={c.size || ""}
                        onChange={(e) => updateCandidate(idx, { size: e.target.value })}
                      />
                      <input
                        type="text"
                        placeholder="หมายเหตุ (ไม่บังคับ)"
                        value={c.note || ""}
                        onChange={(e) => updateCandidate(idx, { note: e.target.value })}
                      />
                      <textarea
                        className="import-ingredients"
                        placeholder="ส่วนผสม / INCI — วางลิสต์คั่นด้วยจุลภาค (ไม่บังคับ)"
                        value={c.ingredients || ""}
                        onChange={(e) => updateCandidate(idx, { ingredients: e.target.value })}
                      />
                      <div className="import-qty">
                        จำนวน
                        <input
                          type="number"
                          min={0}
                          value={c.qty}
                          onChange={(e) => changeQty(idx, Math.max(0, parseInt(e.target.value) || 0))}
                        />
                        ราคา/ชิ้น
                        <input
                          type="number"
                          min={0}
                          placeholder="฿"
                          value={c.price ?? ""}
                          onChange={(e) => updateCandidate(idx, { price: e.target.value ? Math.max(0, parseFloat(e.target.value)) : undefined })}
                        />
                        {c.price != null && c.qty > 1 && (
                          <span className="import-price-total text-xs">
                            × {c.qty} = ฿{roundBaht(c.price * c.qty).toLocaleString("th-TH")}
                          </span>
                        )}
                        <select value={c.status} onChange={(e) => updateCandidate(idx, { status: e.target.value as ItemStatus })}>
                          {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            {candidates.length === 0 && (
              <div className="empty" style={{ padding: 16 }}>ไม่พบรายการสินค้าจาก HTML ที่วาง — กด &quot;ย้อนกลับ&quot; เพื่อลองใหม่</div>
            )}
          </>
        )}
        </div>

        <div className="modal-actions">
          <button className="btn-ghost" onClick={handleClose}>ยกเลิก</button>
          <button className="btn-primary" onClick={handleConfirm} disabled={step === "input"}>นำเข้ารายการที่เลือก</button>
        </div>
      </div>
    </div>
  );
}
