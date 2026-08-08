/**
 * วิเคราะห์ส่วนผสม (INCI) แบบออฟไลน์ล้วน — ไม่มี backend/ไม่ยิง API ใดๆ
 * ตารางข้อมูลด้านล่างเป็นข้อมูลคร่าวๆ ที่เขียนไว้ในโค้ด ใช้ช่วยอ่านฉลากเท่านั้น ไม่ใช่คำแนะนำทางการแพทย์
 */

export type IngredientTag =
  | "retinoid"
  | "aha"
  | "bha"
  | "vitc"
  | "niacinamide"
  | "benzoyl-peroxide"
  | "peptide"
  | "humectant"
  | "emollient"
  | "occlusive"
  | "silicone"
  | "soothing"
  | "uv-filter"
  | "oil"
  | "alcohol"
  | "fragrance"
  | "essential-oil"
  | "sulfate"
  | "preservative"
  | "comedogenic"
  | "colorant"
  | "solvent";

export type TagLevel = "good" | "neutral" | "caution";

export const TAG_META: Record<IngredientTag, { label: string; emoji: string; level: TagLevel }> = {
  retinoid: { label: "เรตินอยด์", emoji: "🌙", level: "good" },
  aha: { label: "AHA (ผลัดผิว)", emoji: "🍋", level: "good" },
  bha: { label: "BHA (ผลัดผิว)", emoji: "🧪", level: "good" },
  vitc: { label: "วิตามินซี", emoji: "🍊", level: "good" },
  niacinamide: { label: "ไนอาซินาไมด์", emoji: "🧴", level: "good" },
  "benzoyl-peroxide": { label: "เบนโซอิลเปอร์ออกไซด์", emoji: "⚗️", level: "good" },
  peptide: { label: "เปปไทด์", emoji: "🧬", level: "good" },
  humectant: { label: "ดึงน้ำเข้าผิว", emoji: "💧", level: "good" },
  emollient: { label: "ให้ความนุ่ม", emoji: "🧈", level: "neutral" },
  occlusive: { label: "เคลือบกักน้ำ", emoji: "🛡️", level: "neutral" },
  silicone: { label: "ซิลิโคน", emoji: "✨", level: "neutral" },
  soothing: { label: "ปลอบผิว", emoji: "🌿", level: "good" },
  "uv-filter": { label: "กันแดด", emoji: "☀️", level: "good" },
  oil: { label: "น้ำมัน", emoji: "🫒", level: "neutral" },
  alcohol: { label: "แอลกอฮอล์", emoji: "⚠️", level: "caution" },
  fragrance: { label: "น้ำหอม", emoji: "🌸", level: "caution" },
  "essential-oil": { label: "น้ำมันหอมระเหย", emoji: "🌱", level: "caution" },
  sulfate: { label: "สารทำความสะอาดแรง", emoji: "🫧", level: "caution" },
  preservative: { label: "สารกันเสีย", emoji: "🧫", level: "neutral" },
  comedogenic: { label: "เสี่ยงอุดตัน", emoji: "🔴", level: "caution" },
  colorant: { label: "สี", emoji: "🎨", level: "neutral" },
  solvent: { label: "ตัวทำละลาย/เบส", emoji: "🥤", level: "neutral" },
};

/** แท็กที่ควรโชว์ก่อนบนการ์ด/สรุป (เรียงจากสำคัญไปน้อย) */
export const TAG_PRIORITY: IngredientTag[] = [
  "retinoid", "aha", "bha", "vitc", "niacinamide", "benzoyl-peroxide", "peptide",
  "uv-filter", "alcohol", "fragrance", "essential-oil", "sulfate", "comedogenic",
  "soothing", "humectant", "occlusive", "emollient", "silicone", "oil",
  "preservative", "colorant", "solvent",
];

export interface IngredientDef {
  /** ชื่อ INCI มาตรฐานที่ใช้แสดง */
  inci: string;
  /** ชื่อไทย/ชื่อที่คนเรียกกันทั่วไป */
  th?: string;
  tags: IngredientTag[];
  /** รูปแบบชื่อที่ใช้จับในลิสต์ (เทียบกับชื่อที่ normalize แล้ว) */
  match: RegExp;
  note?: string;
}

const d = (inci: string, th: string, tags: IngredientTag[], match: RegExp, note?: string): IngredientDef =>
  ({ inci, th, tags, match, note });

/**
 * ตารางส่วนผสมออฟไลน์ — ครอบคลุมตัวที่เจอบ่อยในสกินแคร์/เครื่องสำอาง
 * regex เทียบกับชื่อที่ normalize แล้ว (พิมพ์เล็ก, ตัดวงเล็บ/เครื่องหมายออกเหลือช่องว่าง)
 */
export const INGREDIENT_DB: IngredientDef[] = [
  // ── เบส/ตัวทำละลาย ──────────────────────────────────────────
  d("Water", "น้ำ", ["solvent"], /^(aqua|water|eau|purified water|aqua water|water aqua|aqua water eau)$/),
  d("Glycerin", "กลีเซอรีน", ["humectant"], /^glycerin(e)?$/),
  d("Butylene Glycol", "บิวทิลีนไกลคอล", ["humectant", "solvent"], /^butylene glycol$/),
  d("Propanediol", "โพรเพนไดออล", ["humectant", "solvent"], /^(propanediol|1 3 propanediol)$/),
  d("Pentylene Glycol", "เพนทิลีนไกลคอล", ["humectant", "preservative"], /^pentylene glycol$/),
  d("Propylene Glycol", "โพรพิลีนไกลคอล", ["humectant", "solvent"], /^propylene glycol$/),
  d("Dipropylene Glycol", "ไดโพรพิลีนไกลคอล", ["humectant", "solvent"], /^dipropylene glycol$/),

  // ── สารดึงน้ำ/ฟื้นเกราะผิว ──────────────────────────────────
  d("Hyaluronic Acid", "ไฮยาลูรอน", ["humectant"], /(hyaluronic acid|hyaluronate|hyaluron)/),
  d("Panthenol", "แพนทีนอล (B5)", ["humectant", "soothing"], /^(d )?panthenol$|^provitamin b5$/),
  d("Betaine", "เบทาอีน", ["humectant"], /^betaine$/),
  d("Urea", "ยูเรีย", ["humectant"], /^urea$/),
  d("Trehalose", "ทรีฮาโลส", ["humectant"], /^trehalose$/),
  d("Sodium PCA", "โซเดียมพีซีเอ", ["humectant"], /^sodium pca$/),
  d("Ceramide", "เซราไมด์", ["emollient", "occlusive"], /ceramide/),
  d("Cholesterol", "คอเลสเตอรอล", ["emollient"], /^cholesterol$/),
  d("Squalane", "สควาเลน", ["emollient"], /^(squalane|olive squalane)$/),
  d("Squalene", "สควาลีน", ["emollient", "comedogenic"], /^squalene$/),

  // ── Actives ─────────────────────────────────────────────────
  d("Retinol", "เรตินอล", ["retinoid"], /^retinol$/),
  d("Retinal", "เรตินัล", ["retinoid"], /^(retinal|retinaldehyde)$/),
  d("Retinyl Palmitate", "เรตินิลปาล์มิเตท", ["retinoid"], /^retinyl (palmitate|acetate|propionate)$/),
  d("Hydroxypinacolone Retinoate", "กราโนแอกทีฟเรตินอยด์", ["retinoid"], /^(hydroxypinacolone retinoate|granactive retinoid)$/),
  d("Adapalene", "อะดาพาลีน", ["retinoid"], /^adapalene$/),
  d("Tretinoin", "เตรทติโนอิน", ["retinoid"], /^(tretinoin|all trans retinoic acid)$/),
  d("Bakuchiol", "บาคูชิออล", ["retinoid", "soothing"], /^bakuchiol$/, "ทางเลือกอ่อนโยนแทนเรตินอล"),

  d("Glycolic Acid", "กรดไกลโคลิก", ["aha"], /^glycolic acid$/),
  d("Lactic Acid", "กรดแลคติก", ["aha", "humectant"], /^lactic acid$/),
  d("Mandelic Acid", "กรดแมนดีลิก", ["aha"], /^mandelic acid$/),
  d("Malic Acid", "กรดมาลิก", ["aha"], /^malic acid$/),
  d("Tartaric Acid", "กรดทาร์ทาริก", ["aha"], /^tartaric acid$/),
  d("Citric Acid", "กรดซิตริก", ["aha"], /^citric acid$/, "ส่วนใหญ่ใส่มาปรับ pH ปริมาณน้อย"),
  d("Salicylic Acid", "กรดซาลิไซลิก (BHA)", ["bha"], /^salicylic acid$/),
  d("Betaine Salicylate", "เบทาอีนซาลิไซเลต", ["bha"], /^betaine salicylate$/),
  d("Willow Bark Extract", "สารสกัดเปลือกวิลโลว์", ["bha", "soothing"], /salix|willow bark/),
  d("Azelaic Acid", "กรดอะซีลาอิก", ["soothing"], /^azelaic acid$/),
  d("Benzoyl Peroxide", "เบนโซอิลเปอร์ออกไซด์", ["benzoyl-peroxide"], /^benzoyl peroxide$/),

  d("Ascorbic Acid", "วิตามินซีบริสุทธิ์", ["vitc"], /^(l )?ascorbic acid$/),
  d("Sodium Ascorbyl Phosphate", "อนุพันธ์วิตามินซี", ["vitc"], /(ascorbyl|ascorbate)/),
  d("Niacinamide", "ไนอาซินาไมด์ (B3)", ["niacinamide", "soothing"], /^(niacinamide|nicotinamide)$/),
  d("Tranexamic Acid", "กรดทราเนซามิก", ["soothing"], /^tranexamic acid$/),
  d("Arbutin", "อาร์บูติน", ["soothing"], /arbutin/),
  d("Kojic Acid", "กรดโคจิก", ["soothing"], /^kojic acid$/),
  d("Alpha Arbutin", "แอลฟาอาร์บูติน", ["soothing"], /^alpha arbutin$/),

  d("Peptide", "เปปไทด์", ["peptide"], /(peptide|palmitoyl tri|palmitoyl tetra|acetyl hexapeptide|matrixyl|argireline)/),
  d("Adenosine", "อะดีโนซีน", ["peptide"], /^adenosine$/),

  // ── ปลอบผิว/สารสกัด ────────────────────────────────────────
  d("Centella Asiatica", "ใบบัวบก", ["soothing"], /(centella|madecassoside|asiaticoside|madecassic|asiatic acid)/),
  d("Allantoin", "อัลลันโทอิน", ["soothing"], /^allantoin$/),
  d("Bisabolol", "บิสซาโบลอล", ["soothing"], /bisabolol/),
  d("Aloe", "ว่านหางจระเข้", ["soothing", "humectant"], /aloe/),
  d("Green Tea", "ชาเขียว", ["soothing"], /(camellia sinensis|green tea|egcg)/),
  d("Licorice Root", "ชะเอมเทศ", ["soothing"], /(glycyrrhiza|licorice|dipotassium glycyrrhizate)/),
  d("Oat", "ข้าวโอ๊ต", ["soothing"], /avena sativa|colloidal oat/),
  d("Beta-Glucan", "เบต้ากลูแคน", ["soothing", "humectant"], /glucan/),
  d("Vitamin E", "วิตามินอี", ["emollient", "soothing"], /^(tocopherol|tocopheryl acetate|vitamin e)$/),

  // ── น้ำมัน/ไข/เคลือบผิว ─────────────────────────────────────
  d("Jojoba Oil", "น้ำมันโจโจบา", ["oil", "emollient"], /simmondsia|jojoba/),
  d("Argan Oil", "น้ำมันอาร์แกน", ["oil", "emollient"], /argania|argan/),
  d("Rosehip Oil", "น้ำมันโรสฮิป", ["oil", "emollient"], /rosa canina|rosehip/),
  d("Sunflower Oil", "น้ำมันทานตะวัน", ["oil", "emollient"], /helianthus/),
  d("Shea Butter", "เชียบัตเตอร์", ["emollient", "occlusive"], /butyrospermum|shea butter/),
  d("Coconut Oil", "น้ำมันมะพร้าว", ["oil", "emollient", "comedogenic"], /cocos nucifera oil|coconut oil/),
  d("Cocoa Butter", "โกโก้บัตเตอร์", ["occlusive", "comedogenic"], /theobroma cacao/),
  d("Isopropyl Myristate", "ไอโซโพรพิลไมริสเตต", ["emollient", "comedogenic"], /^isopropyl (myristate|palmitate|isostearate)$/),
  d("Petrolatum", "ปิโตรเลียมเจลลี่", ["occlusive"], /^(petrolatum|paraffinum liquidum|mineral oil)$/),
  d("Lanolin", "ลาโนลิน", ["occlusive", "emollient"], /lanolin/),
  d("Beeswax", "ไขผึ้ง", ["occlusive"], /(cera alba|beeswax)/),
  d("Dimethicone", "ไดเมทิโคน", ["silicone", "occlusive"], /^dimethicone/),
  d("Cyclopentasiloxane", "ไซโคลเพนตะไซลอกเซน", ["silicone"], /(siloxane|silicone crosspolymer|cyclomethicone)/),

  // ── กันแดด ──────────────────────────────────────────────────
  d("Zinc Oxide", "ซิงค์ออกไซด์", ["uv-filter"], /^zinc oxide$/),
  d("Titanium Dioxide", "ไทเทเนียมไดออกไซด์", ["uv-filter", "colorant"], /^(titanium dioxide|ci 77891)$/),
  d("Avobenzone", "อะโวเบนโซน", ["uv-filter"], /^(avobenzone|butyl methoxydibenzoylmethane)$/),
  d("Octinoxate", "อ็อกทิน็อกเซท", ["uv-filter"], /^(octinoxate|ethylhexyl methoxycinnamate)$/),
  d("Octocrylene", "อ็อกโทคริลีน", ["uv-filter"], /^octocrylene$/),
  d("Tinosorb", "ทิโนซอร์บ", ["uv-filter"], /(bemotrizinol|bisoctrizole|methylene bis benzotriazolyl|bis ethylhexyloxyphenol)/),
  d("Uvinul A Plus", "ยูวินูลเอพลัส", ["uv-filter"], /(diethylamino hydroxybenzoyl|uvinul)/),
  d("Homosalate", "โฮโมซาเลต", ["uv-filter"], /^(homosalate|ethylhexyl salicylate|octisalate)$/),

  // ── สารทำความสะอาด ──────────────────────────────────────────
  d("Sodium Lauryl Sulfate", "SLS", ["sulfate"], /^sodium (lauryl|laureth|myreth) sulfate$/),
  d("Ammonium Lauryl Sulfate", "ALS", ["sulfate"], /^ammonium (lauryl|laureth) sulfate$/),
  d("Cocamidopropyl Betaine", "โคคามิโดโพรพิลเบทาอีน", ["solvent"], /^cocamidopropyl betaine$/),
  d("Coco-Glucoside", "โคโค-กลูโคไซด์", ["solvent"], /glucoside$/),

  // ── สารกันเสีย ──────────────────────────────────────────────
  d("Phenoxyethanol", "ฟีน็อกซีเอทานอล", ["preservative"], /^phenoxyethanol$/),
  d("Ethylhexylglycerin", "เอทิลเฮกซิลกลีเซอริน", ["preservative"], /^ethylhexylglycerin$/),
  d("Paraben", "พาราเบน", ["preservative"], /paraben$/),
  d("Chlorphenesin", "คลอร์ฟีนีซิน", ["preservative"], /^chlorphenesin$/),
  d("Sodium Benzoate", "โซเดียมเบนโซเอต", ["preservative"], /^(sodium benzoate|potassium sorbate|benzoic acid|sorbic acid)$/),
  d("Methylisothiazolinone", "MIT", ["preservative", "comedogenic"], /isothiazolinone/, "เป็นสารก่อภูมิแพ้ผิวหนังที่พบบ่อย"),

  // ── ตัวที่ควรระวัง ──────────────────────────────────────────
  d("Alcohol Denat.", "แอลกอฮอล์ (ระเหย)", ["alcohol"], /^(alcohol denat|denatured alcohol|sd alcohol( \d+)?|ethanol|alcohol)$/, "ทำให้ผิวแห้ง/ระคายเคืองถ้าอยู่ต้นๆ ลิสต์"),
  d("Isopropyl Alcohol", "ไอโซโพรพิลแอลกอฮอล์", ["alcohol"], /^isopropyl alcohol$/),
  d("Fragrance", "น้ำหอม", ["fragrance"], /^(fragrance|parfum|perfume|aroma|fragrance parfum|parfum fragrance)$/),
  d("Linalool", "ลินาลูล", ["fragrance"], /^(linalool|limonene|geraniol|citronellol|eugenol|coumarin|benzyl benzoate|benzyl salicylate|hexyl cinnamal|citral)$/, "สารก่อภูมิแพ้ในน้ำหอมที่ EU บังคับให้ระบุ"),
  d("Lavender Oil", "น้ำมันลาเวนเดอร์", ["essential-oil", "fragrance"], /lavandula/),
  d("Tea Tree Oil", "น้ำมันที่ทรี", ["essential-oil"], /melaleuca/),
  d("Peppermint Oil", "น้ำมันเปเปอร์มินต์", ["essential-oil"], /mentha (piperita|arvensis)|peppermint/),
  d("Citrus Peel Oil", "น้ำมันเปลือกส้ม", ["essential-oil", "fragrance"], /citrus .*(peel oil|oil)/),
  d("Eucalyptus Oil", "น้ำมันยูคาลิปตัส", ["essential-oil"], /eucalyptus/),
  d("Menthol", "เมนทอล", ["essential-oil"], /^(menthol|camphor)$/),
  d("Witch Hazel", "วิชฮาเซล", ["essential-oil", "soothing"], /hamamelis/),
  d("Colorant", "สีสังเคราะห์", ["colorant"], /^ci \d{5}$/),
  d("Mica", "ไมก้า", ["colorant"], /^(mica|iron oxides)$/),
];

/** ตัดวงเล็บ/เครื่องหมาย/เปอร์เซ็นต์ออก เหลือชื่อล้วนพิมพ์เล็ก ใช้เทียบกับ regex ในตาราง */
function normalize(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/\d+(\.\d+)?\s*%/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export interface ParsedIngredient {
  /** ข้อความดิบตามที่ผู้ใช้วางมา */
  raw: string;
  /** ชื่อที่ normalize แล้ว ใช้เทียบ/หาซ้ำระหว่างสินค้า */
  key: string;
  /** เปอร์เซ็นต์ที่ระบุมาในฉลาก (ถ้ามี) */
  pct?: number;
  defs: IngredientDef[];
  tags: IngredientTag[];
}

/**
 * แยกลิสต์ส่วนผสมจากข้อความที่วางมา — รองรับทั้งคั่นด้วย , ; • · | และขึ้นบรรทัดใหม่
 * ตัดหัวข้อนำอย่าง "Ingredients:" / "ส่วนผสม:" ทิ้งให้ด้วย
 */
export function parseIngredients(text: string): ParsedIngredient[] {
  const body = text.replace(/^[\s\S]*?(?:ingredients?|ส่วนผสม|ส่วนประกอบ)\s*[:：]/i, "");
  const seen = new Set<string>();
  const out: ParsedIngredient[] = [];

  for (const chunk of body.split(/[,;•·|\n\r]+/)) {
    const raw = chunk.replace(/\s+/g, " ").replace(/^[\s.*\-–]+|[\s.*\-–]+$/g, "").trim();
    if (!raw || raw.length > 120) continue;
    const key = normalize(raw);
    if (!key || seen.has(key)) continue;
    seen.add(key);

    const pctMatch = raw.match(/(\d+(?:\.\d+)?)\s*%/);
    const defs = INGREDIENT_DB.filter((def) => def.match.test(key));
    out.push({
      raw,
      key,
      pct: pctMatch ? parseFloat(pctMatch[1]) : undefined,
      defs,
      tags: [...new Set(defs.flatMap((def) => def.tags))],
    });
  }
  return out;
}

export type WarnLevel = "warn" | "info";

export interface IngredientWarning {
  id: string;
  level: WarnLevel;
  title: string;
  detail: string;
  /** ชื่อส่วนผสม (หรือ "สินค้า → ส่วนผสม" ตอนเทียบข้ามสินค้า) ที่ทำให้เกิดคำเตือนนี้ */
  culprits: string[];
}

interface ConflictRule {
  id: string;
  a: IngredientTag;
  b: IngredientTag;
  level: WarnLevel;
  title: string;
  detail: string;
}

/** กฎ "ตัวที่ไม่ควรใช้พร้อมกัน" — อิงแท็ก ไม่ใช่ชื่อเฉพาะ จะได้ครอบคลุมอนุพันธ์ด้วย */
export const CONFLICT_RULES: ConflictRule[] = [
  {
    id: "retinoid-aha", a: "retinoid", b: "aha", level: "warn",
    title: "เรตินอยด์ + AHA",
    detail: "ใช้พร้อมกันเสี่ยงผิวแสบแดง/ลอก แนะนำสลับวันหรือแยกเช้า-เย็น",
  },
  {
    id: "retinoid-bha", a: "retinoid", b: "bha", level: "warn",
    title: "เรตินอยด์ + BHA",
    detail: "ระคายเคืองรวมกันได้มาก ถ้าผิวยังไม่ชินให้สลับวันใช้",
  },
  {
    id: "retinoid-bp", a: "retinoid", b: "benzoyl-peroxide", level: "warn",
    title: "เรตินอยด์ + เบนโซอิลเปอร์ออกไซด์",
    detail: "BP ทำให้เรตินอยด์บางตัวเสื่อมฤทธิ์ และรวมกันแล้วผิวแห้งลอกง่าย — แยกเช้า/เย็น",
  },
  {
    id: "vitc-bp", a: "vitc", b: "benzoyl-peroxide", level: "warn",
    title: "วิตามินซี + เบนโซอิลเปอร์ออกไซด์",
    detail: "BP ออกซิไดซ์วิตามินซีจนแทบไม่เหลือฤทธิ์ ไม่ควรทาต่อกัน",
  },
  {
    id: "vitc-aha", a: "vitc", b: "aha", level: "info",
    title: "วิตามินซี + AHA",
    detail: "ทั้งคู่เป็นกรด ใช้ซ้อนกันอาจแสบ — ถ้าผิวบางให้เลือกใช้ทีละอย่าง",
  },
  {
    id: "vitc-retinoid", a: "vitc", b: "retinoid", level: "info",
    title: "วิตามินซี + เรตินอยด์",
    detail: "ใช้ได้แต่คนละเวลาจะดีกว่า — วิตามินซีตอนเช้า เรตินอยด์ตอนกลางคืน",
  },
  {
    id: "vitc-niacinamide", a: "vitc", b: "niacinamide", level: "info",
    title: "วิตามินซี + ไนอาซินาไมด์",
    detail: "งานวิจัยใหม่บอกว่าใช้ร่วมกันได้ปกติ แต่บางคนอาจรู้สึกหน้าแดงชั่วคราว",
  },
  {
    id: "aha-bha", a: "aha", b: "bha", level: "info",
    title: "AHA + BHA",
    detail: "ผลัดผิวซ้อนกัน ถ้าใช้บ่อยเกินไปเกราะผิวจะพัง — ไม่ควรเกิน 2-3 ครั้ง/สัปดาห์",
  },
  {
    id: "retinoid-alcohol", a: "retinoid", b: "alcohol", level: "info",
    title: "เรตินอยด์ + แอลกอฮอล์",
    detail: "แอลกอฮอล์ทำให้ผิวแห้งขึ้นอีก ระหว่างช่วงปรับตัวกับเรตินอยด์ควรเลี่ยง",
  },
  {
    id: "aha-fragrance", a: "aha", b: "fragrance", level: "info",
    title: "ผลัดผิว + น้ำหอม",
    detail: "หลังผลัดผิวเกราะผิวบางลง น้ำหอม/น้ำมันหอมระเหยจะระคายเคืองง่ายกว่าปกติ",
  },
  {
    id: "retinoid-essential-oil", a: "retinoid", b: "essential-oil", level: "info",
    title: "เรตินอยด์ + น้ำมันหอมระเหย",
    detail: "รวมกันแล้วเสี่ยงผื่นแพ้สัมผัสในคนผิวแพ้ง่าย",
  },
];

export interface IngredientAnalysis {
  /** ส่วนผสมทั้งหมดที่แยกได้ */
  list: ParsedIngredient[];
  /** เฉพาะตัวที่มีในตาราง */
  known: ParsedIngredient[];
  /** ตัวที่ตารางยังไม่รู้จัก */
  unknown: ParsedIngredient[];
  tags: IngredientTag[];
  tagCounts: Record<string, number>;
  warnings: IngredientWarning[];
}

export const EMPTY_ANALYSIS: IngredientAnalysis = {
  list: [], known: [], unknown: [], tags: [], tagCounts: {}, warnings: [],
};

function sortTags(tags: Iterable<IngredientTag>): IngredientTag[] {
  return [...new Set(tags)].sort((a, b) => TAG_PRIORITY.indexOf(a) - TAG_PRIORITY.indexOf(b));
}

/** หาคู่ที่ตีกันจากชุดส่วนผสม — คืนคำเตือนพร้อมชื่อตัวที่เป็นเหตุ (labelOf ใช้เติมชื่อสินค้านำหน้าตอนเทียบข้ามสินค้า) */
function findConflicts(
  list: ParsedIngredient[],
  labelOf: (p: ParsedIngredient) => string
): IngredientWarning[] {
  const byTag = new Map<IngredientTag, ParsedIngredient[]>();
  for (const p of list) {
    for (const t of p.tags) {
      if (!byTag.has(t)) byTag.set(t, []);
      byTag.get(t)!.push(p);
    }
  }
  return CONFLICT_RULES.flatMap((rule) => {
    const a = byTag.get(rule.a);
    const b = byTag.get(rule.b);
    if (!a?.length || !b?.length) return [];
    const culprits = [...new Set([...a, ...b].map(labelOf))];
    return [{ id: rule.id, level: rule.level, title: rule.title, detail: rule.detail, culprits }];
  });
}

/** เทียบส่วนผสมกับลิสต์ "ตัวที่แพ้/ไม่เอา" ของผู้ใช้ (จับแบบมีคำนั้นอยู่ในชื่อ ไม่ต้องตรงเป๊ะ) */
function findAvoidHits(
  list: ParsedIngredient[],
  avoid: string[],
  labelOf: (p: ParsedIngredient) => string
): IngredientWarning[] {
  return avoid
    .map((term) => term.trim())
    .filter(Boolean)
    .flatMap((term) => {
      const needle = normalize(term);
      if (!needle) return [];
      const hits = list.filter((p) => p.key.includes(needle));
      if (hits.length === 0) return [];
      return [{
        id: `avoid:${needle}`,
        level: "warn" as const,
        title: `มี "${term}" ที่ตั้งไว้ว่าเลี่ยง`,
        detail: "ส่วนผสมนี้อยู่ในลิสต์ตัวที่ไม่เอาของคุณ",
        culprits: hits.map(labelOf),
      }];
    });
}

/** วิเคราะห์ส่วนผสมของสินค้าชิ้นเดียว */
export function analyzeIngredients(text: string | undefined, avoid: string[] = []): IngredientAnalysis {
  if (!text || !text.trim()) return EMPTY_ANALYSIS;
  const list = parseIngredients(text);
  const known = list.filter((p) => p.defs.length > 0);
  const tagCounts: Record<string, number> = {};
  for (const p of list) for (const t of p.tags) tagCounts[t] = (tagCounts[t] || 0) + 1;

  const label = (p: ParsedIngredient) => p.defs[0]?.th || p.raw;
  return {
    list,
    known,
    unknown: list.filter((p) => p.defs.length === 0),
    tags: sortTags(list.flatMap((p) => p.tags)),
    tagCounts,
    warnings: [...findAvoidHits(list, avoid, label), ...findConflicts(list, label)],
  };
}

export interface ComparedIngredient {
  key: string;
  raw: string;
  th?: string;
  tags: IngredientTag[];
  /** id ของสินค้าที่มีส่วนผสมตัวนี้ */
  itemIds: string[];
}

export interface ComparisonResult {
  /** ส่วนผสมทุกตัวจากทุกสินค้า เรียงตามจำนวนสินค้าที่มีตัวนั้น (ตัวที่ซ้ำกันมากอยู่บนสุด) */
  rows: ComparedIngredient[];
  /** ตัวที่มีครบทุกสินค้าที่เลือก */
  shared: ComparedIngredient[];
  /** คำเตือนของ "ชุด" ที่เลือกรวมกัน (เช่น ทาเรตินอลกับ AHA คนละขวดในรอบเดียวกัน) */
  warnings: IngredientWarning[];
}

/** เทียบส่วนผสมของสินค้าหลายตัว — หาตัวซ้ำ ตัวต่าง และคำเตือนของทั้งชุดรวมกัน */
export function compareIngredients(
  entries: { id: string; name: string; ingredients?: string }[],
  avoid: string[] = []
): ComparisonResult {
  const rows = new Map<string, ComparedIngredient>();
  const all: ParsedIngredient[] = [];
  const ownerOf = new Map<ParsedIngredient, string>();

  for (const e of entries) {
    for (const p of parseIngredients(e.ingredients || "")) {
      all.push(p);
      ownerOf.set(p, e.name);
      const row = rows.get(p.key);
      if (row) {
        if (!row.itemIds.includes(e.id)) row.itemIds.push(e.id);
      } else {
        rows.set(p.key, { key: p.key, raw: p.raw, th: p.defs[0]?.th, tags: p.tags, itemIds: [e.id] });
      }
    }
  }

  const label = (p: ParsedIngredient) => `${ownerOf.get(p)} → ${p.defs[0]?.th || p.raw}`;
  const sorted = [...rows.values()].sort(
    (a, b) => b.itemIds.length - a.itemIds.length || a.raw.localeCompare(b.raw)
  );

  return {
    rows: sorted,
    shared: sorted.filter((r) => r.itemIds.length === entries.length && entries.length > 1),
    warnings: [...findAvoidHits(all, avoid, label), ...findConflicts(all, label)],
  };
}

/** แท็กทั้งหมดของสินค้าชิ้นหนึ่ง (ใช้ตอนกรอง/โชว์ badge บนการ์ด) */
export function itemTags(ingredients: string | undefined): IngredientTag[] {
  if (!ingredients?.trim()) return [];
  return sortTags(parseIngredients(ingredients).flatMap((p) => p.tags));
}

// ── Skin Profile Compatibility ───────────────────────────────

import type { SkinType, SkinConcern, SkinProfile } from "./db";

type CompatLevel = "great" | "good" | "neutral" | "caution" | "avoid";

interface SkinRule {
  tag: IngredientTag;
  level: CompatLevel;
  reason: string;
}

/** กฎความเหมาะสมตามประเภทผิว */
const SKIN_TYPE_RULES: Partial<Record<SkinType, SkinRule[]>> = {
  oily: [
    { tag: "bha", level: "great", reason: "BHA ละลายไขมันในรูขุมขน ลดสิว/มันเยิ้ม" },
    { tag: "niacinamide", level: "great", reason: "ช่วยควบคุมความมัน กระชับรูขุมขน" },
    { tag: "humectant", level: "good", reason: "เติมน้ำโดยไม่เพิ่มน้ำมัน" },
    { tag: "oil", level: "caution", reason: "น้ำมันอาจทำให้หน้ามันขึ้นอีก" },
    { tag: "comedogenic", level: "avoid", reason: "เสี่ยงอุดตันรูขุมขน ทำให้เป็นสิว" },
    { tag: "occlusive", level: "caution", reason: "เคลือบหนักอาจทำให้มันเยิ้มและอุดตัน" },
    { tag: "silicone", level: "caution", reason: "ซิลิโคนหนักอาจอุดตันผิวมัน" },
  ],
  dry: [
    { tag: "humectant", level: "great", reason: "ดึงน้ำเข้าผิว ลดอาการแห้ง" },
    { tag: "emollient", level: "great", reason: "ให้ความนุ่มชุ่มชื้น ซ่อมเกราะผิว" },
    { tag: "occlusive", level: "great", reason: "เคลือบกักน้ำ ป้องกันน้ำระเหยออก" },
    { tag: "oil", level: "good", reason: "น้ำมันช่วยบำรุงผิวแห้งได้ดี" },
    { tag: "alcohol", level: "avoid", reason: "แอลกอฮอล์ทำให้ผิวแห้งมากขึ้น" },
    { tag: "sulfate", level: "avoid", reason: "สารทำความสะอาดแรง ลอกน้ำมันธรรมชาติออกหมด" },
    { tag: "aha", level: "caution", reason: "AHA ผลัดผิว อาจทำให้ผิวแห้งบางลงถ้าใช้บ่อย" },
  ],
  combination: [
    { tag: "niacinamide", level: "great", reason: "ปรับสมดุลทั้งโซนมันและแห้ง" },
    { tag: "humectant", level: "great", reason: "ให้น้ำพอดีไม่หนักเกิน" },
    { tag: "bha", level: "good", reason: "ช่วยโซน T ที่มัน" },
    { tag: "comedogenic", level: "caution", reason: "โซน T อุดตันง่าย" },
  ],
  sensitive: [
    { tag: "soothing", level: "great", reason: "ปลอบผิว ลดแดง ลดระคายเคือง" },
    { tag: "humectant", level: "great", reason: "เติมน้ำอ่อนโยน ไม่ระคายเคือง" },
    { tag: "fragrance", level: "avoid", reason: "น้ำหอมเป็นสาเหตุอันดับต้นของผิวแพ้" },
    { tag: "essential-oil", level: "avoid", reason: "น้ำมันหอมระเหยระคายเคืองผิวแพ้ง่ายมาก" },
    { tag: "alcohol", level: "avoid", reason: "แอลกอฮอล์ทำลายเกราะผิวที่อ่อนแออยู่แล้ว" },
    { tag: "sulfate", level: "avoid", reason: "สารทำความสะอาดแรง ยิ่งทำให้ผิวระคายเคือง" },
    { tag: "aha", level: "caution", reason: "กรดผลัดผิวอาจแรงเกินไป ต้องเริ่มจากความเข้มข้นต่ำ" },
    { tag: "retinoid", level: "caution", reason: "เรตินอยด์อาจระคายเคืองได้ ควรเริ่มช้าๆ" },
  ],
  normal: [
    { tag: "humectant", level: "good", reason: "ดึงน้ำเข้าผิวช่วยให้แข็งแรง" },
    { tag: "soothing", level: "good", reason: "ปลอบผิว รักษาสมดุล" },
  ],
};

/** กฎความเหมาะสมตามปัญหาผิว */
const SKIN_CONCERN_RULES: Record<SkinConcern, SkinRule[]> = {
  acne: [
    { tag: "bha", level: "great", reason: "BHA ละลายไขมันในรูขุมขน ลดสิว" },
    { tag: "niacinamide", level: "great", reason: "ลดการอักเสบ ควบคุมน้ำมัน" },
    { tag: "benzoyl-peroxide", level: "great", reason: "ฆ่าเชื้อแบคทีเรียที่ทำให้เป็นสิว" },
    { tag: "retinoid", level: "good", reason: "เร่งผลัดเซลล์ ลดการอุดตัน" },
    { tag: "comedogenic", level: "avoid", reason: "อุดตันรูขุมขน ทำให้สิวแย่ลง" },
  ],
  aging: [
    { tag: "retinoid", level: "great", reason: "เรตินอยด์คือ gold standard ลดริ้วรอย" },
    { tag: "vitc", level: "great", reason: "ต้านอนุมูลอิสระ กระตุ้นคอลลาเจน" },
    { tag: "peptide", level: "great", reason: "เปปไทด์กระตุ้นการสร้างคอลลาเจน" },
    { tag: "uv-filter", level: "great", reason: "กันแดดป้องกันการแก่จาก UV ที่เป็นสาเหตุหลัก" },
    { tag: "niacinamide", level: "good", reason: "ปรับผิวให้สม่ำเสมอ ลดจุดด่างดำ" },
    { tag: "humectant", level: "good", reason: "ผิวที่ชุ่มชื้นดูอ่อนเยาว์กว่า" },
  ],
  "dark-spots": [
    { tag: "vitc", level: "great", reason: "วิตามินซียับยั้งเมลานิน ลดจุดด่างดำ" },
    { tag: "niacinamide", level: "great", reason: "ลดการถ่ายทอดเมลานินขึ้นผิว" },
    { tag: "aha", level: "good", reason: "ผลัดผิวส่วนที่หมองคล้ำออก" },
    { tag: "retinoid", level: "good", reason: "เร่งผลัดเซลล์ผิว ลดฝ้า" },
    { tag: "uv-filter", level: "great", reason: "กันแดดป้องกันฝ้ากลับมา" },
  ],
  redness: [
    { tag: "soothing", level: "great", reason: "ปลอบผิว ลดแดง ลดอักเสบ" },
    { tag: "niacinamide", level: "great", reason: "ลดรอยแดง เสริมเกราะผิว" },
    { tag: "fragrance", level: "avoid", reason: "น้ำหอมกระตุ้นให้หน้าแดงขึ้น" },
    { tag: "essential-oil", level: "avoid", reason: "น้ำมันหอมระเหยกระตุ้นอาการแดง" },
    { tag: "alcohol", level: "avoid", reason: "แอลกอฮอล์ทำให้ผิวแดงและระคายเคืองมากขึ้น" },
  ],
  dryness: [
    { tag: "humectant", level: "great", reason: "ดึงน้ำเข้าผิว ลดแห้ง" },
    { tag: "emollient", level: "great", reason: "ให้ความนุ่ม ซ่อมเกราะผิว" },
    { tag: "occlusive", level: "great", reason: "เคลือบกักน้ำ" },
    { tag: "alcohol", level: "avoid", reason: "ทำผิวแห้งขึ้นอีก" },
    { tag: "sulfate", level: "avoid", reason: "ลอกน้ำมันธรรมชาติ" },
  ],
  oiliness: [
    { tag: "bha", level: "great", reason: "ละลายไขมัน ลดมัน" },
    { tag: "niacinamide", level: "great", reason: "ควบคุมการสร้างน้ำมัน" },
    { tag: "oil", level: "caution", reason: "เพิ่มความมัน" },
    { tag: "comedogenic", level: "avoid", reason: "อุดตัน" },
  ],
  pores: [
    { tag: "bha", level: "great", reason: "ทำความสะอาดในรูขุมขน" },
    { tag: "niacinamide", level: "great", reason: "กระชับรูขุมขน" },
    { tag: "retinoid", level: "good", reason: "เพิ่มคอลลาเจน ทำให้รูขุมขนดูเล็กลง" },
    { tag: "comedogenic", level: "avoid", reason: "ยิ่งทำให้รูขุมขนอุดตัน" },
  ],
  dullness: [
    { tag: "vitc", level: "great", reason: "วิตามินซีทำให้ผิวสว่างใส" },
    { tag: "aha", level: "great", reason: "ผลัดผิวหมองคล้ำออก เผยผิวใหม่" },
    { tag: "niacinamide", level: "good", reason: "ปรับผิวให้สม่ำเสมอ" },
    { tag: "retinoid", level: "good", reason: "เร่งผลัดเซลล์ผิวเก่า" },
  ],
};

export const COMPAT_META: Record<CompatLevel, { label: string; emoji: string; color: string }> = {
  great: { label: "เหมาะมาก", emoji: "💚", color: "great" },
  good: { label: "ดี", emoji: "👍", color: "good" },
  neutral: { label: "ปกติ", emoji: "➖", color: "neutral" },
  caution: { label: "ระวัง", emoji: "⚠️", color: "caution" },
  avoid: { label: "ไม่แนะนำ", emoji: "🚫", color: "avoid" },
};

const COMPAT_RANK: Record<CompatLevel, number> = { great: 4, good: 3, neutral: 2, caution: 1, avoid: 0 };

export interface SkinCompat {
  tag: IngredientTag;
  level: CompatLevel;
  reason: string;
}

export interface SkinAnalysis {
  /** คะแนน 0-100 ความเหมาะกับผิว */
  score: number;
  scoreLabel: string;
  /** สรุประดับ */
  level: CompatLevel;
  /** ตัวที่เหมาะ */
  pros: SkinCompat[];
  /** ตัวที่ควรระวัง/ไม่แนะนำ */
  cons: SkinCompat[];
  /** ทุกแท็กที่เจอ + ระดับความเหมาะ */
  all: SkinCompat[];
}

/** วิเคราะห์ความเหมาะสมของส่วนผสมกับโปรไฟล์ผิวของผู้ใช้ */
export function analyzeSkinCompat(
  ingredients: string | undefined,
  profile: SkinProfile | undefined
): SkinAnalysis | null {
  if (!profile?.skinType || !ingredients?.trim()) return null;

  const tags = itemTags(ingredients);
  if (tags.length === 0) return null;

  // รวมกฎจากทั้ง skinType + concerns — ถ้ามีแท็กเดียวกันหลายกฎ ใช้ตัวที่ "สุดโต่ง" กว่า (avoid > caution > great > good > neutral)
  const ruleMap = new Map<IngredientTag, SkinRule>();
  const allRules = [
    ...(SKIN_TYPE_RULES[profile.skinType] || []),
    ...profile.concerns.flatMap((c) => SKIN_CONCERN_RULES[c] || []),
  ];
  for (const rule of allRules) {
    const existing = ruleMap.get(rule.tag);
    if (!existing) {
      ruleMap.set(rule.tag, rule);
    } else {
      // avoid/caution ชนะ good/great เสมอ (ระวังสำคัญกว่าแนะนำ)
      const existBad = COMPAT_RANK[existing.level] <= 1;
      const newBad = COMPAT_RANK[rule.level] <= 1;
      if (newBad && !existBad) ruleMap.set(rule.tag, rule);
      else if (!newBad && !existBad && COMPAT_RANK[rule.level] > COMPAT_RANK[existing.level]) ruleMap.set(rule.tag, rule);
      else if (newBad && existBad && COMPAT_RANK[rule.level] < COMPAT_RANK[existing.level]) ruleMap.set(rule.tag, rule);
    }
  }

  const all: SkinCompat[] = tags.map((t) => {
    const rule = ruleMap.get(t);
    return rule
      ? { tag: t, level: rule.level, reason: rule.reason }
      : { tag: t, level: "neutral" as const, reason: "ไม่มีข้อมูลเฉพาะสำหรับผิวของคุณ" };
  });

  const pros = all.filter((c) => c.level === "great" || c.level === "good");
  const cons = all.filter((c) => c.level === "caution" || c.level === "avoid");

  // คะแนน: เริ่มต้น 60 เพิ่ม/ลดตามจำนวนตัวดี/ไม่ดี
  let score = 60;
  for (const c of all) {
    if (c.level === "great") score += 8;
    else if (c.level === "good") score += 4;
    else if (c.level === "caution") score -= 6;
    else if (c.level === "avoid") score -= 12;
  }
  score = Math.max(0, Math.min(100, score));

  let level: CompatLevel;
  if (cons.some((c) => c.level === "avoid")) level = "avoid";
  else if (score >= 80) level = "great";
  else if (score >= 60) level = "good";
  else if (score >= 40) level = "caution";
  else level = "avoid";

  const scoreLabel = score >= 80 ? "เหมาะกับผิวคุณมาก" : score >= 60 ? "ใช้ได้ดี" : score >= 40 ? "ควรระวังบางตัว" : "ไม่ค่อยเหมาะกับผิวคุณ";

  return { score, scoreLabel, level, pros, cons, all };
}
