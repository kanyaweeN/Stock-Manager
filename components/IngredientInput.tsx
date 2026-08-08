"use client";

import { useCallback, useRef, useState } from "react";
import { searchProducts, type ProductEntry } from "@/lib/productDb";
import { PasteIcon, ClearIcon } from "@/components/icons";

interface Props {
  value: string;
  onChange: (v: string) => void;
}

export default function IngredientInput({ value, onChange }: Props) {
  const [searchQ, setSearchQ] = useState("");
  const [results, setResults] = useState<ProductEntry[]>([]);
  const [showSearch, setShowSearch] = useState(false);
  const [ocrBusy, setOcrBusy] = useState(false);
  const [ocrMsg, setOcrMsg] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const doSearch = (q: string) => {
    setSearchQ(q);
    setResults(q.trim().length >= 2 ? searchProducts(q) : []);
  };

  const pickProduct = (p: ProductEntry) => {
    onChange(p.inci);
    setShowSearch(false);
    setSearchQ("");
    setResults([]);
  };

  const pasteClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text.trim()) onChange(text.trim());
    } catch {
      alert("วางจากคลิปบอร์ดไม่ได้ — ลอง Ctrl+V ในกล่องข้อความแทน");
    }
  };

  const handleOcr = useCallback(async (file: File) => {
    setOcrBusy(true);
    setOcrMsg("กำลังโหลด OCR engine...");
    try {
      const { createWorker } = await import("tesseract.js");
      const worker = await createWorker("eng");
      setOcrMsg("กำลังอ่านตัวอักษรจากรูป...");
      const { data } = await worker.recognize(file);
      await worker.terminate();

      const text = data.text || "";
      if (!text.trim()) {
        setOcrMsg("ไม่เจอตัวอักษรในรูป — ลองถ่ายให้ชัดขึ้น");
        return;
      }

      // พยายามตัดเฉพาะส่วน ingredients
      const inciMatch = text.match(/(?:ingredients?|ส่วนผสม|ส่วนประกอบ)\s*[:：]\s*([\s\S]+)/i);
      const extracted = inciMatch ? inciMatch[1].trim() : text.trim();
      onChange(extracted);
      setOcrMsg(`อ่านได้ ${extracted.length} ตัวอักษร — ตรวจสอบและแก้ไขก่อนบันทึก`);
    } catch (e) {
      setOcrMsg("อ่านรูปไม่สำเร็จ: " + (e as Error).message);
    } finally {
      setOcrBusy(false);
    }
  }, [onChange]);

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleOcr(file);
    e.target.value = "";
  };

  return (
    <div className="field">
      <label>ส่วนผสม (INCI)</label>
      <div className="ing-input-actions">
        <button type="button" className="btn-ghost btn-sm" onClick={pasteClipboard} title="วางจากคลิปบอร์ด">
          <PasteIcon /> วาง
        </button>
        <button type="button" className="btn-ghost btn-sm" onClick={() => setShowSearch((v) => !v)}>
          🔍 ค้นชื่อสินค้า
        </button>
        <button type="button" className="btn-ghost btn-sm" onClick={() => fileRef.current?.click()} disabled={ocrBusy}>
          📷 อ่านจากรูป
        </button>
        {value && (
          <button type="button" className="btn-ghost btn-sm" onClick={() => onChange("")}>
            <ClearIcon /> ล้าง
          </button>
        )}
        <input ref={fileRef} type="file" accept="image/*" capture="environment" hidden onChange={onFileChange} />
      </div>

      {showSearch && (
        <div className="ing-search-box">
          <input
            type="text"
            placeholder="พิมพ์ชื่อแบรนด์/สินค้า เช่น CeraVe, Ordinary Niacinamide..."
            value={searchQ}
            onChange={(e) => doSearch(e.target.value)}
            autoFocus
          />
          {results.length > 0 && (
            <div className="ing-search-results">
              {results.map((p, i) => (
                <button className="ing-search-row" key={i} onClick={() => pickProduct(p)}>
                  <strong>{p.brand}</strong> {p.name}
                  <span className="text-xs" style={{ color: "var(--muted)" }}>
                    {p.inci.split(",").length} ส่วนผสม
                  </span>
                </button>
              ))}
            </div>
          )}
          {searchQ.length >= 2 && results.length === 0 && (
            <div className="empty" style={{ padding: 8, fontSize: 12 }}>ไม่เจอในฐานข้อมูล — ลองวาง INCI เองหรือถ่ายรูปฉลาก</div>
          )}
        </div>
      )}

      {ocrMsg && <p className="sub text-xs">{ocrMsg}</p>}

      <textarea
        className="ingredients-textarea"
        placeholder="วางลิสต์ส่วนผสมจากฉลาก คั่นด้วยจุลภาค เช่น Water, Glycerin, Niacinamide 5%, Retinol..."
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
