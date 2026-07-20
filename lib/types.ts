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
  price?: number;
  size?: string;
  /** แท็กรอง เช่น ตัวเลือกสินค้า/รุ่น/สี ที่ดึงมาจากตอนนำเข้า */
  variant?: string;
}

export interface ImportCandidate {
  name: string;
  qty: number;
  img: string;
  link: string;
  cat: string;
  status: ItemStatus;
  include: boolean;
  price?: number;
  size?: string;
  variant?: string;
  /** id ของสินค้าที่มีอยู่แล้วในสต็อกที่ตรงกัน (เช็คจากชื่อ/ลิงก์) — ถ้ามีค่านี้แปลว่าอาจเป็นการซื้อซ้ำ */
  existingId?: string;
  /** ถ้าเป็นการซื้อซ้ำ ให้รวมจำนวนเข้ารายการเดิมแทนที่จะสร้างใหม่ (ค่าเริ่มต้น true เมื่อเจอรายการซ้ำ) */
  mergeExisting?: boolean;
}
