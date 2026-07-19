import type { StockItem } from "@/lib/types";

export default function StatsBar({ items }: { items: StockItem[] }) {
  const cats = new Set(items.map((i) => i.cat).filter(Boolean));
  const total = items.reduce((s, i) => s + Number(i.qty || 0), 0);
  const low = items.filter((i) => i.min > 0 && i.qty <= i.min).length;

  return (
    <div className="stats">
      <div className="stat"><div className="n">{items.length}</div><div className="l">รายการทั้งหมด</div></div>
      <div className="stat"><div className="n">{total}</div><div className="l">จำนวนรวมทั้งหมด</div></div>
      <div className="stat"><div className="n">{low}</div><div className="l">ใกล้หมด</div></div>
      <div className="stat"><div className="n">{cats.size}</div><div className="l">หมวดหมู่</div></div>
    </div>
  );
}
