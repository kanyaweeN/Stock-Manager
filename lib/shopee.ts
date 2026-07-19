import type { ImportCandidate } from "./types";

const SKIP_HINTS = /icon|logo|sprite|avatar|badge|banner|placeholder|profile|qr[_-]?code/i;

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
 * แยกรายการสินค้าจาก HTML ของหน้าออเดอร์ Shopee (คัดลอกมาด้วย Ctrl+U หรือ View Page Source)
 * เป็น best-effort เพราะ Shopee ใช้ชื่อ class แบบสุ่ม จึงอิงจากโครงสร้าง <a> ที่ครอบรูป+ชื่อสินค้าแทน
 */
export function extractShopeeItems(html: string): ImportCandidate[] {
  const doc = new DOMParser().parseFromString(html, "text/html");

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
    if (seen.has(absSrc)) continue;

    let name = "";
    let qty = 0; // ต้องเจอป้ายจำนวนจริงๆ ถึงจะถือว่าเป็นรายการสั่งซื้อ (กันลิงก์เมนู/บัญชีที่ไม่ใช่สินค้าหลุดเข้ามา)
    for (const el of a.querySelectorAll("span, div")) {
      if (el.children.length > 0) continue; // เอาเฉพาะ element ใบสุดท้าย
      const t = (el.textContent || "").replace(/\s+/g, " ").trim();
      if (!t) continue;
      const qtyMatch = t.match(/^x\s?(\d+)$/i) || t.match(/^จำนวน[:\s]*(\d+)$/);
      if (qtyMatch) {
        qty = parseInt(qtyMatch[1], 10);
        continue;
      }
      if (/^฿/.test(t) || /^\d+(\.\d+)?$/.test(t)) continue;
      if (!name && t.length >= 4) name = t.slice(0, 150);
    }
    if (!name || !qty) continue;

    let link = a.getAttribute("href") || "";
    try {
      link = link ? new URL(link, "https://shopee.co.th/").href : "";
    } catch {
      // ไม่สนใจถ้าแปลงเป็น absolute URL ไม่ได้
    }

    seen.add(absSrc);
    results.push({ name, qty, img: absSrc, link, cat: "", status: "", include: true });
  }

  return results;
}
