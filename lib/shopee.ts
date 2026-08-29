import type { ImportCandidate } from "./types";

const SKIP_HINTS = /icon|logo|sprite|avatar|badge|banner|placeholder|profile|qr[_-]?code/i;

// ป้าย UI อื่นๆ ที่ไม่ใช่ข้อมูลสินค้า แต่ดันอยู่ใน <a> เดียวกับสินค้า (เช่น "เรตติ้งร้าน" ที่โผล่หลังราคา) — ต้องกรองทิ้งไม่งั้นจะหลุดไปเป็นชื่อ/ตัวเลือกสินค้าผิดๆ
const NOISE_TEXT = /^(เรตติ้งร้าน|ดูร้านค้า|ดูเพิ่มเติม|ดูเพิ่มเติมเกี่ยวกับสินค้า|ร้านค้ามาใหม่|ต้องการสินค้าเพิ่มไหม)$/i;

// ถ้าออเดอร์นี้ถูกคืนเงิน/คืนสินค้าแล้ว ไม่ควรนำเข้ามาเป็นสต็อกจริง (ของไม่ได้อยู่กับเราแล้ว)
const REFUND_BADGE = /^คืนเงิน\s*\/\s*คืนสินค้า$/i;

/**
 * หาบล็อกส่วนผสมจากรายละเอียดสินค้า (มีเฉพาะตอนวาง HTML ของ "หน้าสินค้า" — หน้ารายการออเดอร์ไม่มีข้อมูลนี้)
 * เป็น best-effort: ตัดเอาข้อความหลังคำว่า "ส่วนผสม/Ingredients:" จนกว่าจะเจอย่อหน้าใหม่
 */
export function extractIngredientsBlock(text: string): string | undefined {
  const m = text.match(/(?:ส่วนผสม|ส่วนประกอบ|ingredients?)\s*[:：]\s*([^\n\r]{20,1500})/i);
  if (!m) return undefined;
  const body = m[1].trim();
  // ต้องมีลักษณะเป็นลิสต์จริงๆ (คั่นด้วยจุลภาคหลายตัว) ไม่งั้นมักเป็นประโยคโฆษณาที่บังเอิญมีคำว่าส่วนผสม
  if ((body.match(/,/g) || []).length < 3) return undefined;
  return body.slice(0, 1500);
}

function getImgSrc(img: HTMLImageElement): string {
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

function isProductImg(img: HTMLImageElement): boolean {
  const src = getImgSrc(img);
  const alt = img.getAttribute("alt") || "";
  if (!src || /^data:/.test(src) || SKIP_HINTS.test(src) || SKIP_HINTS.test(alt)) return false;
  const w = parseInt(img.getAttribute("width") || "0", 10);
  const h = parseInt(img.getAttribute("height") || "0", 10);
  if ((w && w < 40) || (h && h < 40)) return false;
  return true;
}

/**
 * ยอด "รวมค่าสินค้า" ที่ Shopee โชว์ในหน้ารายละเอียดออเดอร์ (ไม่รวมค่าส่ง/ส่วนลด/coins)
 * เอาไว้เช็คว่าแกะรายการมาครบไหม — ถ้าผลรวมที่แกะได้ไม่เท่ากับตัวนี้ แปลว่ามีแถวหล่นหาย
 *
 * หน้ารายการออเดอร์รวม (purchase list) ไม่มีป้ายนี้ คืน undefined ไปเฉยๆ ไม่ต้องเตือน
 * หน้าที่มีหลายออเดอร์ก็บวกรวมกันทุกก้อน จะได้เทียบกับผลรวมทั้งหน้าได้
 */
function extractGoodsSubtotal(text: string): number | undefined {
  const matches = [...text.matchAll(/รวมค่าสินค้า\s*฿\s?([\d,]+(?:\.\d+)?)/g)];
  if (matches.length === 0) return undefined;
  const sum = matches.reduce((s, m) => s + Number(m[1].replace(/,/g, "")), 0);
  return Number.isFinite(sum) ? sum : undefined;
}

/**
 * วันที่สั่งซื้อจากแถบสถานะของหน้าออเดอร์ (เช่น "18-08-2019 16:57" ของขั้น "มีคำสั่งซื้อใหม่")
 * เอาตัวที่เก่าสุดเพราะขั้นตอนหลังๆ (จ่ายเงิน/ส่งของ/รับของ) เกิดทีหลังเสมอ
 *
 * จับจาก pattern ของวันที่ตรงๆ ไม่พึ่งชื่อ class เพราะ Shopee สุ่มชื่อ class
 */
function extractOrderDate(text: string): string | undefined {
  const dates: string[] = [];
  for (const m of text.matchAll(/\b(\d{2})-(\d{2})-(\d{4})\s+\d{1,2}:\d{2}\b/g)) {
    const [, dd, mm, yyyy] = m;
    // เผื่อหน้าไหนโชว์เป็น พ.ศ. — 2400+ ไม่มีทางเป็น ค.ศ. ของออเดอร์จริง
    const year = Number(yyyy) > 2400 ? Number(yyyy) - 543 : Number(yyyy);
    const month = Number(mm);
    const day = Number(dd);
    if (month < 1 || month > 12 || day < 1 || day > 31) continue;
    dates.push(`${year}-${mm}-${dd}`);
  }
  if (dates.length === 0) return undefined;
  return dates.sort()[0];
}

/** ป้ายที่อยู่ติดกับชื่อร้านแต่ไม่ใช่ชื่อร้าน — ต้องข้ามตอนไล่หาชื่อร้านย้อนขึ้นไป */
const SHOP_BADGE = /^(preferred\+?|mall|shopee mall|ร้านค้าแนะนำ|แชท|แชทเลย|พูดคุย|chat|ติดตาม|ร้านแนะนำ)$/i;
/** ปุ่มที่ Shopee วางไว้ "หลัง" ชื่อร้านเสมอในหัวการ์ดออเดอร์ — ใช้เป็นหมุดหาชื่อร้าน */
const SHOP_MARKER = /^(ดูร้านค้า|ดูร้าน|view shop)$/i;
/** ไล่ย้อนขึ้นไปหาชื่อร้านได้ไกลสุดกี่ leaf ก่อนถึงหมุด (เผื่อมีป้าย Preferred/Mall คั่น) */
const SHOP_LOOKBACK = 6;

/**
 * หาว่าสินค้าแต่ละแถวมาจากร้านไหน — **best-effort** เพราะ Shopee สุ่มชื่อ class
 *
 * อาศัยลำดับใน DOM แทนโครงสร้าง: หัวการ์ดออเดอร์คือ `[ป้าย] ชื่อร้าน [แชท] [ดูร้านค้า]`
 * แล้วตามด้วยแถวสินค้าของออเดอร์นั้น ⇒ ชื่อร้านของสินค้าแถวหนึ่ง = ชื่อร้านของหมุด
 * "ดูร้านค้า" ตัวสุดท้ายที่อยู่**ก่อน**แถวนั้น (คืน undefined ถ้าหาไม่เจอ ให้ผู้ใช้กรอกเองในหน้ารีวิว)
 */
function buildShopLookup(doc: Document): (a: Element) => string | undefined {
  const leafIndex = new Map<Element, number>();
  const texts: string[] = [];
  for (const el of doc.querySelectorAll("span, div, a, h1, h2, h3, strong, p")) {
    if (el.children.length > 0) continue;
    const t = (el.textContent || "").replace(/\s+/g, " ").trim();
    if (!t) continue;
    leafIndex.set(el, texts.length);
    texts.push(t);
  }

  // หมุด "ดูร้านค้า" ทุกตัวพร้อมชื่อร้านที่อยู่ก่อนหน้า — เรียงตามลำดับใน DOM อยู่แล้ว
  const headers: { at: number; shop: string }[] = [];
  texts.forEach((t, i) => {
    if (!SHOP_MARKER.test(t)) return;
    for (let j = i - 1; j >= 0 && j >= i - SHOP_LOOKBACK; j--) {
      const candidate = texts[j];
      if (SHOP_BADGE.test(candidate) || SHOP_MARKER.test(candidate)) continue;
      // ตัวเลข/ราคา/จำนวน/สถานะออเดอร์ ไม่ใช่ชื่อร้าน
      if (/^฿|^x\s?\d+$|^\d+(\.\d+)?$/i.test(candidate)) continue;
      if (candidate.length < 2 || candidate.length > 60) continue;
      headers.push({ at: i, shop: candidate });
      return;
    }
  });

  return (a) => {
    let first: number | undefined;
    for (const el of a.querySelectorAll("span, div, p")) {
      const idx = leafIndex.get(el);
      if (idx != null) {
        first = idx;
        break;
      }
    }
    if (first == null) return undefined;
    let shop: string | undefined;
    for (const h of headers) {
      if (h.at >= first) break;
      shop = h.shop;
    }
    return shop;
  };
}

const money = String.raw`฿\s?-?\s?([\d,]+(?:\.\d+)?)`;

/** บวกทุกตัวที่เจอ (หน้าที่มีหลายออเดอร์ต้องรวมกัน เหมือน `extractGoodsSubtotal`) — undefined ถ้าไม่เจอเลย */
function sumMoney(text: string, pattern: string): number | undefined {
  const matches = [...text.matchAll(new RegExp(pattern, "g"))];
  if (matches.length === 0) return undefined;
  const sum = matches.reduce((s, m) => s + Number(m[1].replace(/,/g, "")), 0);
  return Number.isFinite(sum) ? sum : undefined;
}

/**
 * ค่าส่ง/ส่วนลดระดับออเดอร์ที่ **ไม่ได้อยู่ในราคาสินค้า** — `/summary` เคยมองข้ามเงินก้อนนี้ไปทั้งหมด
 * เพราะรวมยอดจากจุดราคาของสินค้าล้วนๆ ยอด "จ่ายไปแล้ว" เลยต่ำกว่าเงินที่ออกจากกระเป๋าจริง
 *
 * ทั้งหมดเป็น best-effort จากป้ายภาษาไทยบนหน้าออเดอร์ — ผู้ใช้แก้ตัวเลขเองได้ในหน้ารีวิวก่อนนำเข้า
 * `ค่าจัดส่ง` ต้องกัน `ส่วนลดค่าจัดส่ง` ที่มีคำเดียวกันอยู่ข้างใน ไม่งั้นนับซ้ำเป็นค่าส่งสองเด้ง
 */
function extractOrderCharges(text: string): { shipping?: number; discount?: number; grandTotal?: number } {
  const shipRaw = sumMoney(text, String.raw`(?<!ส่วนลด)ค่า(?:จัดส่ง|ส่ง)\s*${money}`);
  const shipDiscount = sumMoney(text, String.raw`ส่วนลดค่า(?:จัดส่ง|ส่ง)\s*${money}`);
  const otherDiscount = sumMoney(text, String.raw`ส่วนลด(?!ค่าจัดส่ง|ค่าส่ง)[^฿]{0,24}${money}`);
  const grandTotal = sumMoney(text, String.raw`(?:ยอดรวมทั้งหมด|ยอดชำระเงินทั้งหมด|รวมการสั่งซื้อ)\s*${money}`);

  // ค่าส่งที่จ่ายจริง = ค่าส่งเต็ม − ส่วนลดค่าส่ง (ติดลบไม่ได้)
  const shipping = shipRaw == null ? undefined : Math.max(0, shipRaw - (shipDiscount ?? 0));
  return { shipping, discount: otherDiscount, grandTotal };
}

export interface ShopeePageData {
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

/**
 * แยกรายการสินค้าจาก HTML ของหน้าออเดอร์ Shopee (คัดลอกมาด้วย Ctrl+U หรือ View Page Source)
 * เป็น best-effort เพราะ Shopee ใช้ชื่อ class แบบสุ่ม จึงอิงจากโครงสร้าง <a> ที่ครอบรูป+ชื่อสินค้าแทน
 */
export function extractShopeePage(html: string): ShopeePageData {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const pageText = (doc.body?.textContent || "").replace(/\s+/g, " ");
  const orderDate = extractOrderDate(pageText);

  const shopOf = buildShopLookup(doc);

  const anchors = [...doc.querySelectorAll("a")].filter((a) => {
    const imgs = [...a.querySelectorAll("img")];
    return imgs.length > 0 && imgs.some(isProductImg) && a.querySelector("span, div");
  });

  const seen = new Set<string>();
  const results: ImportCandidate[] = [];

  for (const a of anchors) {
    const img = [...a.querySelectorAll("img")].find(isProductImg);
    if (!img) continue;
    const src = getImgSrc(img);
    let absSrc = src;
    try {
      absSrc = new URL(src, "https://shopee.co.th/").href;
    } catch {
      // เก็บค่าดิบไว้ถ้า URL ไม่ถูกต้อง
    }
    let qty = 0; // ต้องเจอป้ายจำนวนจริงๆ ถึงจะถือว่าเป็นรายการสั่งซื้อ (กันลิงก์เมนู/บัญชีที่ไม่ใช่สินค้าหลุดเข้ามา)
    let isRefunded = false;
    const prices: number[] = [];
    const textCandidates: string[] = [];

    for (const el of a.querySelectorAll("span, div")) {
      if (el.children.length > 0) continue; // เอาเฉพาะ element ใบสุดท้าย
      const t = (el.textContent || "").replace(/\s+/g, " ").trim();
      if (!t) continue;
      if (REFUND_BADGE.test(t)) {
        isRefunded = true;
        continue;
      }
      const qtyMatch = t.match(/^x\s?(\d+)$/i) || t.match(/^จำนวน[:\s]*(\d+)$/);
      if (qtyMatch) {
        qty = parseInt(qtyMatch[1], 10);
        continue;
      }
      const priceMatch = t.match(/^฿\s?(\d+(?:\.\d+)?)/);
      if (priceMatch) {
        prices.push(parseFloat(priceMatch[1]));
        continue;
      }
      if (/^\d+(\.\d+)?$/.test(t)) continue;
      if (NOISE_TEXT.test(t)) continue;
      if (t.length >= 4) textCandidates.push(t);
    }
    if (isRefunded) continue; // คืนเงิน/คืนสินค้าแล้ว ไม่นับเป็นของที่ได้รับจริง
    if (!qty || textCandidates.length === 0) continue;

    /*
     * บรรทัดตัวเลือกสินค้าบอกตัวเองอยู่แล้วว่าเป็นอะไร ("ตัวเลือกสินค้า: กลิ่น Peppermint")
     * ต้องดึงออกก่อนเดาชื่อ ไม่งั้นเวลาสินค้าชื่อสั้นกว่าบรรทัดนี้ กติกา "ยาวสุดคือชื่อ"
     * จะหยิบตัวเลือกไปเป็นชื่อสินค้าแทน แล้วได้การ์ดชื่อ "ตัวเลือกสินค้า: ..." เต็มไปหมด
     */
    const VARIANT_LINE = /^(?:ตัวเลือกสินค้า|ตัวเลือก|variation|variant)\s*[:：]\s*(.+)$/i;
    let labelledVariant: string | undefined;
    const nameCandidates: string[] = [];
    for (const t of textCandidates) {
      const m = t.match(VARIANT_LINE);
      if (m && !labelledVariant) labelledVariant = m[1].trim();
      else if (!m) nameCandidates.push(t);
    }
    if (nameCandidates.length === 0) continue; // มีแต่บรรทัดตัวเลือก ไม่รู้ชื่อสินค้า ข้ามไป

    // ชื่อสินค้าจริงมักเป็นข้อความที่ยาวที่สุด (ป้ายอื่นๆ เช่น "Pre-Order" จะสั้นกว่า)
    let name = nameCandidates[0];
    for (const t of nameCandidates) if (t.length > name.length) name = t;
    name = name.slice(0, 150);

    // ข้อความอื่นที่เหลือ (ไม่ใช่ชื่อ) เก็บไว้เป็นแท็กรอง เช่น รุ่น/สี
    const GENERIC_BADGE = /^(pre-?order|พรีออเดอร์|พร้อมส่ง|in\s?stock)$/i;
    const otherCandidates = nameCandidates.filter((t) => t !== name && !GENERIC_BADGE.test(t));

    // เดาไซส์จากข้อความตัวเลือกสินค้า เช่น "ไซส์ M", "ขนาด 10x15 ซม.", หรือแค่ "S"/"XL" เดี่ยวๆ
    const UNIT = "ซม\\.?|เซนติเมตร|cm|มม\\.?|มิลลิเมตร|mm|มล\\.?|มิลลิลิตร|ml|ลิตร|l|กก\\.?|กิโลกรัม|kg|กรัม|g";
    const DIM = "\\d+(?:\\.\\d+)?(?:\\s?[x×]\\s?\\d+(?:\\.\\d+)?)?";
    const SIZE_HINT = new RegExp(
      `(?:ไซส์|ไซซ์|ขนาด|size)[:\\s]*([a-zA-Z0-9x×.\\-]+(?:\\s?(?:${UNIT}))?)|^(XXS|XS|S|M|L|XL|XXL|XXXL|${DIM}\\s?(?:${UNIT}))$`,
      "i"
    );
    let size: string | undefined;
    const remaining: string[] = [];
    for (const t of otherCandidates) {
      const m = !size && t.match(SIZE_HINT);
      if (m) size = (m[1] || m[2]).trim();
      else remaining.push(t);
    }
    // ชื่อสินค้าเองก็มักฝังไซส์ไว้กลางข้อความ เช่น "...มาการอง 4มม. สำหรับ..." หรือ "จี้ 8x14 มิลลิเมตร..." — หาแบบไม่ยึดขอบข้อความ
    if (!size) {
      const inName = name.match(new RegExp(`(${DIM})\\s?(${UNIT})`, "i"));
      if (inName) size = `${inName[1]}${inName[2]}`;
    }
    // ตัวเลือกที่ Shopee ระบุป้ายไว้ชัดๆ เชื่อถือได้กว่าการเดาจากข้อความที่เหลือ
    const variant = (labelledVariant ?? remaining[remaining.length - 1])?.slice(0, 80);

    // ราคาที่จ่ายจริงมักเป็นตัวสุดท้าย (ราคาเต็มมักโชว์ก่อนหน้าแบบขีดฆ่า)
    //
    // และตัวเลขนั้นเป็น **ยอดรวมทั้งแถว** ไม่ใช่ราคาต่อชิ้น — เช่นออเดอร์ที่สั่ง x3 โชว์ "฿63 ฿54"
    // แล้วช่อง "รวมค่าสินค้า" ของออเดอร์ก็เป็น ฿54 เท่ากัน (ไม่ใช่ ฿162) = ชิ้นละ ฿18
    // สต็อกเก็บราคาเป็นต่อชิ้น (ดู StockItem.price) จึงต้องหารด้วยจำนวนก่อน
    // เก็บยอดรวมดิบไว้ด้วย เผื่อหน้าที่วางมาโชว์เป็นราคาต่อชิ้นอยู่แล้ว ผู้ใช้จะได้สลับกลับได้ใน ImportModal
    const lineTotal = prices.length ? prices[prices.length - 1] : undefined;
    const price = lineTotal != null && qty > 0 ? Math.round((lineTotal / qty) * 100) / 100 : lineTotal;

    let link = a.getAttribute("href") || "";
    try {
      link = link ? new URL(link, "https://shopee.co.th/").href : "";
    } catch {
      // ไม่สนใจถ้าแปลงเป็น absolute URL ไม่ได้
    }

    /*
     * คีย์กันซ้ำต้องระบุ "แถวคำสั่งซื้อ" ไม่ใช่ "ตัวสินค้า"
     *
     * เดิมใช้แค่ URL รูป ซึ่งพังกับออเดอร์ที่สั่งสินค้าเดียวกันหลายตัวเลือก — ตัวเลือก
     * "กลาง" กับ "ใหญ่" ของสินค้าเดียวกันใช้รูปเดียวกัน ตัวที่สองเลยถูกทิ้งแบบเงียบๆ
     * (ออเดอร์ ฿130 นำเข้าได้แค่ ฿70) ใส่ตัวเลือก/ขนาด/จำนวน/ราคาเข้าไปในคีย์ด้วย
     * ก็ยังกรอง anchor ที่ Shopee เรนเดอร์ซ้ำ (mobile/desktop) ได้เหมือนเดิม
     * เพราะแถวซ้ำแบบนั้นเหมือนกันทุกช่อง
     */
    const key = [absSrc, variant ?? "", size ?? "", qty, lineTotal ?? ""].join("|");
    if (seen.has(key)) continue;
    seen.add(key);
    results.push({
      name, qty, img: absSrc, link, cats: [], status: "", include: true,
      price, lineTotal, size, variant, purchasedAt: orderDate, shop: shopOf(a),
    });
  }

  // ถ้าวาง HTML ของหน้าสินค้าเดี่ยวมา (เจอสินค้าชิ้นเดียว) ค่อยแนบส่วนผสมที่หาเจอให้ — ถ้ามีหลายชิ้นจะไม่รู้ว่าเป็นของใคร
  if (results.length === 1) {
    const ingredients = extractIngredientsBlock(doc.body?.textContent || "");
    if (ingredients) results[0].ingredients = ingredients;
  }

  return { items: results, goodsSubtotal: extractGoodsSubtotal(pageText), ...extractOrderCharges(pageText) };
}
