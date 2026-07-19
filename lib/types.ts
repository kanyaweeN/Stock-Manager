export type ItemStatus = "" | "rebuy" | "avoid" | "have";

export interface StockItem {
  id: string;
  name: string;
  cat: string;
  qty: number;
  min: number;
  note: string;
  img?: string;
  link?: string;
  status?: ItemStatus;
  /** ที่มาของรายการ เช่น นำเข้าจาก Shopee — ใช้แสดงเป็น tag แยกจากหมวดหมู่จริง */
  source?: "shopee" | "";
}

export interface ImportCandidate {
  name: string;
  qty: number;
  img: string;
  link: string;
  cat: string;
  status: ItemStatus;
  include: boolean;
}
