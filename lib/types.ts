export type ItemStatus = "" | "rebuy" | "avoid" | "have";

/** ราคาที่ซื้อได้ 1 ครั้ง — เก็บต่อกันเป็นประวัติเพื่อดูราคาขึ้น/ลง และหาราคาเฉลี่ย (ดู lib/price.ts) */
export interface PricePoint {
  /** วันที่ซื้อ (YYYY-MM-DD) — ว่างได้ถ้าไม่ทราบ (ข้อมูลเก่าที่ backfill มา) */
  date: string;
  /** ราคา **ต่อ 1 แพ็ค/ชิ้น** ณ ครั้งนั้น */
  price: number;
  /** ซื้อกี่แพ็คในครั้งนั้น — ใช้ถ่วงน้ำหนักตอนหาค่าเฉลี่ย (จ่ายจริงครั้งนั้น = price × qty) */
  qty: number;
}

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
  /** ราคา **ต่อ 1 แพ็ค/ชิ้น** (ไม่ใช่ยอดรวมที่จ่าย) — ยอดจ่ายจริง = price × buyQty */
  price?: number;
  /** ซื้อมากี่แพ็คในครั้งล่าสุด — ใช้โชว์ยอดที่จ่ายจริงเฉยๆ ไม่มีผลกับต้นทุนต่อหน่วยใน /cost */
  buyQty?: number;
  /**
   * `price` ของรายการนี้อาจเป็น "ยอดรวมทั้งแถว" ไม่ใช่ราคาต่อชิ้น — ติดให้ตอน migrate v6
   * กับของที่นำเข้าจาก Shopee ก่อนเวอร์ชันที่แก้เรื่องนี้ (ดู lib/shopee.ts) ย้อนหารเองไม่ได้
   * เพราะ `qty` ถูกเพิ่ม/ลดไปหลังจากนั้นแล้ว จึงต้องเตือนให้ผู้ใช้ตรวจเอง
   * เคลียร์ทิ้งเมื่อผู้ใช้กดบันทึกใน ProductModal หรือเมื่อนำเข้าซ้ำแล้วราคาถูกอัปเดต
   */
  priceUnverified?: boolean;
  /** ประวัติราคาทุกครั้งที่ซื้อ เรียงจากเก่าไปใหม่ — เพิ่มอัตโนมัติตอนนำเข้าจาก Shopee (ดู lib/price.ts) */
  priceHistory?: PricePoint[];
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

/** วิธีปัดราคาขายให้สวย — ตัวเลข = ปัดขึ้นทีละเท่านั้นบาท, "9" = ดันไปเลขลงท้าย 9 */
export type PriceRounding = "none" | "1" | "5" | "9" | "10";

/**
 * ตั้งค่าการคิดราคาขาย — ใช้ร่วมกันทุกสูตร (เก็บที่ `StockDB.pricing`) เพราะค่าธรรมเนียม
 * ของร้าน/แพลตฟอร์มกับกำไรที่อยากได้มักเป็นค่าเดียวกันทั้งร้าน ไม่ได้ตั้งใหม่ทีละสูตร
 */
export interface PricingSettings {
  /** กำไรที่อยากได้ คิดเป็น % **ของราคาขาย** (ไม่ใช่ % ของต้นทุน — ดู lib/pricing.ts) */
  targetMarginPct: number;
  /** ค่าธรรมเนียมที่โดนหักเป็น % ของราคาขาย เช่น ค่าคอมฯ มาร์เก็ตเพลส */
  feePct: number;
  /** ค่าใช้จ่ายต่อชิ้นแบบคงที่ที่ยังไม่ได้อยู่ในสูตร เช่น ค่ากล่อง/ค่าส่งที่ออกเอง */
  feePerUnit: number;
  rounding: PriceRounding;
}

/** ของ 1 อย่างในแผนซื้อ — ยอดของบรรทัด = ราคาต่อชิ้น × จำนวนที่จะซื้อ */
export interface PlanLine {
  id: string;
  /** ผูกกับสินค้าในสต็อก (ถ้าเลือกมาจากสต็อก) — ว่างได้ถ้าเป็นของที่ยังไม่เคยมี */
  itemId?: string;
  name: string;
  /** จะซื้อกี่ชิ้น/แพ็ค */
  qty: number;
  /** ราคาต่อ 1 ชิ้น/แพ็ค ที่ตั้งงบไว้ — เดาให้จากราคาล่าสุดในสต็อกตอนเลือกสินค้า */
  price: number;
  note: string;
  /** ซื้อไปแล้วหรือยัง */
  bought: boolean;
  /** วันที่ซื้อจริง (YYYY-MM-DD) — เซ็ตให้อัตโนมัติตอนติ๊กว่าซื้อแล้ว */
  boughtAt?: string;
  /** ราคาที่จ่ายจริงต่อชิ้น (ถ้าไม่กรอก = จ่ายตามราคาที่ตั้งงบไว้) */
  paidPrice?: number;
}

/** แผนซื้อของ 1 รอบ เช่น "ของใช้เดือนหน้า" หรือ "ของปีใหม่" */
export interface PurchasePlan {
  id: string;
  name: string;
  note: string;
  /** กำหนดซื้อให้เสร็จภายในวันที่ (YYYY-MM-DD) — ว่างได้ถ้าไม่กำหนดเวลา */
  dueDate?: string;
  /** งบที่ตั้งไว้ทั้งแผน (ไม่กรอกก็ได้) */
  budget?: number;
  lines: PlanLine[];
  /** วันเวลาที่สร้างแผน (ISO) — ใช้เทียบว่าของที่นำเข้าหลังจากนี้น่าจะเป็นของในแผนที่ซื้อไปแล้ว */
  createdAt?: string;
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
  /** ราคา **ต่อ 1 แพ็ค/ชิ้น** (= lineTotal ÷ qty) — เป็นค่าที่เอาไปลงสต็อกจริง */
  price?: number;
  /** ยอดรวมทั้งแถวที่ Shopee โชว์ (ราคาต่อชิ้น × จำนวน) — เก็บไว้ให้ผู้ใช้ตรวจทานและสลับโหมดราคาได้ */
  lineTotal?: number;
  /** วันที่สั่งซื้อจริงที่แกะจากหน้าออเดอร์ (YYYY-MM-DD) — ไม่มีก็ใช้วันที่นำเข้าแทน */
  purchasedAt?: string;
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
