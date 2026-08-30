"use client";

import { useState } from "react";
import {
  MERGE_FIELD_LABELS,
  applyPriceMode,
  detectPricePerUnit,
  isBackdated,
  linkToExisting,
  mergeWithinBatch,
  newFieldValue,
  oldFieldValue,
  orderMetaFrom,
  rowLineTotal,
  type MergeField,
} from "@/lib/import/merge";
import { roundBaht } from "@/lib/domain/price";
import { findDuplicateOrder } from "@/lib/domain/orders";
import { DEFAULT_IMPORT_SOURCE, IMPORT_SITES, importSite } from "@/lib/import/sites";
import { extractOrderPage } from "@/lib/import/orderPage";
import { STATUS_OPTIONS } from "@/lib/core/statusOptions";
import CategoryMultiSelect from "@/components/ui/CategoryMultiSelect";
import ModalShell from "@/components/ui/ModalShell";
import { ClearIcon, PasteIcon } from "@/components/ui/icons";
import type { ImportCandidate, ImportSource, ItemStatus, PurchaseOrder, StockItem } from "@/lib/types";

interface Props {
  open: boolean;
  categories: string[];
  items: StockItem[];
  /** ออเดอร์ที่เคยบันทึกไว้ — ใช้เตือนตอนนำเข้าหน้าเดิมซ้ำ (ค่าส่งจะถูกนับสองรอบแบบเงียบๆ) */
  orders?: PurchaseOrder[];
  onClose: () => void;
  onImport: (
    candidates: ImportCandidate[],
    extras?: { shipping: number; discount: number; date?: string; shop?: string; note?: string }
  ) => void;
}

export default function ImportModal({ open, categories, items, orders, onClose, onImport }: Props) {
  const [source, setSource] = useState<ImportSource>(DEFAULT_IMPORT_SOURCE);
  const [html, setHtml] = useState("");
  const [candidates, setCandidates] = useState<ImportCandidate[]>([]);
  const [step, setStep] = useState<"input" | "review">("input");
  const [bulkCats, setBulkCats] = useState<string[]>([]);
  const [pricePerUnit, setPricePerUnit] = useState(importSite(DEFAULT_IMPORT_SOURCE).priceIsLineTotal);
  /** ยอด "รวมค่าสินค้า" ที่หน้าออเดอร์บอกไว้ — ใช้เทียบว่าแกะรายการมาครบไหม */
  const [goodsSubtotal, setGoodsSubtotal] = useState<number | undefined>(undefined);
  /*
   * ค่าส่ง/ส่วนลดของออเดอร์ — เก็บเป็น "ข้อความ" ไม่ใช่ตัวเลข เพราะช่องกรอกต้องลบให้ว่างได้
   * (บังคับเป็น number แล้วลบเลขตัวสุดท้ายไม่ได้ มันเด้งกลับเป็น 0 ทันที)
   */
  const [shipping, setShipping] = useState("");
  const [discount, setDiscount] = useState("");
  /** ยอดชำระทั้งหมดที่หน้าออเดอร์บอก — ใช้เทียบว่าค่าส่ง/ส่วนลดที่กรอกครบหรือยัง */
  const [grandTotal, setGrandTotal] = useState<number | undefined>(undefined);

  const site = importSite(source);

  const handleParse = () => {
    const page = extractOrderPage(html, source);
    const merged = mergeWithinBatch(page.items);
    const perUnit = detectPricePerUnit(merged, page.goodsSubtotal, site.priceIsLineTotal);
    setGoodsSubtotal(page.goodsSubtotal);
    setShipping(page.shipping != null ? String(page.shipping) : "");
    setDiscount(page.discount != null ? String(page.discount) : "");
    setGrandTotal(page.grandTotal);
    setPricePerUnit(perUnit);
    setCandidates(linkToExisting(applyPriceMode(merged, perUnit), items));
    setStep("review");
  };

  /** ล้างทุกอย่างที่ได้มาจากการแกะหน้า แล้วตั้งค่าเริ่มต้นของร้านที่เลือกไว้ใหม่ */
  const clearParsed = (next: ImportSource) => {
    setCandidates([]);
    setPricePerUnit(importSite(next).priceIsLineTotal);
    setGoodsSubtotal(undefined);
    setShipping("");
    setDiscount("");
    setGrandTotal(undefined);
  };

  /** เปลี่ยนร้าน = ต้องแกะใหม่ทั้งหมด (คนละโครงหน้า คนละป้ายยอดเงิน) — ล้างของที่แกะไว้ทิ้ง */
  const changeSource = (next: ImportSource) => {
    setSource(next);
    clearParsed(next);
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

  /** เทียบผลรวมที่แกะได้กับ "รวมค่าสินค้า" บนหน้าออเดอร์ — จับเคสที่มีแถวหล่นหายแบบเงียบๆ */
  const subtotalCheck = (() => {
    if (goodsSubtotal == null || candidates.length === 0) return null;
    const parsed = candidates.reduce((s, c) => s + rowLineTotal(c, pricePerUnit), 0);
    return { parsed, expected: goodsSubtotal, ok: Math.abs(parsed - goodsSubtotal) < 0.5 };
  })();

  /** แถวที่จะนำเข้าจริง — วันที่/ร้านของออเดอร์ต้องมาจากตรงนี้ ไม่ใช่จากแถวที่ผู้ใช้ติ๊กออกไปแล้ว */
  const chosen = candidates.filter((c) => c.include && c.name.trim());
  const { date: orderDate, shop: orderShop } = orderMetaFrom(chosen, candidates);

  const shippingNum = Math.max(0, Number(shipping) || 0);
  const discountNum = Math.max(0, Number(discount) || 0);

  /**
   * เทียบ "ราคาสินค้า + ค่าส่ง − ส่วนลด" กับยอดชำระทั้งหมดบนหน้าออเดอร์
   * ต่างกัน = ยังมีค่าใช้จ่ายที่แกะไม่เจอ (หรือแกะเกิน) ให้ผู้ใช้แก้ตัวเลขเองก่อนนำเข้า
   */
  const duplicateOrder = findDuplicateOrder(orders, {
    date: orderDate,
    shop: orderShop,
    shipping: shippingNum,
    discount: discountNum,
  });

  const payableCheck = (() => {
    if (grandTotal == null || candidates.length === 0) return null;
    const goods = candidates.reduce((s, c) => s + (c.price ?? 0) * c.qty, 0);
    const computed = goods + shippingNum - discountNum;
    return { computed, expected: grandTotal, ok: Math.abs(computed - grandTotal) < 0.5 };
  })();

  const handleClose = () => {
    setHtml("");
    setStep("input");
    setBulkCats([]);
    setSource(DEFAULT_IMPORT_SOURCE);
    clearParsed(DEFAULT_IMPORT_SOURCE);
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
    onImport(chosen, {
      shipping: shippingNum,
      discount: discountNum,
      date: orderDate,
      shop: orderShop,
    });
    handleClose();
  };

  return (
    <ModalShell open={open} title={`นำเข้ารายการจาก ${site.label}`} onClose={handleClose} wide>
        <div className="modal-body">
        {step === "input" ? (
          <>
            <div className="import-sites" role="group" aria-label="เลือกร้านที่จะนำเข้า">
              {IMPORT_SITES.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  className={`import-site ${s.id === source ? "is-active" : ""}`}
                  aria-pressed={s.id === source}
                  onClick={() => changeSource(s.id)}
                >
                  {s.label}
                </button>
              ))}
            </div>
            <p className="sub" style={{ marginTop: 0 }}>
              {site.hint} ระบบจะพยายามดึงชื่อสินค้า จำนวน ราคา และรูปภาพให้อัตโนมัติ —
              กรุณาตรวจสอบและแก้ไขรายการก่อนนำเข้าจริง เพราะโครงสร้างหน้าเว็บของแต่ละร้านอาจไม่แน่นอน
            </p>
            <div className="field">
              <textarea
                className="import-textarea"
                placeholder={`วางโค้ด HTML ของหน้าออเดอร์ ${site.label} ที่นี่...`}
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
              <div className="import-extras">
                <div className="import-extras__title">
                  ค่าใช้จ่ายของออเดอร์นี้ (ไม่ได้อยู่ในราคาสินค้า)
                  <span className="sub text-xs"> — แกะให้อัตโนมัติแบบเดาๆ ตรวจแล้วแก้ได้</span>
                </div>
                <div className="import-extras__row">
                  <label>
                    ค่าส่ง
                    <input
                      type="number"
                      min={0}
                      placeholder="฿0"
                      value={shipping}
                      onChange={(e) => setShipping(e.target.value)}
                    />
                  </label>
                  <label>
                    ส่วนลด/โค้ด
                    <input
                      type="number"
                      min={0}
                      placeholder="฿0"
                      value={discount}
                      onChange={(e) => setDiscount(e.target.value)}
                    />
                  </label>
                </div>
                {duplicateOrder && (shippingNum > 0 || discountNum > 0) && (
                  <div className="import-extras__check is-warn">
                    ⚠️ <strong>เคยบันทึกออเดอร์นี้ไว้แล้ว</strong> (วันเดียวกัน ร้านเดียวกัน ยอดเท่ากัน) —
                    นำเข้าซ้ำจะทำให้ค่าส่ง/ส่วนลดถูกนับสองรอบ ถ้าแค่อยากลงสินค้าเพิ่ม ให้ตั้งค่าส่งกับส่วนลดเป็น 0
                    (สินค้ายังนำเข้าได้ตามปกติ)
                  </div>
                )}
                {payableCheck && (
                  <div className={`import-extras__check ${payableCheck.ok ? "is-ok" : "is-warn"}`}>
                    {payableCheck.ok
                      ? `✅ ราคาสินค้า + ค่าส่ง − ส่วนลด = ฿${roundBaht(payableCheck.computed).toLocaleString("th-TH")} ตรงกับยอดชำระบนหน้าออเดอร์`
                      : `⚠️ คิดได้ ฿${roundBaht(payableCheck.computed).toLocaleString("th-TH")} แต่หน้าออเดอร์บอกยอดชำระ ฿${roundBaht(payableCheck.expected).toLocaleString("th-TH")} — ลองแก้ค่าส่ง/ส่วนลดให้ตรง`}
                  </div>
                )}
                <p className="sub text-xs" style={{ margin: "6px 0 0" }}>
                  เงินก้อนนี้ถูกบันทึกเป็นของ<strong>ทั้งออเดอร์</strong> ไม่ได้หารลงสินค้าแต่ละชิ้น —
                  หน้าสรุปยอดจะบวกเข้ายอดรวมกับยอดรายเดือน แต่ไม่เข้ายอดรายหมวด/รายชิ้น
                  (กรอก 0 ทั้งคู่ = ไม่บันทึกออเดอร์)
                </p>
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
                  ราคาที่ {site.label} โชว์เป็น<strong>ยอดรวมทั้งแถว</strong> — หารด้วยจำนวนให้เป็นราคาต่อชิ้น
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
                        placeholder="ร้านค้า (ไม่บังคับ — แกะให้อัตโนมัติ)"
                        value={c.shop || ""}
                        onChange={(e) => updateCandidate(idx, { shop: e.target.value })}
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
              <div className="empty" style={{ padding: 16 }}>
                ไม่พบรายการสินค้าจาก HTML ที่วาง — กด &quot;ย้อนกลับ&quot; เพื่อลองใหม่
                (เช็คด้วยว่าเลือกร้านตรงกับหน้าที่คัดลอกมาไหม ตอนนี้เลือก <strong>{site.label}</strong> อยู่)
              </div>
            )}
          </>
        )}
        </div>

        <div className="modal-actions">
          <button className="btn-ghost" onClick={handleClose}>ยกเลิก</button>
          <button className="btn-primary" onClick={handleConfirm} disabled={step === "input"}>นำเข้ารายการที่เลือก</button>
        </div>
    </ModalShell>
  );
}
