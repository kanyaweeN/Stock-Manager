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
          autoFocus={autoFocus}
          type={type}
          placeholder={placeholder}
          list={list}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
        <div className="field-actions">
          <button type="button" className="icon-btn" title="คัดลอก" onClick={copy}>📋</button>
          <button type="button" className="icon-btn" title="วาง" onClick={paste}>📥</button>
          <button type="button" className="icon-btn" title="ล้าง" onClick={clear}>✖️</button>
        </div>
      </div>
    </div>
  );
}
