"use client";

interface Props {
  selectedCount: number;
  /** จำนวนที่ผ่านตัวกรองอยู่ตอนนี้ — "เลือกทั้งหมด" หมายถึงเฉพาะพวกนี้ ไม่ใช่ทั้งสต็อก */
  filteredCount: number;
  allFilteredSelected: boolean;
  onToggleSelectAll: () => void;
  onGroup: () => void;
  onMoveCats: () => void;
  onToggleFav: () => void;
  onAddToRecipe: () => void;
  onAddToPlan: () => void;
  onAddToForecast: () => void;
  onRemove: () => void;
  onCancel: () => void;
}

/** แถบคำสั่งของโหมดเลือกหลายอัน — ลอยอยู่ท้ายจอหน้าแรกตอน `selectMode` เปิด */
export default function SelectActionBar({
  selectedCount, filteredCount, allFilteredSelected,
  onToggleSelectAll, onGroup, onMoveCats, onToggleFav, onAddToRecipe, onAddToPlan, onAddToForecast, onRemove, onCancel,
}: Props) {
  return (
    <div className="select-action-bar">
      <span>เลือกไว้ {selectedCount} รายการ</span>
      <button className="btn-ghost" onClick={onToggleSelectAll}>
        {allFilteredSelected ? "ล้างที่เลือก" : `เลือกทั้งหมด (${filteredCount})`}
      </button>
      {/* จัดกลุ่มของชิ้นเดียวไม่มีความหมาย จึงต้องเลือกอย่างน้อย 2 ต่างจากปุ่มอื่นที่ 1 ก็พอ */}
      <button className="btn-primary" disabled={selectedCount < 2} onClick={onGroup}>👥 จัดกลุ่มที่เลือก</button>
      <button className="btn-ghost" disabled={selectedCount < 1} onClick={onMoveCats}>🏷️ จัดหมวดหมู่</button>
      <button className="btn-ghost" disabled={selectedCount < 1} onClick={onToggleFav}>⭐ ของโปรด</button>
      <button className="btn-ghost" disabled={selectedCount < 1} onClick={onAddToRecipe}>🧮 ใส่ในสูตรต้นทุน</button>
      <button className="btn-ghost" disabled={selectedCount < 1} onClick={onAddToPlan}>🛒 ใส่ในแผนซื้อของ</button>
      <button className="btn-ghost" disabled={selectedCount < 1} onClick={onAddToForecast}>🔮 ติดตามคาดคะเน</button>
      <button className="btn-danger" disabled={selectedCount < 1} onClick={onRemove}>🗑️ ลบที่เลือก</button>
      <button className="btn-ghost" onClick={onCancel}>ยกเลิก</button>
    </div>
  );
}
