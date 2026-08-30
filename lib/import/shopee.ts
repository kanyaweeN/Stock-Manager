/**
 * ตัวแกะแถวสินค้าของหน้าออเดอร์ **Shopee** โดยเฉพาะ — อาศัยโครง `<a>` ที่ครอบทั้งรูปและชื่อสินค้า
 * ไว้ด้วยกัน (ร้านอื่นไม่ได้ห่อแบบนี้ จึงใช้ตัวแกะกลางใน `lib/import/orderPage.ts` แทน)
 *
 * ไฟล์นี้รู้แค่ "แถวไหนคือสินค้า" — ส่วนที่ทุกร้านเหมือนกัน (วันที่/ยอดเงิน/ชื่อร้าน/ส่วนผสม)
 * ถูกเตรียมมาให้แล้วโดย `extractOrderPage` และตรรกะที่ใช้ร่วมกันอยู่ที่ `lib/import/text.ts`
 * (ข้อความ) + `lib/import/dom.ts` (โครงหน้า) ส่วนป้ายภาษาไทยของยอดเงินอยู่ที่ `lib/import/sites.ts`
 */
import { absUrl, getImgSrc, isProductImg, scanRowLeaves } from "@/lib/import/dom";
import type { OrderRowContext } from "@/lib/import/sites";
import { parseProductText } from "@/lib/import/text";
import type { ImportCandidate } from "@/lib/types";

/**
 * แยกรายการสินค้าจาก HTML ของหน้าออเดอร์ Shopee (คัดลอกมาด้วย Ctrl+U หรือ View Page Source)
 * เป็น best-effort เพราะ Shopee ใช้ชื่อ class แบบสุ่ม จึงอิงจากโครงสร้าง `<a>` ที่ครอบรูป+ชื่อสินค้าแทน
 */
export function collectShopeeRows(doc: Document, { site, orderDate, shop }: OrderRowContext): ImportCandidate[] {
  const anchors = [...doc.querySelectorAll("a")].filter((a) => {
    const imgs = [...a.querySelectorAll("img")];
    return imgs.length > 0 && imgs.some(isProductImg) && a.querySelector("span, div");
  });

  const seen = new Set<string>();
  const results: ImportCandidate[] = [];

  for (const a of anchors) {
    const img = [...a.querySelectorAll("img")].find(isProductImg);
    if (!img) continue;
    const absSrc = absUrl(getImgSrc(img), site.baseUrl);

    const { qty, isRefunded, prices, texts } = scanRowLeaves(a);
    if (isRefunded) continue; // คืนเงิน/คืนสินค้าแล้ว ไม่นับเป็นของที่ได้รับจริง
    // ต้องเจอป้ายจำนวนจริงๆ ถึงจะถือว่าเป็นรายการสั่งซื้อ (กันลิงก์เมนู/บัญชีที่ไม่ใช่สินค้าหลุดเข้ามา)
    if (!qty || texts.length === 0) continue;

    const parsed = parseProductText(texts);
    if (!parsed) continue; // มีแต่บรรทัดตัวเลือก ไม่รู้ชื่อสินค้า ข้ามไป
    const { name, size, variant } = parsed;

    /*
     * ราคาที่จ่ายจริงมักเป็นตัวสุดท้าย (ราคาเต็มมักโชว์ก่อนหน้าแบบขีดฆ่า)
     *
     * และตัวเลขนั้นเป็น **ยอดรวมทั้งแถว** ไม่ใช่ราคาต่อชิ้น — เช่นออเดอร์ที่สั่ง x3 โชว์ "฿63 ฿54"
     * แล้วช่อง "รวมค่าสินค้า" ของออเดอร์ก็เป็น ฿54 เท่ากัน (ไม่ใช่ ฿162) = ชิ้นละ ฿18
     * สต็อกเก็บราคาเป็นต่อชิ้น (ดู StockItem.price) จึงต้องหารด้วยจำนวนก่อน
     * เก็บยอดรวมดิบไว้ด้วย เผื่อหน้าที่วางมาโชว์เป็นราคาต่อชิ้นอยู่แล้ว ผู้ใช้จะได้สลับกลับได้ใน ImportModal
     */
    const lineTotal = prices.length ? prices[prices.length - 1] : undefined;
    const price = lineTotal != null && qty > 0 ? Math.round((lineTotal / qty) * 100) / 100 : lineTotal;

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
      name, qty, img: absSrc, link: absUrl(a.getAttribute("href") || "", site.baseUrl),
      cats: [], status: "", include: true, source: site.id,
      price, lineTotal, size, variant, purchasedAt: orderDate, shop: shop.shopOf(a),
    });
  }

  return results;
}
