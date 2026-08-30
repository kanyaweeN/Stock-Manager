/**
 * ตัวแกะ **ข้อความล้วน** ของหน้าออเดอร์ทุกร้าน (Shopee / Lazada / Watsons / Konvy)
 * ไม่มี DOM ไม่มี state — ส่วนที่ต้องเดินโครงสร้างหน้าเว็บอยู่ที่ `lib/importDom.ts`
 *
 * แยกออกมาเพราะเดิมทั้งหมดนี้อยู่ใน `lib/shopee.ts` ที่เทสต์ไม่ได้ (ทั้งไฟล์ต้องใช้ `DOMParser`)
 * ทั้งที่ตรรกะ **เงิน/วันที่** พลาดแล้วยอดสรุปเพี้ยนเงียบๆ — ครอบด้วย `lib/__tests__/importText.test.ts`
 */

/** จำนวนเงินแบบไทย รับทั้ง "฿1,200.50" (นำหน้า) และ "1,200.50 บาท" (ต่อท้าย) — จับได้ 2 กลุ่ม ใช้ `moneyOf` อ่าน */
const AMOUNT = String.raw`\d[\d,]*(?:\.\d+)?`;
export const MONEY = String.raw`(?:฿\s?-?\s?(${AMOUNT})|(${AMOUNT})\s?(?:฿|บาท|THB))`;

/**
 * ตัวคั่นระหว่างป้ายกับตัวเลข เช่น "ส่วนลด จากร้านค้า ฿20"
 *
 * ห้ามข้ามตัวเลข **และห้ามข้ามป้ายตัวถัดไป** — ป้ายที่ไม่มีตัวเลขตามมา (เช่น "ค่าจัดส่ง ฟรี")
 * จะกระโดดไปหยิบยอดของป้ายถัดไปมาเป็นของตัวเอง แล้วค่าส่งกลายเป็นยอดรวมทั้งบิลแบบเงียบๆ
 */
const LABEL_HEAD = String.raw`ยอด|รวม|ส่วนลด|ค่า|total|subtotal`;
const GAP = String.raw`\s*[:：]?\s*(?:(?!${LABEL_HEAD})[^\d]){0,14}`;

/** อ่านค่าเงินจาก match ของ `MONEY` — เอากลุ่มแรกที่ไม่ว่าง (รูปแบบนำหน้า/ต่อท้ายคนละกลุ่มกัน) */
function moneyOf(m: RegExpMatchArray): number | undefined {
  for (let g = 1; g < m.length; g++) {
    if (m[g] != null) return Number(m[g].replace(/,/g, ""));
  }
  return undefined;
}

/** บวกทุกตัวที่เจอ (หน้าที่มีหลายออเดอร์ต้องรวมกัน) — undefined ถ้าไม่เจอเลย */
export function sumMoney(text: string, pattern: string): number | undefined {
  let sum = 0;
  let found = false;
  for (const m of text.matchAll(new RegExp(pattern, "gi"))) {
    const v = moneyOf(m);
    if (v == null || !Number.isFinite(v)) continue;
    sum += v;
    found = true;
  }
  return found ? sum : undefined;
}

/**
 * ยอดของป้ายชนิดหนึ่ง เช่น ค่าส่ง — `labels` เป็น regex source เรียงตาม**ลำดับความมั่นใจ**
 *
 * **ป้ายแรกที่เจอชนะ ป้ายที่เหลือไม่ถูกนับต่อ** เพราะหน้าเดียวกันมักเรียกยอดเดียวกันหลายชื่อ
 * ("ยอดสุทธิ" กับ "ยอดชำระเงิน" คือก้อนเดียวกัน) ถ้าบวกทุกป้ายจะได้ยอดสองเท่าแบบเงียบๆ
 * ส่วนป้ายเดียวกันที่โผล่หลายครั้ง (หน้าที่มีหลายออเดอร์) ยังบวกรวมกันเหมือนเดิม
 */
export function labelMoney(text: string, labels: string[]): number | undefined {
  for (const label of labels) {
    const sum = sumMoney(text, `(?:${label})${GAP}${MONEY}`);
    if (sum != null) return sum;
  }
  return undefined;
}

export interface ChargeLabels {
  /** "รวมค่าสินค้า" — ยอดสินค้าล้วนๆ ไว้เทียบว่าแกะรายการมาครบไหม */
  subtotal: string[];
  shipping: string[];
  /** ส่วนลดค่าส่ง — ต้องแยกจากส่วนลดทั่วไป ไม่งั้นค่าส่งที่ได้ฟรีจะถูกนับเป็นเงินที่จ่ายจริง */
  shipDiscount: string[];
  discount: string[];
  /** ยอดชำระทั้งหมด — ไว้เทียบว่าค่าส่ง/ส่วนลดที่แกะได้ครบไหม */
  total: string[];
}

export interface OrderCharges {
  goodsSubtotal?: number;
  /** ค่าส่งที่จ่ายจริง = ค่าส่งเต็ม − ส่วนลดค่าส่ง (ติดลบไม่ได้) */
  shipping?: number;
  /** ส่วนลด/โค้ดระดับออเดอร์ (เลขบวก) */
  discount?: number;
  grandTotal?: number;
}

/**
 * ค่าส่ง/ส่วนลดระดับออเดอร์ที่ **ไม่ได้อยู่ในราคาสินค้า** — `/summary` เคยมองข้ามเงินก้อนนี้ไปทั้งหมด
 * เพราะรวมยอดจากจุดราคาของสินค้าล้วนๆ ยอด "จ่ายไปแล้ว" เลยต่ำกว่าเงินที่ออกจากกระเป๋าจริง
 *
 * ทั้งหมดเป็น best-effort จากป้ายบนหน้าออเดอร์ — ผู้ใช้แก้ตัวเลขเองได้ในหน้ารีวิวก่อนนำเข้า
 */
export function extractCharges(text: string, labels: ChargeLabels): OrderCharges {
  const shipRaw = labelMoney(text, labels.shipping);
  const shipDiscount = labelMoney(text, labels.shipDiscount);
  return {
    goodsSubtotal: labelMoney(text, labels.subtotal),
    shipping: shipRaw == null ? undefined : Math.max(0, shipRaw - (shipDiscount ?? 0)),
    discount: labelMoney(text, labels.discount),
    grandTotal: labelMoney(text, labels.total),
  };
}

/* ------------------------------------------------------------------ วันที่ */

export type DateFormat = "datetime" | "dmy" | "iso" | "thai" | "english";

/** ปี พ.ศ. → ค.ศ. — 2400+ ไม่มีทางเป็น ค.ศ. ของออเดอร์จริง */
const toAD = (y: number) => (y > 2400 ? y - 543 : y);

const pad = (n: number) => String(n).padStart(2, "0");

function isoOf(y: number, m: number, d: number): string | null {
  const year = toAD(y);
  if (m < 1 || m > 12 || d < 1 || d > 31 || year < 2000 || year > 2100) return null;
  return `${year}-${pad(m)}-${pad(d)}`;
}

const TH_MONTHS: [string, string][] = [
  ["มกราคม", "มค"], ["กุมภาพันธ์", "กพ"], ["มีนาคม", "มีค"], ["เมษายน", "เมย"],
  ["พฤษภาคม", "พค"], ["มิถุนายน", "มิย"], ["กรกฎาคม", "กค"], ["สิงหาคม", "สค"],
  ["กันยายน", "กย"], ["ตุลาคม", "ตค"], ["พฤศจิกายน", "พย"], ["ธันวาคม", "ธค"],
];
const TH_MONTH_INDEX = new Map<string, number>();
TH_MONTHS.forEach(([full, abbr], i) => {
  TH_MONTH_INDEX.set(full, i + 1);
  TH_MONTH_INDEX.set(abbr, i + 1);
});
/** ตัวย่อไทยเขียนได้ทั้ง "ส.ค." และ "สค" — เทียบโดยตัดจุดทิ้ง (ชื่อเต็มต้องมาก่อน ไม่งั้นตัวย่อกินไปครึ่งคำ) */
const TH_MONTH_RE = TH_MONTHS.map(([full, abbr]) => `${full}|${abbr.split("").join("\\.?")}\\.?`).join("|");

const EN_MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const EN_MONTH_RE = EN_MONTHS.map((m) => `${m}[a-z]*`).join("|");

const enMonthIndex = (s: string) => EN_MONTHS.indexOf(s.slice(0, 3).toLowerCase()) + 1;

function collectDates(text: string, format: DateFormat, out: string[]) {
  const push = (y: number, m: number, d: number) => {
    const iso = isoOf(y, m, d);
    if (iso) out.push(iso);
  };
  if (format === "datetime") {
    // "18-08-2019 16:57" ของแถบสถานะออเดอร์ Shopee
    for (const m of text.matchAll(/\b(\d{2})-(\d{2})-(\d{4})\s+\d{1,2}:\d{2}\b/g)) push(+m[3], +m[2], +m[1]);
  } else if (format === "dmy") {
    for (const m of text.matchAll(/\b(\d{1,2})[/-](\d{1,2})[/-](\d{4})\b/g)) push(+m[3], +m[2], +m[1]);
  } else if (format === "iso") {
    for (const m of text.matchAll(/\b(\d{4})-(\d{2})-(\d{2})\b/g)) push(+m[1], +m[2], +m[3]);
  } else if (format === "thai") {
    for (const m of text.matchAll(new RegExp(String.raw`(\d{1,2})\s*(${TH_MONTH_RE})\s*(\d{4})`, "g"))) {
      const month = TH_MONTH_INDEX.get(m[2].replace(/\./g, ""));
      if (month) push(+m[3], month, +m[1]);
    }
  } else {
    const en = new RegExp(
      String.raw`\b(?:(\d{1,2})\s+(${EN_MONTH_RE})|(${EN_MONTH_RE})\s+(\d{1,2}))\.?,?\s+(\d{4})\b`,
      "gi"
    );
    for (const m of text.matchAll(en)) {
      const day = m[1] ?? m[4];
      const month = enMonthIndex(m[2] ?? m[3]);
      if (month > 0) push(+m[5], month, +day);
    }
  }
}

/** ป้ายที่บอกวันสั่งซื้อตรงๆ — เชื่อถือได้กว่าการเดาจากวันที่ทั้งหน้า */
const ORDER_DATE_LABEL = /(?:สั่งซื้อเมื่อ|วันที่สั่งซื้อ|วันที่ทำรายการ|order (?:date|placed)|placed on)[ :：]*/i;

/** ช่วงข้อความหลังป้ายที่ยอมให้ไปหาวันที่ (พอสำหรับ "10 ธ.ค. 2018 10:40:36") */
const LABEL_WINDOW = 40;

function dateNearLabel(text: string, formats: DateFormat[]): string | undefined {
  const m = text.match(ORDER_DATE_LABEL);
  if (!m || m.index == null) return undefined;
  const start = m.index + m[0].length;
  const dates: string[] = [];
  for (const f of formats) collectDates(text.slice(start, start + LABEL_WINDOW), f, dates);
  return dates.sort()[0];
}

/**
 * วันที่สั่งซื้อจากหน้าออเดอร์ — เอา**ตัวที่เก่าสุด**ที่เจอ เพราะทุกอย่างบนหน้า
 * (จ่ายเงิน / ส่งของ / รับของ / กำหนดส่ง) เกิดหลังวันสั่งซื้อเสมอ
 *
 * จับจาก pattern ของวันที่ตรงๆ ไม่พึ่งชื่อ class เพราะร้านพวกนี้สุ่มชื่อ class กันหมด
 */
export function extractOrderDate(text: string, formats: DateFormat[]): string | undefined {
  // มีป้ายบอกตรงๆ ก็ไม่ต้องเดา — หัวเว็บของ Lazada มีลิสต์ "คำสั่งซื้อล่าสุดของฉัน" ของออเดอร์อื่นติดมาด้วย
  // ซึ่งอาจเก่ากว่าออเดอร์ที่กำลังดูอยู่ แล้วกติกา "เก่าสุด" จะหยิบวันของออเดอร์อื่นไปแทน
  const labelled = dateNearLabel(text, formats);
  if (labelled) return labelled;
  const dates: string[] = [];
  for (const f of formats) collectDates(text, f, dates);
  if (dates.length === 0) return undefined;
  return dates.sort()[0];
}

/* ------------------------------------------------------ จำนวน / ชื่อสินค้า */

/**
 * ข้อความที่เป็น "ป้ายกำกับ" เปล่าๆ เช่น "จำนวน :" — ค่าจริงอยู่ใน element ถัดไป
 * ต้องคัดทิ้งก่อนเดาชื่อสินค้า ไม่งั้นป้ายพวกนี้จะไปโผล่เป็นแท็กรองของทุกแถว
 */
export function isLabelOnly(t: string): boolean {
  return /[:：]\s*$/.test(t);
}

/** จำนวนจากข้อความใบสุดท้ายที่ "เป็นจำนวนล้วนๆ" เช่น "x2", "จำนวน: 2", "Qty 2", "2 ชิ้น" */
export function parseQtyLeaf(t: string): number | undefined {
  const m =
    t.match(/^x\s?(\d+)$/i) ||
    t.match(/^(?:จำนวน|qty|quantity)\s*[:：]?\s*(\d+)(?:\s*(?:ชิ้น|อัน|ea|pcs?))?$/i) ||
    t.match(/^(\d+)\s*(?:ชิ้น|อัน|ea|pcs?)$/i);
  return m ? parseInt(m[1], 10) : undefined;
}

/** จำนวนจากข้อความทั้งแถว — ใช้ต่อเมื่อหาแบบใบสุดท้ายไม่เจอ (บางร้านวางจำนวนปนกับข้อความอื่น) */
export function parseQtyLoose(text: string): number | undefined {
  const m = text.match(/(?:จำนวน|qty|quantity)\s*[:：]?\s*(\d+)/i) || text.match(/\bx\s?(\d+)\b/);
  return m ? parseInt(m[1], 10) : undefined;
}

/** ราคาจากข้อความใบสุดท้ายที่เป็นราคาล้วนๆ (ไม่ใช่ประโยคที่บังเอิญมีตัวเลข) */
export function parsePriceLeaf(t: string): number | undefined {
  const exact = t.match(new RegExp(`^${MONEY}$`));
  if (exact) return moneyOf(exact);
  // หน้าออเดอร์บางที่ห้อยข้อความต่อท้ายราคา ("฿54 /ชิ้น") — ยอมรับแบบขึ้นต้นด้วยราคาด้วย
  // ต้องรับคอมมา ไม่งั้น "฿1,980" จะแกะได้แค่ "1" แล้วของแพงทุกชิ้นกลายเป็นราคา 1 บาท
  const prefixed = t.match(new RegExp(String.raw`^฿\s?-?\s?(${AMOUNT})`));
  return prefixed ? Number(prefixed[1].replace(/,/g, "")) : undefined;
}

/** บรรทัดตัวเลือกสินค้าที่หน้าเว็บระบุป้ายไว้ชัดๆ */
const VARIANT_LINE = /^(?:ตัวเลือกสินค้า|ตัวเลือก|สี|รุ่น|variation|variant|option)\s*[:：]\s*(.+)$/i;
/** ป้ายทั่วไปที่ไม่ใช่ทั้งชื่อและตัวเลือก */
const GENERIC_BADGE =
  /^(pre-?order|พรีออเดอร์|พร้อมส่ง|in\s?stock|ของแถม|ฟรี|แถม|โปรโมชั่น|get\s?\d*|free\s?gift)$/i;

const UNIT = "ซม\\.?|เซนติเมตร|cm|มม\\.?|มิลลิเมตร|mm|มล\\.?|มิลลิลิตร|ml|ลิตร|l|กก\\.?|กิโลกรัม|kg|กรัม|g";
const DIM = "\\d+(?:\\.\\d+)?(?:\\s?[x×]\\s?\\d+(?:\\.\\d+)?)?";
const SIZE_HINT = new RegExp(
  `(?:ไซส์|ไซซ์|ขนาด|size)[:\\s]*([a-zA-Z0-9x×.\\-]+(?:\\s?(?:${UNIT}))?)|^(XXS|XS|S|M|L|XL|XXL|XXXL|${DIM}\\s?(?:${UNIT}))$`,
  "i"
);

export interface ParsedProductText {
  name: string;
  size?: string;
  variant?: string;
}

/**
 * เดาว่าข้อความก้อนไหนในแถวคือ **ชื่อสินค้า / ขนาด / ตัวเลือก**
 *
 * บรรทัดตัวเลือกสินค้าบอกตัวเองอยู่แล้ว ("ตัวเลือกสินค้า: กลิ่น Peppermint") ต้องดึงออกก่อนเดาชื่อ
 * ไม่งั้นเวลาสินค้าชื่อสั้นกว่าบรรทัดนี้ กติกา "ยาวสุดคือชื่อ" จะหยิบตัวเลือกไปเป็นชื่อสินค้าแทน
 * แล้วได้การ์ดชื่อ "ตัวเลือกสินค้า: ..." เต็มไปหมด — คืน `null` เมื่อมีแต่บรรทัดตัวเลือก (ไม่รู้ชื่อสินค้า)
 */
export function parseProductText(textCandidates: string[]): ParsedProductText | null {
  let labelledVariant: string | undefined;
  const nameCandidates: string[] = [];
  for (const t of textCandidates) {
    const m = t.match(VARIANT_LINE);
    if (m && !labelledVariant) labelledVariant = m[1].trim();
    else if (!m) nameCandidates.push(t);
  }
  if (nameCandidates.length === 0) return null;

  // ชื่อสินค้าจริงมักเป็นข้อความที่ยาวที่สุด (ป้ายอื่นๆ เช่น "Pre-Order" จะสั้นกว่า)
  let name = nameCandidates[0];
  for (const t of nameCandidates) if (t.length > name.length) name = t;
  name = name.slice(0, 150);

  // ข้อความอื่นที่เหลือ (ไม่ใช่ชื่อ) เก็บไว้เป็นแท็กรอง เช่น รุ่น/สี
  const otherCandidates = nameCandidates.filter((t) => t !== name && !GENERIC_BADGE.test(t));

  let size: string | undefined;
  const remaining: string[] = [];
  for (const t of otherCandidates) {
    const m = !size && t.match(SIZE_HINT);
    if (m) size = (m[1] || m[2]).trim();
    else remaining.push(t);
  }
  // ชื่อสินค้าเองก็มักฝังไซส์ไว้กลางข้อความ เช่น "...มาการอง 4มม. สำหรับ..." — หาแบบไม่ยึดขอบข้อความ
  if (!size) {
    const inName = name.match(new RegExp(`(${DIM})\\s?(${UNIT})`, "i"));
    if (inName) size = `${inName[1]}${inName[2]}`;
  }
  // ตัวเลือกที่หน้าเว็บระบุป้ายไว้ชัดๆ เชื่อถือได้กว่าการเดาจากข้อความที่เหลือ
  const variant = (labelledVariant ?? remaining[remaining.length - 1])?.slice(0, 80);
  return { name, size, variant };
}

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
