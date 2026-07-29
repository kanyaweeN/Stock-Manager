export type ItemStatus = "" | "rebuy" | "avoid" | "have";

export interface StockItem {
  id: string;
  name: string;
  cats: string[];
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
  /** จัดกลุ่มสินค้าหลายชิ้นที่เป็น "ตัวเดียวกัน" เข้าด้วยกันแบบไม่ลบทิ้ง (เช่น ซื้อจากคนละร้าน) — สินค้าที่ groupId เดียวกันถือว่าอยู่กลุ่มเดียวกัน */
  groupId?: string;
  groupName?: string;
  /** วันที่ซื้อ (YYYY-MM-DD) — ใช้ทำสรุปยอดรายเดือน ของเก่าก่อนมีฟีลด์นี้จะไม่มีค่า (ไม่ทราบวันที่) */
  purchasedAt?: string;
}

export interface ImportCandidate {
  name: string;
  qty: number;
  img: string;
  link: string;
  cats: string[];
  status: ItemStatus;
  include: boolean;
  price?: number;
  size?: string;
  variant?: string;
  note?: string;
  /** id ของสินค้าที่มีอยู่แล้วในสต็อกที่ตรงกัน (เช็คจากชื่อ/ลิงก์) — ถ้ามีค่านี้แปลว่าอาจเป็นการซื้อซ้ำ */
  existingId?: string;
  /** ถ้าเป็นการซื้อซ้ำ ให้รวมจำนวนเข้ารายการเดิมแทนที่จะสร้างใหม่ (ค่าเริ่มต้น true เมื่อเจอรายการซ้ำ) */
  mergeExisting?: boolean;
  /** ตอนซื้อซ้ำ เลือกได้ว่าจะเอาค่าใหม่มาอัปเดตฟิลด์ไหนบ้าง (ค่าเริ่มต้น: อัปเดตทุกฟิลด์ที่มีค่าใหม่) */
  mergeFields?: Partial<Record<"qty" | "price" | "img" | "variant" | "size" | "note" | "status", boolean>>;
}
