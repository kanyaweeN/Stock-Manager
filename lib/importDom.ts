/**
 * เครื่องมือเดินโครงสร้าง HTML ที่ตัวแกะหน้าออเดอร์ทุกร้านใช้ร่วมกัน
 *
 * แยกจาก `lib/importText.ts` (ข้อความล้วน เทสต์ได้) เพราะไฟล์นี้ต้องมี DOM จริง —
 * ตั้งใจไม่ลง jsdom เพิ่ม พิสูจน์ด้วยการวาง HTML จริงในกล่องนำเข้าคุ้มกว่า
 */
import { isLabelOnly, parsePriceLeaf, parseQtyLeaf } from "./importText";


/** รูปที่ไม่ใช่รูปสินค้า (ไอคอน/โลโก้/แบนเนอร์) */
const SKIP_HINTS = /icon|logo|sprite|avatar|badge|banner|placeholder|profile|qr[_-]?code/i;

/** ป้าย UI ที่ไม่ใช่ข้อมูลสินค้า แต่ดันอยู่ในกล่องเดียวกับสินค้า — ต้องกรองทิ้งไม่งั้นหลุดไปเป็นชื่อ/ตัวเลือกสินค้าผิดๆ */
export const NOISE_TEXT =
  /^(เรตติ้งร้าน|ดูร้านค้า|ดูร้าน|ดูเพิ่มเติม|ดูเพิ่มเติมเกี่ยวกับสินค้า|ร้านค้ามาใหม่|ต้องการสินค้าเพิ่มไหม|ซื้ออีกครั้ง|ซื้อซ้ำ|ให้คะแนน|รีวิวสินค้า|ติดต่อผู้ขาย|แชทเลย|chat|buy again|view shop|เขียนรีวิว|ยกเลิก|[0-9]+ *days? *return|.{0,24}(?:มีการรับประกัน|ไม่มีการประกัน))$/i;

/** ออเดอร์ที่ถูกคืนเงิน/ยกเลิกแล้ว ไม่ควรนำเข้ามาเป็นสต็อกจริง (ของไม่ได้อยู่กับเราแล้ว) */
export const REFUND_BADGE =
  /^(คืนเงิน\s*\/\s*คืนสินค้า|คืนเงินแล้ว|คืนสินค้าแล้ว|ขอคืนเงิน|ยกเลิกแล้ว|คำสั่งซื้อถูกยกเลิก|refunded|returned|cancell?ed)$/i;

/**
 * บล็อก "สินค้าแนะนำ / คนอื่นก็ดูสินค้านี้" ท้ายหน้าออเดอร์ — การ์ดพวกนี้มีครบทั้งรูป ชื่อ และราคา
 * เลยผ่านทุกด่านของตัวแกะแล้วหลุดเข้าไปเป็นสินค้าที่ "ซื้อมา" (Lazada แถมมาทีละ 50 ใบต่อหน้า)
 *
 * ยอมดูชื่อ class/id ตรงนี้ที่เดียว เพราะไม่มีสัญญาณเชิงโครงสร้างอะไรแยกมันออกจากแถวสินค้าจริงได้เลย
 * และถ้าร้านเปลี่ยนชื่อ class ตัวกรองก็แค่ **ไม่ทำงาน** (กลับไปเท่าเดิม) ไม่ใช่ทำให้แกะพัง
 */
const AD_BLOCK = /recomm[ae]nd|just4u|justforyou|related|similar|sponsor|suggest|also[-_]?(?:like|bought|view)|you[-_]?may/i;

/** อยู่ในบล็อกสินค้าแนะนำ/โฆษณาไหม — ไล่ดูตัวเองขึ้นไปจนถึง body */
export function inAdBlock(el: Element): boolean {
  for (let node: Element | null = el; node && node.tagName !== "BODY"; node = node.parentElement) {
    const attrs = [
      node.getAttribute("class"),
      node.getAttribute("id"),
      node.getAttribute("data-spm"),
    ].join(" ");
    if (AD_BLOCK.test(attrs)) return true;
  }
  return false;
}

export function getImgSrc(img: HTMLImageElement): string {
  const srcset = img.getAttribute("srcset") || img.getAttribute("data-srcset") || "";
  const fromSrcset = srcset.split(",")[0]?.trim().split(/\s+/)[0] || "";
  return (
    img.getAttribute("src") ||
    img.getAttribute("data-src") ||
    img.getAttribute("data-original") ||
    img.getAttribute("data-lazy-src") ||
    fromSrcset ||
    ""
  );
}

export function isProductImg(img: HTMLImageElement): boolean {
  const src = getImgSrc(img);
  const alt = img.getAttribute("alt") || "";
  if (!src || /^data:/.test(src) || SKIP_HINTS.test(src) || SKIP_HINTS.test(alt)) return false;
  const w = parseInt(img.getAttribute("width") || "0", 10);
  const h = parseInt(img.getAttribute("height") || "0", 10);
  if ((w && w < 40) || (h && h < 40)) return false;
  return true;
}

/** แปลงเป็น absolute URL — คืนค่าดิบถ้าแปลงไม่ได้ ดีกว่าทิ้งลิงก์ไปเฉยๆ */
export function absUrl(raw: string, baseUrl: string): string {
  if (!raw) return "";
  try {
    return new URL(raw, baseUrl).href;
  } catch {
    return raw;
  }
}

/** element ที่อาจถือข้อความไว้ 1 ก้อน — หน่วยเล็กสุดที่เชื่อว่า "ข้อความนี้เป็นก้อนเดียวกัน" */
const LEAF_SEL = "span, div, a, h1, h2, h3, strong, b, p, td, li";

const TEXT_NODE = 3;
const ELEMENT_NODE = 1;

/**
 * แท็กที่เป็นแค่ **การตกแต่งข้อความก้อนเดิม** ไม่ใช่ข้อความคนละก้อน
 *
 * Konvy เขียนราคาว่า `<div><b class="money">฿</b>390</div>` — ถ้านับ `<b>` เป็นก้อนแยก
 * กล่องราคาจะไม่ใช่ "ใบสุดท้าย" อีกต่อไป เลย**ไม่มีก้อนไหนอ่านเป็นราคาได้เลยทั้งแถว**
 * แล้วทั้งหน้าถูกทิ้งเงียบๆ (ตัวแกะใช้ "ต้องมีราคา" เป็นด่านคัดว่าแถวไหนคือสินค้า)
 *
 * `span`/`a` **ห้ามอยู่ในนี้** เพราะร้านอื่นใช้ห่อค่าคนละค่าไว้ข้างกัน ("ชื่อสินค้า<span>x1</span>")
 */
const INLINE_TAGS = new Set([
  "B", "STRONG", "I", "EM", "U", "S", "SMALL", "SUP", "SUB", "MARK", "INS", "DEL", "ABBR", "FONT", "BR", "WBR",
]);

/** ข้อความ "ของ element นี้เอง" = text node ตรงๆ + แท็กตกแต่งที่ห่อไว้ (ไม่รวมกล่องลูกที่เป็นคนละก้อน) */
function ownText(el: Element): string {
  let out = "";
  for (const node of el.childNodes) {
    if (node.nodeType === TEXT_NODE) out += node.nodeValue || "";
    else if (node.nodeType === ELEMENT_NODE && INLINE_TAGS.has((node as Element).tagName)) out += node.textContent || "";
  }
  return out.replace(/\s+/g, " ").trim();
}

/**
 * ข้อความทุกก้อนใน `root` — กล่องที่มีทั้งข้อความของตัวเองและกล่องลูก จะได้เฉพาะส่วนของตัวเอง
 * ก้อนเดียวกันจึงไม่ถูกอ่านซ้ำจากทั้งพ่อและลูก (สำคัญมากกับราคา ไม่งั้นยอดจะซ้อนกันเงียบๆ)
 */
export function leafTexts(root: Element | Document): { el: Element; text: string }[] {
  const out: { el: Element; text: string }[] = [];
  for (const el of root.querySelectorAll(LEAF_SEL)) {
    const text = ownText(el);
    if (!text) continue;
    out.push({ el, text });
  }
  return out;
}

export interface SellerHints {
  /** ป้ายที่มีชื่อร้านอยู่ในบรรทัดเดียวกัน เช่น "ขายโดย ร้านเอ" — กลุ่ม 1 คือชื่อร้าน (ว่างได้ = ชื่ออยู่บรรทัดถัดไป) */
  inline?: RegExp;
  /** ปุ่มที่อยู่ "หลัง" ชื่อร้านเสมอในหัวการ์ดออเดอร์ — ใช้เป็นหมุดไล่ย้อนขึ้นไปหาชื่อ */
  marker?: RegExp;
  /** ป้ายที่ติดอยู่กับชื่อร้านแต่ไม่ใช่ชื่อร้าน — ต้องข้ามตอนไล่ย้อน */
  badge?: RegExp;
}

/** ไล่ย้อนขึ้นไปหาชื่อร้านได้ไกลสุดกี่ leaf ก่อนถึงหมุด (เผื่อมีป้าย Preferred/Mall/LazMall คั่น) */
const SHOP_LOOKBACK = 6;

/** DOM constant — node อยู่ "หลัง" ตัวที่เทียบ (รวมถึงกรณีเป็นลูกของมัน) */
const FOLLOWING = 4;

export interface ShopLookup {
  /** ชื่อร้านของแถวสินค้าที่อยู่ตรงตำแหน่งของ node นี้ (undefined = หาไม่เจอ ให้ผู้ใช้กรอกเอง) */
  shopOf: (node: Element) => string | undefined;
  /**
   * element ของ "หัวการ์ดออเดอร์" (บรรทัดชื่อร้าน) ที่เจอทั้งหน้า
   * `rowContainerFor` ต้องรู้ไว้เพื่อ**ไม่ไต่ขึ้นไปจนคลุมหัวการ์ด** ไม่งั้นชื่อร้านจะหลุดไปเป็นชื่อสินค้า
   */
  headers: Element[];
}

/**
 * หาว่าสินค้าแต่ละแถวมาจากร้านไหน — **best-effort** เพราะมาร์เก็ตเพลสสุ่มชื่อ class
 *
 * อาศัยลำดับใน DOM แทนโครงสร้าง: หัวการ์ดออเดอร์คือ `[ป้าย] ชื่อร้าน [แชท] [ดูร้านค้า]`
 * (หรือบรรทัด "ขายโดย ชื่อร้าน" ตรงๆ) แล้วตามด้วยแถวสินค้าของออเดอร์นั้น ⇒
 * ชื่อร้านของแถวหนึ่ง = ชื่อร้านของหัวการ์ดตัวสุดท้ายที่อยู่**ก่อน**แถวนั้นใน DOM
 */
export function buildShopLookup(doc: Document, seller?: SellerHints): ShopLookup {
  const none: ShopLookup = { shopOf: () => undefined, headers: [] };
  if (!seller?.inline && !seller?.marker) return none;

  const leaves = leafTexts(doc);
  const texts = leaves.map((l) => l.text);

  const isBadge = (t: string) => !!seller.badge?.test(t) || !!seller.marker?.test(t);
  const looksLikeShop = (t: string) =>
    t.length >= 2 && t.length <= 60 && !/^฿|^x\s?\d+$|^\d+(\.\d+)?$/i.test(t) && !isBadge(t);

  const found: { el: Element; shop: string }[] = [];
  /** leaf ที่ถูกอ่านเป็นชื่อร้านไปแล้วจากป้าย "ขายโดย" — หมุดจะได้ไม่หยิบซ้ำแบบยังติดป้ายมาด้วย */
  const fromInline = new Set<Element>();
  texts.forEach((t, i) => {
    if (seller.inline) {
      const m = t.match(seller.inline);
      if (m) {
        // ป้ายกับชื่อร้านอยู่บรรทัดเดียวกัน ("ขายโดย ร้านเอ") หรือชื่ออยู่ leaf ถัดไป
        const shop = (m[1] || "").trim() || (texts[i + 1] || "").trim();
        if (looksLikeShop(shop)) {
          found.push({ el: leaves[i].el, shop });
          fromInline.add(leaves[i].el);
        }
        return;
      }
    }
    if (!seller.marker?.test(t)) return;
    for (let j = i - 1; j >= 0 && j >= i - SHOP_LOOKBACK; j--) {
      if (!looksLikeShop(texts[j])) continue;
      // การ์ดที่มีทั้ง "ขายโดย X" และปุ่ม "ดูร้านค้า" ต้องได้ชื่อเดียว ไม่ใช่สองชื่อที่ตัวหลังยังติดป้ายมา
      if (!fromInline.has(leaves[j].el)) found.push({ el: leaves[j].el, shop: texts[j] });
      return;
    }
  });
  if (found.length === 0) return none;

  return {
    headers: found.map((h) => h.el),
    shopOf: (node) => {
      let shop: string | undefined;
      for (const h of found) {
        // เจอหัวการ์ดที่อยู่หลังแถวนี้แล้ว = หมดของร้านก่อนหน้า (หัวการ์ดเรียงตามลำดับ DOM อยู่แล้ว)
        if (!(h.el.compareDocumentPosition(node) & FOLLOWING)) break;
        shop = h.shop;
      }
      return shop;
    },
  };
}

/** ข้อความในกล่องแถวสินค้ายาวเกินนี้ = ไม่ใช่แถวเดียวแล้ว (กวาดเนื้อหารอบข้างมาด้วย) */
const ROW_MAX_TEXT = 700;
/** ไต่ขึ้นจากรูปได้สูงสุดกี่ชั้น — กัน DOM ที่ห่อ div ซ้อนกันเป็นสิบชั้นจนหลุดออกนอกแถว */
const ROW_MAX_HOPS = 12;

/**
 * หา "กล่องของแถวสินค้า" จากรูปสินค้า 1 รูป — ไต่ขึ้นไปเรื่อยๆ จนกล่องเริ่มกินรูปสินค้าตัวอื่น
 * หรือข้อความยาวเกินไป แล้วเอากล่องชั้นสุดท้ายก่อนหน้านั้น
 *
 * ใช้แทนการเจาะชื่อ class เพราะทุกร้านสุ่มชื่อ class — ที่แน่ๆ คือ "รูป ชื่อ ตัวเลือก จำนวน ราคา"
 * ของสินค้าชิ้นเดียวกันต้องอยู่ในกล่องเดียวกัน และกล่องนั้นต้องมีรูปสินค้าแค่รูปเดียว
 */
export function rowContainerFor(img: HTMLImageElement, headers: Element[] = []): Element | null {
  let node = img.parentElement;
  let best: Element | null = null;
  for (let hops = 0; node && node.tagName !== "BODY" && hops < ROW_MAX_HOPS; hops++) {
    const imgs = [...node.querySelectorAll("img")].filter(isProductImg);
    if (imgs.length > 1) break;
    // ไต่จนคลุมหัวการ์ดออเดอร์ = เลยขอบแถวไปแล้ว ("ขายโดย ร้านเอ" จะกลายเป็นชื่อสินค้า)
    if (headers.some((h) => node!.contains(h))) break;
    const text = (node.textContent || "").replace(/\s+/g, " ").trim();
    if (text.length > ROW_MAX_TEXT) break;
    best = node;
    node = node.parentElement;
  }
  return best;
}

/** ลิงก์สินค้าของแถว — ดูตัวที่ครอบรูปอยู่ก่อน ถ้าไม่มีค่อยหาในกล่องแถว */
export function rowLink(row: Element, img: Element): string {
  const anchor = img.closest("a") ?? row.querySelector("a[href]");
  return anchor?.getAttribute("href") || "";
}

/** เลขโดดๆ ที่ใหญ่กว่านี้ในแถวสินค้าไม่ใช่ "จำนวนที่สั่ง" แน่ๆ (เป็นรหัส/คะแนน/ปี) */
const QTY_BARE_MAX = 99;

export interface RowScan {
  /** จำนวนที่หน้าเว็บระบุป้ายไว้ชัดๆ ("x2", "จำนวน: 2") — undefined = แถวนี้ไม่มีป้ายจำนวน */
  qty?: number;
  /** ติดป้ายคืนเงิน/ยกเลิก = ของไม่ได้อยู่กับเราแล้ว ไม่ควรนำเข้าเป็นสต็อก */
  isRefunded: boolean;
  /** ราคาทุกก้อนตามลำดับที่เจอ — ราคาเต็มแบบขีดฆ่ามักมาก่อนราคาที่จ่ายจริง */
  prices: number[];
  /** เลขโดดๆ ที่ไม่มีป้ายกำกับ — ช่อง "จำนวน" ของตารางออเดอร์บางร้าน (Konvy) เป็นแบบนี้ */
  bareNumbers: number[];
  /** ข้อความที่เหลือ = ผู้ท้าชิงตำแหน่งชื่อ/ขนาด/ตัวเลือกสินค้า (ส่งต่อให้ `parseProductText`) */
  texts: string[];
}

/**
 * อ่านข้อความทุกก้อนในกล่องแถวสินค้าแล้วแยกว่าก้อนไหนคืออะไร — **ตัวแกะทุกร้านใช้ตัวนี้ตัวเดียว**
 *
 * ลำดับการคัดสำคัญ: ป้ายคืนเงิน → จำนวน → ราคา → เลขโดดๆ → ป้ายเปล่า → ป้าย UI → ที่เหลือคือข้อความ
 * ("จำนวน :" ที่ค่าจริงอยู่ก้อนถัดไป ถ้าไม่คัดทิ้งจะกลายเป็นตัวเลือกสินค้าของทุกแถว)
 *
 * ผู้เรียกเป็นคนตัดสินเองว่าแถวแบบไหนถึงนับเป็นสินค้า — Shopee ใช้ "ต้องมีป้ายจำนวน"
 * ส่วนร้านอื่นใช้ "ต้องมีราคา" (ดูเหตุผลใน `lib/orderPage.ts`)
 */
export function scanRowLeaves(root: Element): RowScan {
  const scan: RowScan = { isRefunded: false, prices: [], bareNumbers: [], texts: [] };
  for (const { text: t } of leafTexts(root)) {
    if (REFUND_BADGE.test(t)) {
      scan.isRefunded = true;
      continue;
    }
    const qty = parseQtyLeaf(t);
    if (qty != null) {
      scan.qty = qty;
      continue;
    }
    const price = parsePriceLeaf(t);
    if (price != null) {
      scan.prices.push(price);
      continue;
    }
    if (/^\d+(\.\d+)?$/.test(t)) {
      const n = Number(t);
      if (Number.isInteger(n) && n >= 1 && n <= QTY_BARE_MAX) scan.bareNumbers.push(n);
      continue;
    }
    if (isLabelOnly(t)) continue;
    if (NOISE_TEXT.test(t)) continue;
    if (t.length >= 4) scan.texts.push(t);
  }
  return scan;
}
