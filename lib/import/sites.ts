/**
 * ทะเบียน "ร้านที่นำเข้าได้" — ข้อมูลล้วนๆ ไม่มี DOM ไม่มี state
 *
 * ตัวแกะหน้าออเดอร์มี **สองแบบเท่านั้น** (ดู `lib/import/orderPage.ts`):
 * Shopee ใช้ตัวแกะเฉพาะของมัน (`lib/import/shopee.ts` — อาศัยโครง `<a>` ที่ครอบรูป+ชื่อ)
 * ส่วนร้านที่เหลือใช้ตัวแกะกลางที่ไล่หา "กล่องแถวสินค้า" จากรูปขึ้นไป
 * **เพิ่มร้านใหม่ = เพิ่ม 1 ก้อนในลิสต์นี้** ไม่ต้องแตะตัวแกะ (ถ้าโครงหน้าไม่ได้แปลกไปจากนี้)
 *
 * ป้ายภาษาไทยทั้งหมดเป็น best-effort — ผู้ใช้ตรวจและแก้ตัวเลขเองได้ในหน้ารีวิวก่อนนำเข้าจริง
 */
import type { SellerHints, ShopLookup } from "@/lib/import/dom";
import type { ChargeLabels, DateFormat } from "@/lib/import/text";
import type { ImportCandidate, ImportSource } from "@/lib/types";

export interface ImportSite {
  id: ImportSource;
  label: string;
  /** ใช้แปลงลิงก์/รูปแบบ relative ให้เป็น absolute URL */
  baseUrl: string;
  /**
   * ร้านที่ขายเอง (Watsons/Konvy) — ทุกแถวได้ชื่อร้านนี้เลย
   * มาร์เก็ตเพลส (Shopee/Lazada) ปล่อยว่างไว้เพราะหน้าเดียวมีของจากหลายร้าน ต้องแกะเอาจากหน้า
   */
  fixedShop?: string;
  /**
   * ราคาที่หน้านั้นโชว์เป็น**ยอดรวมทั้งแถว** (ต้องหารด้วยจำนวนก่อนลงสต็อกที่เก็บราคาต่อชิ้น)
   * เป็นแค่ค่าเริ่มต้นของสวิตช์ในหน้ารีวิว — ระบบจะเดาใหม่ให้ถ้าหน้านั้นมี "รวมค่าสินค้า" ให้เทียบ
   */
  priceIsLineTotal: boolean;
  dateFormats: DateFormat[];
  charges: ChargeLabels;
  /** วิธีหาว่าแถวนี้มาจากร้านไหน (เฉพาะมาร์เก็ตเพลสที่ไม่มี `fixedShop`) — ดู `buildShopLookup` */
  seller?: SellerHints;
  /** คำอธิบายวิธีคัดลอก HTML ของร้านนี้ (โชว์ในหน้าแรกของกล่องนำเข้า) */
  hint: string;
}

const SHIP = String.raw`ค่า(?:จัดส่ง|ขนส่ง|ส่ง)`;
/**
 * คำที่นำหน้าค่าส่งแล้วแปลว่าบรรทัดนั้นคือ **ส่วนลด** ของค่าส่ง ไม่ใช่ค่าส่งที่ต้องจ่าย
 * (Lazada เรียกส่วนลดค่าส่งว่า "โปรโมชั่นค่าจัดส่ง" ไม่ใช่ "ส่วนลดค่าจัดส่ง" — ขาดคำนี้ไปเมื่อไร
 * ยอดส่วนลดจะถูกบวกเข้าไปเป็นค่าส่งที่จ่ายจริงแบบเงียบๆ เพราะป้ายมันมีคำว่า "ค่าจัดส่ง" อยู่ข้างใน)
 */
const CUT = String.raw`ส่วนลด|โปรโมชั่น`;
/** ค่าส่งเต็ม — ต้องไม่ไปคาบกับบรรทัดส่วนลดค่าส่งที่มีคำว่า "ค่าจัดส่ง" อยู่ข้างในเหมือนกัน */
const SHIPPING = String.raw`(?<!ส่วนลด)(?<!โปรโมชั่น)${SHIP}`;
/** ป้ายส่วนลดค่าส่งที่ทุกร้านใช้เหมือนกัน — ต้องหักออกจากค่าส่งเต็ม ไม่ใช่ไปรวมกับส่วนลดสินค้า */
const SHIP_DISCOUNT = [String.raw`(?:${CUT})${SHIP}`, "ค่าส่งฟรี", "free\\s?shipping"];
/**
 * ส่วนลดทั่วไป — ต้องกันไม่ให้ไปคาบกับส่วนลดค่าส่งที่มีคำเดียวกันอยู่ข้างใน (ไม่งั้นนับซ้ำ)
 * "ส่วนลด" กับ "โปรโมชั่น" ต้องอยู่ **ป้ายเดียวกัน** ไม่ใช่แยกเป็นสองป้ายในลิสต์ เพราะ `labelMoney`
 * ใช้ป้ายแรกที่เจอแล้วหยุด — หน้าที่มีทั้งสองคำ (Lazada) จะนับได้แค่ก้อนเดียว
 */
const DISCOUNT = [String.raw`(?:${CUT})(?!${SHIP})`, "โค้ดส่วนลด", "คูปอง", "voucher"];

export const IMPORT_SITES: ImportSite[] = [
  {
    id: "shopee",
    label: "Shopee",
    baseUrl: "https://shopee.co.th/",
    // Shopee โชว์ราคาเป็นยอดรวมทั้งแถว (สั่ง x3 โชว์ ฿54 แล้ว "รวมค่าสินค้า" ก็ ฿54 = ชิ้นละ ฿18)
    priceIsLineTotal: true,
    dateFormats: ["datetime"],
    charges: {
      subtotal: ["รวมค่าสินค้า"],
      shipping: [SHIPPING],
      shipDiscount: SHIP_DISCOUNT,
      discount: DISCOUNT,
      total: ["ยอดรวมทั้งหมด", "ยอดชำระเงินทั้งหมด", "รวมการสั่งซื้อ"],
    },
    seller: {
      marker: /^(ดูร้านค้า|ดูร้าน|view shop)$/i,
      badge: /^(preferred\+?|mall|shopee mall|ร้านค้าแนะนำ|แชท|แชทเลย|พูดคุย|chat|ติดตาม|ร้านแนะนำ)$/i,
    },
    hint: 'เปิดหน้า "คำสั่งซื้อของฉัน" ใน Shopee กด Ctrl+U หรือคลิกขวา > "ดูซอร์สหน้าเว็บ" (View Page Source) แล้วคัดลอกโค้ด HTML ทั้งหมดมาวาง',
  },
  {
    id: "lazada",
    label: "Lazada",
    baseUrl: "https://www.lazada.co.th/",
    // Lazada โชว์ราคาต่อชิ้นคู่กับ "x1" อยู่แล้ว
    priceIsLineTotal: false,
    dateFormats: ["thai", "english", "dmy", "iso"],
    charges: {
      // หน้ารายละเอียดออเดอร์เรียกยอดสินค้าล้วนว่า "ยอดรวม" เฉยๆ — ต้องกันไม่ให้ชนยอดอื่นที่ขึ้นต้นเหมือนกัน
      subtotal: ["ยอดรวมย่อย", "รวมค่าสินค้า", "ราคาสินค้า", "subtotal", "ยอดรวม(?!ทั้งสิ้น|ทั้งหมด|สุทธิ|ส่วนลด)"],
      shipping: [SHIPPING, "shipping fee"],
      shipDiscount: SHIP_DISCOUNT,
      discount: DISCOUNT,
      total: ["ยอดรวมทั้งหมด", "ยอดรวมสุทธิ", "รวมทั้งสิ้น", "ยอดชำระ(?:เงิน)?", "grand total"],
    },
    seller: {
      inline: /^(?:ขายโดย|จำหน่ายโดย|ผู้ขาย|sold by|seller)\s*[:：]?\s*(.*)$/i,
      // หน้ารายละเอียดออเดอร์ไม่มีปุ่ม "ดูร้านค้า" มีแต่ปุ่มแชทที่อยู่ถัดจากชื่อร้านเสมอ — ใช้เป็นหมุดแทนได้
      marker: /^(ดูร้านค้า|ดูร้าน|เยี่ยมชมร้านค้า|view shop|visit store|แชทเลย|แชท|chat)$/i,
      badge: /^(lazmall|mall|ติดตาม|follow|ร้านแนะนำ)$/i,
    },
    hint: 'เปิดหน้า "คำสั่งซื้อของฉัน" (My Orders) ใน Lazada กด Ctrl+U แล้วคัดลอกโค้ด HTML ทั้งหมดมาวาง — หน้ารายละเอียดออเดอร์จะได้ค่าส่ง/ส่วนลดครบกว่าหน้ารวม',
  },
  {
    id: "watsons",
    label: "Watsons",
    baseUrl: "https://www.watsons.co.th/",
    fixedShop: "Watsons",
    priceIsLineTotal: false,
    dateFormats: ["thai", "english", "dmy", "iso"],
    charges: {
      subtotal: ["ยอดรวมย่อย", "ราคารวมสินค้า", "มูลค่าสินค้า", "รวมค่าสินค้า", "subtotal"],
      shipping: [SHIPPING, "delivery (?:fee|charge)"],
      shipDiscount: SHIP_DISCOUNT,
      discount: DISCOUNT,
      total: ["ยอดสุทธิ", "ยอดรวมสุทธิ", "รวมทั้งสิ้น", "ยอดชำระ(?:เงิน)?", "total"],
    },
    hint: 'เข้าบัญชี Watsons > "คำสั่งซื้อของฉัน" เปิดออเดอร์ที่ต้องการ กด Ctrl+U แล้วคัดลอกโค้ด HTML ทั้งหมดมาวาง (ร้านค้าจะถูกตั้งเป็น Watsons ให้อัตโนมัติ)',
  },
  {
    id: "konvy",
    label: "Konvy",
    baseUrl: "https://www.konvy.com/",
    fixedShop: "Konvy",
    // หน้ารายละเอียดออเดอร์เป็นตาราง คอลัมน์สุดท้าย "ราคารวม" = ยอดรวมทั้งแถว (คอลัมน์ "ราคา" คือต่อชิ้น)
    priceIsLineTotal: true,
    dateFormats: ["thai", "dmy", "iso", "english"],
    charges: {
      subtotal: ["จำนวนเงินรวม", "ราคาสินค้า", "ยอดรวมสินค้า", "ยอดรวมย่อย", "มูลค่าสินค้า", "รวมเป็นเงิน"],
      // "ค่าพัสดุ" คือชื่อที่หน้ารายละเอียดออเดอร์ใช้เรียกค่าส่ง
      shipping: [SHIPPING, "ค่าพัสดุ"],
      shipDiscount: SHIP_DISCOUNT,
      discount: DISCOUNT,
      total: ["ยอดที่ต้องชำระ", "ยอดสุทธิ", "ยอดรวมสุทธิ", "รวมทั้งสิ้น", "ยอดชำระ(?:เงิน)?"],
    },
    hint: 'เข้าบัญชี Konvy > "ประวัติการสั่งซื้อ" เปิดออเดอร์ที่ต้องการ กด Ctrl+U แล้วคัดลอกโค้ด HTML ทั้งหมดมาวาง (ร้านค้าจะถูกตั้งเป็น Konvy ให้อัตโนมัติ)',
  },
];

export const DEFAULT_IMPORT_SOURCE: ImportSource = "shopee";

export function importSite(id: ImportSource): ImportSite {
  return IMPORT_SITES.find((s) => s.id === id) ?? IMPORT_SITES[0];
}

/** ชื่อที่เอาไปโชว์เป็นป้ายบนการ์ดสินค้า */
export function sourceLabel(id: string | undefined): string | undefined {
  return IMPORT_SITES.find((s) => s.id === id)?.label;
}

/**
 * ของที่ตัวแกะของทุกร้านได้มาเหมือนกันตั้งแต่ก่อนเริ่มไล่แถว — `extractOrderPage` เตรียมให้ครั้งเดียว
 * แล้วส่งต่อให้ตัวแกะของร้านนั้น (ดู `lib/import/orderPage.ts`)
 */
export interface OrderRowContext {
  site: ImportSite;
  /** วันสั่งซื้อของทั้งหน้า — ทุกแถวในหน้าเดียวกันใช้วันเดียวกัน */
  orderDate?: string;
  shop: ShopLookup;
}

/** ผลการแกะหน้าออเดอร์ 1 หน้า (ร้านไหนก็รูปแบบนี้) */
export interface OrderPageData {
  items: ImportCandidate[];
  /** ยอด "รวมค่าสินค้า" บนหน้า — ใช้เทียบกับผลรวมที่แกะได้ (undefined = หน้านั้นไม่มีให้เทียบ) */
  goodsSubtotal?: number;
  /** ค่าส่งที่จ่ายจริงทั้งหน้า (หักส่วนลดค่าส่งแล้ว) */
  shipping?: number;
  /** ส่วนลด/โค้ดระดับออเดอร์ทั้งหน้า (เลขบวก) */
  discount?: number;
  /** ยอดชำระทั้งหมดตามที่หน้าออเดอร์บอก — ใช้เทียบว่าค่าส่ง/ส่วนลดที่แกะได้ครบไหม */
  grandTotal?: number;
}
