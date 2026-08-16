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

export interface ShopeePageData {
  items: ImportCandidate[];
  /** ยอด "รวมค่าสินค้า" บนหน้า — ใช้เทียบกับผลรวมที่แกะได้ (undefined = หน้านั้นไม่มีให้เทียบ) */
  goodsSubtotal?: number;
}

/**
 * แยกรายการสินค้าจาก HTML ของหน้าออเดอร์ Shopee (คัดลอกมาด้วย Ctrl+U หรือ View Page Source)
 * เป็น best-effort เพราะ Shopee ใช้ชื่อ class แบบสุ่ม จึงอิงจากโครงสร้าง <a> ที่ครอบรูป+ชื่อสินค้าแทน
 */
export function extractShopeePage(html: string): ShopeePageData {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const pageText = (doc.body?.textContent || "").replace(/\s+/g, " ");
  const orderDate = extractOrderDate(pageText);

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
      price, lineTotal, size, variant, purchasedAt: orderDate,
    });
  }

  // ถ้าวาง HTML ของหน้าสินค้าเดี่ยวมา (เจอสินค้าชิ้นเดียว) ค่อยแนบส่วนผสมที่หาเจอให้ — ถ้ามีหลายชิ้นจะไม่รู้ว่าเป็นของใคร
  if (results.length === 1) {
    const ingredients = extractIngredientsBlock(doc.body?.textContent || "");
    if (ingredients) results[0].ingredients = ingredients;
  }

  return { items: results, goodsSubtotal: extractGoodsSubtotal(pageText) };
}
