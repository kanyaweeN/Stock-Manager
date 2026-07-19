import type { StockItem } from "@/lib/types";
import { STATUS_LABELS } from "@/lib/statusOptions";

interface Props {
  items: StockItem[];
  onInc: (id: string) => void;
  onDec: (id: string) => void;
  onEdit: (item: StockItem) => void;
  onDelete: (item: StockItem) => void;
}

export default function ProductGrid({ items, onInc, onDec, onEdit, onDelete }: Props) {
  if (items.length === 0) {
    return <div className="empty">ยังไม่มีสินค้าในสต็อก — กด &quot;เพิ่มสินค้า&quot; เพื่อเริ่มต้น</div>;
  }

  return (
    <div className="product-grid">
      {items.map((i) => {
        const low = i.min > 0 && i.qty <= i.min;
        return (
          <div className={`product-card ${low ? "low-row" : ""}`} key={i.id}>
            <div className="product-card__img-wrap">
              {i.img ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  className="product-card__img"
                  src={i.img}
                  alt=""
                  onError={(e) => { (e.currentTarget as HTMLImageElement).style.visibility = "hidden"; }}
                />
              ) : (
                <div className="product-card__img-placeholder">📦</div>
              )}
              {low && <span className="badge-low product-card__low-badge">ใกล้หมด</span>}
              {i.status && (
                <span className={`status-badge status-${i.status} product-card__status-badge`}>
                  {STATUS_LABELS[i.status]}
                </span>
              )}
            </div>

            <div className="product-card__body">
              <div className="product-card__title">
                {i.name}
                {i.link && (
                  <a className="link-icon" href={i.link} target="_blank" rel="noopener noreferrer" title="เปิดลิงก์สินค้า">
                    🔗
                  </a>
                )}
              </div>
              <div className="product-card__meta">
                {i.cat || "ไม่มีหมวดหมู่"}
                {i.source === "shopee" && <span className="source-tag">Shopee</span>}
              </div>
              {i.note && <div className="product-card__note">{i.note}</div>}

              <div className="product-card__footer">
                <div className="qty">
                  <button className="qty-btn" onClick={() => onDec(i.id)}>−</button>
                  <span> {i.qty} </span>
                  <button className="qty-btn" onClick={() => onInc(i.id)}>+</button>
                  {i.min > 0 && <span className="product-card__min">ขั้นต่ำ {i.min}</span>}
                </div>
                <div className="product-card__actions">
                  <button className="icon-btn" title="แก้ไข" onClick={() => onEdit(i)}>✏️</button>
                  <button className="icon-btn del" title="ลบ" onClick={() => onDelete(i)}>🗑️</button>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
