"use client";

interface Props {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: "text" | "number";
  placeholder?: string;
  list?: string;
  autoFocus?: boolean;
}

function CopyIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="9" width="12" height="12" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

function PasteIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
    </svg>
  );
}

function ClearIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M9.5 9.5l5 5M14.5 9.5l-5 5" />
    </svg>
  );
}

export default function TextField({ label, value, onChange, type = "text", placeholder, list, autoFocus }: Props) {
  const copy = () => {
    if (!value) return;
    navigator.clipboard.writeText(value).catch(() => {
      alert("คัดลอกไม่ได้ — เบราว์เซอร์ไม่อนุญาต ลองเลือกข้อความแล้วกด Ctrl+C แทน");
    });
  };
  const paste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      onChange(text);
    } catch {
      alert("วางจากคลิปบอร์ดไม่ได้ — เบราว์เซอร์ไม่อนุญาต ลองกด Ctrl+V ในช่องนี้แทน");
    }
  };
  const clear = () => onChange("");

  return (
    <div className="field">
      <label>{label}</label>
      <div className="field-with-actions">
        <input
          className="field-with-actions__input"
          autoFocus={autoFocus}
          type={type}
          placeholder={placeholder}
          list={list}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
        <div className="field-actions">
          <button type="button" className="field-actions__btn" title="คัดลอก" onClick={copy}><CopyIcon /></button>
          <button type="button" className="field-actions__btn" title="วาง" onClick={paste}><PasteIcon /></button>
          {value && (
            <button type="button" className="field-actions__btn" title="ล้าง" onClick={clear}><ClearIcon /></button>
          )}
        </div>
      </div>
    </div>
  );
}
