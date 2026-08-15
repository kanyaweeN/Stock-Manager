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
  /**
   * วันเวลาที่เพิ่มเข้าสต็อก (ISO) — ใช้เรียง "เพิ่มล่าสุด" ไม่เปลี่ยนตอนแก้ไข/ซื้อซ้ำ
   * ของเก่าถูก backfill จาก `purchasedAt` ตอน migrate v5 ตัวที่ไม่รู้วันจะเป็นค่าว่าง แล้วตกไปใช้ลำดับใน `items` แทน
   */
  createdAt?: string;
  /** ลิสต์ส่วนผสมดิบตามฉลาก (INCI) เก็บเป็นข้อความก้อนเดียว — แยก/วิเคราะห์ตอนใช้งานด้วย lib/ingredients.ts */
  ingredients?: string;
}

/** วัตถุดิบ 1 บรรทัดในสูตรต้นทุน — ต้นทุนบรรทัด = ราคาที่ซื้อ ÷ ปริมาณต่อแพ็ค × ปริมาณที่ใช้ */
export interface RecipeLine {
  id: string;
  /** ผูกกับสินค้าในสต็อก (ถ้าเลือกมาจากสต็อก) — ว่างได้ถ้าเป็นวัตถุดิบที่กรอกเอง */
  itemId?: string;
  name: string;
  /** ราคาที่ซื้อมา ต่อ 1 แพ็ค/ขวด/ชิ้น */
  buyPrice: number;
  /** ปริมาณที่ได้ต่อ 1 แพ็ค เช่น ซื้อ 1 ถุงได้ 1000 (กรัม) — ของที่นับเป็นชิ้นให้ใส่ 1 */
  packAmount: number;
  /** หน่วยของ packAmount/usedAmount เช่น g, ml, ชิ้น */
  unit: string;
  /** ปริมาณที่ใช้จริงในสูตรนี้ (หน่วยเดียวกับ unit) */
  usedAmount: number;
}

/** สูตรการผลิต 1 รอบ ใช้คำนวณต้นทุนต่อชิ้น */
export interface Recipe {
  id: string;
  name: string;
  note: string;
  lines: RecipeLine[];
  /** ทำ 1 รอบได้กี่ชิ้น */
  yieldQty: number;
  yieldUnit: string;
  /** ค่าแรงต่อรอบ */
  laborCost: number;
  /** ค่าใช้จ่ายอื่นต่อรอบ เช่น บรรจุภัณฑ์ ค่าไฟ ค่าส่ง */
  otherCost: number;
  /** ราคาขายต่อชิ้น (ถ้ากรอกจะคำนวณกำไรให้) */
  sellPrice?: number;
  updatedAt?: string;
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
  ingredients?: string;
  /** id ของสินค้าที่มีอยู่แล้วในสต็อกที่ตรงกัน (เช็คจากชื่อ/ลิงก์) — ถ้ามีค่านี้แปลว่าอาจเป็นการซื้อซ้ำ */
  existingId?: string;
  /** ถ้าเป็นการซื้อซ้ำ ให้รวมจำนวนเข้ารายการเดิมแทนที่จะสร้างใหม่ (ค่าเริ่มต้น true เมื่อเจอรายการซ้ำ) */
  mergeExisting?: boolean;
  /** ตอนซื้อซ้ำ เลือกได้ว่าจะเอาค่าใหม่มาอัปเดตฟิลด์ไหนบ้าง (ค่าเริ่มต้น: อัปเดตทุกฟิลด์ที่มีค่าใหม่) */
  mergeFields?: Partial<Record<"qty" | "price" | "img" | "variant" | "size" | "note" | "status" | "ingredients", boolean>>;
}
