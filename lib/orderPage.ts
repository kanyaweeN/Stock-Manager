/**
 * ประตูเดียวที่ `ImportModal` เรียกเพื่อแกะหน้าออเดอร์ — และเป็นที่อยู่ของตัวแกะ **กลาง**
 * ที่ใช้ได้กับทุกร้านในทะเบียน `lib/importSites.ts` (ยกเว้น Shopee ที่มีตัวแกะเฉพาะของมัน
 * ใน `lib/shopee.ts` — ดูเหตุผลในไฟล์นั้น)
 *
 * กติกาเดียวที่ตัวแกะกลางยึด: **สินค้า 1 แถว = รูปสินค้า 1 รูป** แล้วไต่ขึ้นจากรูปไปหากล่องที่ครอบ
 * "ชื่อ ตัวเลือก จำนวน ราคา" ของชิ้นนั้นไว้ด้วยกัน (`rowContainerFor`) — ไม่เจาะชื่อ class เลย
 * เพราะ Lazada/Watsons/Konvy สุ่มชื่อ class กันหมดและเปลี่ยนบ่อย
 *
 * ทุกอย่างเป็น best-effort ผู้ใช้ตรวจ/แก้ได้ในหน้ารีวิวก่อนนำเข้าจริง
 */
import {
  absUrl,
  buildShopLookup,
  getImgSrc,
  inAdBlock,
  isProductImg,
  rowContainerFor,
  rowLink,
  scanRowLeaves,
} from "./importDom";
import { importSite, type ImportSite, type OrderPageData, type OrderRowContext } from "./importSites";
import {
  extractCharges,
  extractIngredientsBlock,
  extractOrderDate,
  parseProductText,
  parseQtyLoose,
} from "./importText";
import { collectShopeeRows } from "./shopee";
import type { ImportCandidate, ImportSource } from "./types";

/** ชื่อสินค้าที่สั้นกว่านี้มักเป็นป้าย UI ที่หลุดมา ไม่ใช่ชื่อจริง */
const MIN_NAME_LEN = 6;

/** ตัวแกะของแต่ละร้านทำแค่ "หาแถวสินค้า" ส่วนที่เหลือ `extractPage` จัดการให้เหมือนกันหมด */
type RowCollector = (doc: Document, ctx: OrderRowContext) => ImportCandidate[];

function collectGenericRows(doc: Document, { site, orderDate, shop }: OrderRowContext): ImportCandidate[] {
  const seen = new Set<string>();
  const takenRows = new Set<Element>();
  const results: ImportCandidate[] = [];

  for (const img of doc.querySelectorAll("img")) {
    if (!isProductImg(img)) continue;
    // ของแนะนำท้ายหน้าไม่ใช่ของที่ซื้อ — ต้องคัดตั้งแต่ต้น ไม่งั้นผ่านทุกด่านเพราะมีครบทั้งรูป ชื่อ และราคา
    if (inAdBlock(img)) continue;
    const row = rowContainerFor(img, shop.headers);
    if (!row || takenRows.has(row)) continue;
    takenRows.add(row);

    const scan = scanRowLeaves(row);
    if (scan.isRefunded) continue; // คืนเงิน/ยกเลิกแล้ว ไม่นับเป็นของที่ได้รับจริง

    /*
     * บางร้านวางจำนวนปนกับข้อความอื่นในแถว ("สี: ชมพู x 2") — หาแบบหลวมๆ ต่อ
     * ยังไม่เจอ ค่อยยอมรับ "เลขโดดๆ" ที่มีอยู่ **ตัวเดียว** ในแถว (ช่องจำนวนของตารางแบบ Konvy
     * ที่ไม่มี "x" กำกับ) — มีหลายตัวคือไม่รู้ว่าตัวไหนคือจำนวน เดาผิดแล้วราคาต่อชิ้นเพี้ยนเงียบๆ
     * สุดท้ายจริงๆ ค่อยถือว่า 1 ชิ้น
     */
    const qty =
      scan.qty ??
      parseQtyLoose((row.textContent || "").replace(/\s+/g, " ")) ??
      (scan.bareNumbers.length === 1 ? scan.bareNumbers[0] : undefined) ??
      1;

    /*
     * ต้องมีราคาถึงจะนับเป็นแถวสินค้า — ต่างจาก Shopee ที่ใช้ป้ายจำนวนเป็นตัวคัด
     * เพราะร้านอื่นบางที่ไม่โชว์ "x1" ให้กับของชิ้นเดียว แต่ทุกแถวในออเดอร์ต้องมีราคาเสมอ
     * (นี่คือด่านที่กันแบนเนอร์/สินค้าแนะนำท้ายหน้าไม่ให้หลุดเข้ามา)
     */
    if (scan.prices.length === 0) continue;
    const parsed = parseProductText(scan.texts);
    if (!parsed || parsed.name.length < MIN_NAME_LEN) continue;
    const { name, size, variant } = parsed;

    // ราคาที่จ่ายจริงมักเป็นตัวสุดท้าย (ราคาเต็มมักโชว์ก่อนหน้าแบบขีดฆ่า)
    const lineTotal = scan.prices[scan.prices.length - 1];
    const price = site.priceIsLineTotal && qty > 0 ? Math.round((lineTotal / qty) * 100) / 100 : lineTotal;

    const absSrc = absUrl(getImgSrc(img), site.baseUrl);
    // คีย์กันซ้ำระบุ "แถวคำสั่งซื้อ" ไม่ใช่ "ตัวสินค้า" — สินค้าเดียวกันคนละตัวเลือกใช้รูปเดียวกันได้
    const key = [absSrc, name, variant ?? "", size ?? "", qty, lineTotal].join("|");
    if (seen.has(key)) continue;
    seen.add(key);

    results.push({
      name, qty, img: absSrc, link: absUrl(rowLink(row, img), site.baseUrl),
      cats: [], status: "", include: true, source: site.id,
      price, lineTotal, size, variant, purchasedAt: orderDate,
      // ตำแหน่งอ้างอิงต้องเป็น **รูป** ไม่ใช่กล่องแถว — กล่องแถวอาจเริ่มก่อนหัวการ์ดของร้านตัวเอง
      shop: site.fixedShop ?? shop.shopOf(img),
    });
  }

  return results;
}

/**
 * เปลือกที่ทุกร้านใช้เหมือนกัน — แกะ DOM, หาวันสั่งซื้อ, หาชื่อร้านของแต่ละแถว, อ่านยอดเงินท้ายบิล
 * แล้วปล่อยให้ `collect` ของร้านนั้นตอบแค่ว่า "แถวไหนคือสินค้า"
 */
function extractPage(html: string, site: ImportSite, collect: RowCollector): OrderPageData {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const pageText = (doc.body?.textContent || "").replace(/\s+/g, " ");
  const items = collect(doc, {
    site,
    orderDate: extractOrderDate(pageText, site.dateFormats),
    shop: buildShopLookup(doc, site.seller),
  });

  // วาง HTML ของหน้าสินค้าเดี่ยวมา (เจอชิ้นเดียว) ค่อยแนบส่วนผสมที่หาเจอให้ — หลายชิ้นจะไม่รู้ว่าเป็นของใคร
  if (items.length === 1) {
    const ingredients = extractIngredientsBlock(doc.body?.textContent || "");
    if (ingredients) items[0].ingredients = ingredients;
  }

  return { items, ...extractCharges(pageText, site.charges) };
}

/** ประตูเดียวที่ `ImportModal` เรียก — เลือกตัวแกะตามร้านที่ผู้ใช้เลือกไว้ */
export function extractOrderPage(html: string, source: ImportSource): OrderPageData {
  const site = importSite(source);
  return extractPage(html, site, source === "shopee" ? collectShopeeRows : collectGenericRows);
}
