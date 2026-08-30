import { describe, expect, it } from "vitest";
import { importSite } from "@/lib/import/sites";
import {
  extractCharges,
  extractOrderDate,
  labelMoney,
  parsePriceLeaf,
  parseProductText,
  parseQtyLeaf,
  parseQtyLoose,
} from "@/lib/import/text";

const charges = (id: Parameters<typeof importSite>[0], text: string) =>
  extractCharges(text, importSite(id).charges);

describe("labelMoney — ยอดเงินของป้ายหนึ่ง", () => {
  it("รับทั้งแบบ ฿ นำหน้าและ บาท ต่อท้าย", () => {
    expect(labelMoney("ค่าจัดส่ง ฿40", ["ค่าจัดส่ง"])).toBe(40);
    expect(labelMoney("ค่าจัดส่ง 40 บาท", ["ค่าจัดส่ง"])).toBe(40);
  });

  it("อ่านคอมมาเป็นหลักพัน ไม่ใช่ตัดทิ้งจนเหลือหลักเดียว", () => {
    expect(labelMoney("รวมค่าสินค้า ฿1,980.50", ["รวมค่าสินค้า"])).toBe(1980.5);
  });

  it("ป้ายเดียวกันหลายครั้ง = หลายออเดอร์ในหน้าเดียว ต้องบวกรวมกัน", () => {
    expect(labelMoney("ค่าจัดส่ง ฿40 ... ค่าจัดส่ง ฿25", ["ค่าจัดส่ง"])).toBe(65);
  });

  it("ป้ายคนละชื่อของยอดเดียวกัน ต้องนับแค่ป้ายแรกที่เจอ ไม่ใช่บวกซ้อนกัน", () => {
    const text = "ยอดสุทธิ ฿500 ยอดชำระเงิน ฿500";
    expect(labelMoney(text, ["ยอดสุทธิ", "ยอดชำระ(?:เงิน)?"])).toBe(500);
  });

  it("ป้ายที่ไม่มีตัวเลขตามมา ต้องไม่ไปหยิบยอดของป้ายถัดไปมาเป็นของตัวเอง", () => {
    expect(labelMoney("ค่าจัดส่ง ฟรี ยอดรวมทั้งหมด ฿500", ["ค่าจัดส่ง"])).toBeUndefined();
  });

  it("ไม่เจอป้ายเลยคืน undefined (= ไม่รู้) ไม่ใช่ 0", () => {
    expect(labelMoney("ยอดรวมทั้งหมด ฿500", ["ค่าจัดส่ง"])).toBeUndefined();
  });
});

describe("extractCharges — ค่าส่ง/ส่วนลดระดับออเดอร์ของแต่ละร้าน", () => {
  it("Shopee: ค่าส่งที่จ่ายจริง = ค่าส่งเต็ม − ส่วนลดค่าส่ง", () => {
    const c = charges("shopee", "รวมค่าสินค้า ฿300 ค่าจัดส่ง ฿40 ส่วนลดค่าจัดส่ง ฿15 ยอดรวมทั้งหมด ฿325");
    expect(c.goodsSubtotal).toBe(300);
    expect(c.shipping).toBe(25);
    expect(c.grandTotal).toBe(325);
  });

  it("Shopee: ส่วนลดค่าส่งต้องไม่ถูกนับเป็นส่วนลดสินค้าซ้ำอีกรอบ", () => {
    const c = charges("shopee", "ค่าจัดส่ง ฿40 ส่วนลดค่าจัดส่ง ฿40 ส่วนลด ฿20");
    expect(c.shipping).toBe(0);
    expect(c.discount).toBe(20);
  });

  it("ส่วนลดค่าส่งมากกว่าค่าส่ง ไม่ทำให้ค่าส่งติดลบ", () => {
    expect(charges("shopee", "ค่าจัดส่ง ฿40 ส่วนลดค่าจัดส่ง ฿60").shipping).toBe(0);
  });

  it("Lazada: ป้ายคนละชุดกับ Shopee แต่ต้องได้ยอดเดียวกัน", () => {
    const c = charges("lazada", "ยอดรวมย่อย ฿1,200 ค่าขนส่ง ฿50 โค้ดส่วนลด ฿100 ยอดรวมทั้งหมด ฿1,150");
    expect(c).toMatchObject({ goodsSubtotal: 1200, shipping: 50, discount: 100, grandTotal: 1150 });
  });

  it("Watsons: ยอดที่โชว์เป็น 'บาท' ต่อท้าย", () => {
    const c = charges("watsons", "มูลค่าสินค้า 899.00 บาท ค่าจัดส่ง 0.00 บาท ยอดสุทธิ 899.00 บาท");
    expect(c).toMatchObject({ goodsSubtotal: 899, shipping: 0, grandTotal: 899 });
  });

  it("Konvy: ยอดสุทธิชนะ ยอดชำระ ที่เป็นก้อนเดียวกัน", () => {
    const c = charges("konvy", "ราคาสินค้า ฿750 ค่าจัดส่ง ฿0 ส่วนลด ฿50 ยอดสุทธิ ฿700 ยอดชำระเงิน ฿700");
    expect(c).toMatchObject({ goodsSubtotal: 750, shipping: 0, discount: 50, grandTotal: 700 });
  });

  it("Konvy: ป้ายจริงของหน้ารายละเอียดออเดอร์ (ค่าส่งเรียก 'ค่าพัสดุ' ยอดจ่ายเรียก 'ยอดที่ต้องชำระ')", () => {
    const c = charges(
      "konvy",
      "จำนวนเงินรวม: ฿2325 ค่าพัสดุ: + ฿0 ส่วนลด: - ฿40 คูปองส่วนลด: - ฿128 ยอดที่ต้องชำระ: ฿2157"
    );
    // ส่วนลดสองก้อน (ร้าน + คูปอง) ต้องรวมกัน ไม่ใช่นับแค่ก้อนแรก: 2325 + 0 − 168 = 2157
    expect(c).toMatchObject({ goodsSubtotal: 2325, shipping: 0, discount: 168, grandTotal: 2157 });
  });

  it("หน้าที่ไม่มีป้ายยอดเลย (หน้ารายการออเดอร์รวม) คืน undefined ทุกช่อง ไม่เดาเป็น 0", () => {
    expect(charges("shopee", "สบู่ก้อน x1 ฿120")).toEqual({
      goodsSubtotal: undefined, shipping: undefined, discount: undefined, grandTotal: undefined,
    });
  });
});

describe("extractOrderDate — วันสั่งซื้อคือวันที่เก่าสุดบนหน้า", () => {
  it("Shopee: แถบสถานะแบบ 18-08-2019 16:57 เอาขั้นแรกสุด", () => {
    const text = "มีคำสั่งซื้อใหม่ 18-08-2019 16:57 จัดส่งแล้ว 20-08-2019 09:12";
    expect(extractOrderDate(text, ["datetime"])).toBe("2019-08-18");
  });

  it("วันที่ไทยแบบย่อ + ปี พ.ศ. แปลงเป็น ค.ศ.", () => {
    expect(extractOrderDate("สั่งซื้อเมื่อ 5 ส.ค. 2568", ["thai"])).toBe("2025-08-05");
  });

  it("วันที่ไทยแบบเต็ม", () => {
    expect(extractOrderDate("13 สิงหาคม 2025", ["thai"])).toBe("2025-08-13");
  });

  it("ตัวย่อที่ขึ้นต้นเหมือนกันต้องไม่ปนกัน (มี.ค. ≠ ม.ค.)", () => {
    expect(extractOrderDate("2 มี.ค. 2025", ["thai"])).toBe("2025-03-02");
    expect(extractOrderDate("2 ม.ค. 2025", ["thai"])).toBe("2025-01-02");
  });

  it("รูปแบบอังกฤษทั้งสองท่า", () => {
    expect(extractOrderDate("13 Aug 2025", ["english"])).toBe("2025-08-13");
    expect(extractOrderDate("Aug 13, 2025", ["english"])).toBe("2025-08-13");
  });

  it("dd/mm/yyyy กับ ISO", () => {
    expect(extractOrderDate("13/08/2025", ["dmy"])).toBe("2025-08-13");
    expect(extractOrderDate("2025-08-13", ["iso"])).toBe("2025-08-13");
  });

  it("มีหลายรูปแบบในหน้าเดียว เอาตัวเก่าสุดข้ามรูปแบบ", () => {
    const text = "สั่งซื้อ 5 ส.ค. 2568 กำหนดส่ง 12/08/2025";
    expect(extractOrderDate(text, ["thai", "dmy"])).toBe("2025-08-05");
  });

  it("วันที่ที่อ่านไม่ออก/เกินช่วง ทิ้งไปเลย ไม่เดามั่ว", () => {
    expect(extractOrderDate("32/13/2025", ["dmy"])).toBeUndefined();
    expect(extractOrderDate("ไม่มีวันที่", ["thai", "dmy", "iso", "english"])).toBeUndefined();
  });
});

describe("parseQtyLeaf / parseQtyLoose", () => {
  it("รูปแบบจำนวนที่แต่ละร้านใช้", () => {
    expect(parseQtyLeaf("x2")).toBe(2);
    expect(parseQtyLeaf("x 2")).toBe(2);
    expect(parseQtyLeaf("จำนวน: 3")).toBe(3);
    expect(parseQtyLeaf("Qty: 4")).toBe(4);
    expect(parseQtyLeaf("2 ชิ้น")).toBe(2);
  });

  it("ข้อความอื่นที่มีตัวเลขไม่ใช่จำนวน", () => {
    expect(parseQtyLeaf("฿120")).toBeUndefined();
    expect(parseQtyLeaf("เซรั่มวิตามินซี 30 มล.")).toBeUndefined();
  });

  it("แบบหลวมใช้กับข้อความทั้งแถวได้", () => {
    expect(parseQtyLoose("สี: ชมพู จำนวน 2")).toBe(2);
    expect(parseQtyLoose("ไม่มีจำนวน")).toBeUndefined();
  });
});

describe("parsePriceLeaf", () => {
  it("อ่านคอมมาเป็นหลักพัน", () => {
    expect(parsePriceLeaf("฿1,980")).toBe(1980);
    expect(parsePriceLeaf("1,980.50 บาท")).toBe(1980.5);
  });

  it("ราคาที่มีข้อความห้อยท้ายยังอ่านได้", () => {
    expect(parsePriceLeaf("฿54 /ชิ้น")).toBe(54);
  });

  it("ประโยคที่บังเอิญมีตัวเลขไม่ใช่ราคา", () => {
    expect(parsePriceLeaf("ส่งฟรีเมื่อครบ 500")).toBeUndefined();
  });
});

describe("parseProductText — ชื่อ/ขนาด/ตัวเลือกของแถวสินค้า", () => {
  it("บรรทัดตัวเลือกไม่ถูกหยิบไปเป็นชื่อ แม้จะยาวกว่าชื่อจริง", () => {
    const r = parseProductText(["สบู่", "ตัวเลือกสินค้า: กลิ่น Peppermint ขนาดพกพา"]);
    expect(r?.name).toBe("สบู่");
    expect(r?.variant).toBe("กลิ่น Peppermint ขนาดพกพา");
  });

  it("ชื่อคือข้อความที่ยาวที่สุด ป้ายสั้นๆ ตกไปเป็นแท็กรอง", () => {
    const r = parseProductText(["Pre-Order", "เซรั่มวิตามินซีเข้มข้น สูตรใหม่"]);
    expect(r?.name).toBe("เซรั่มวิตามินซีเข้มข้น สูตรใหม่");
  });

  it("ขนาดที่ฝังอยู่ในชื่อสินค้าก็แกะออกมาได้", () => {
    expect(parseProductText(["เซรั่มวิตามินซีเข้มข้น 30 ml"])?.size).toBe("30ml");
  });

  it("ป้ายโปรโมชั่น/ของแถมบนแถวสินค้า ไม่ถูกหยิบไปเป็นตัวเลือก", () => {
    const r = parseProductText(["โปรโมชั่น", "Konvy Oval Air Cushion Massage Hair Comb #Pink"]);
    expect(r?.name).toBe("Konvy Oval Air Cushion Massage Hair Comb #Pink");
    expect(r?.variant).toBeUndefined();
  });

  it("มีแต่บรรทัดตัวเลือก = ไม่รู้ชื่อสินค้า ต้องคืน null ไม่ใช่เดา", () => {
    expect(parseProductText(["ตัวเลือกสินค้า: สีชมพู"])).toBeNull();
  });
});

describe("Lazada — หน้ารายละเอียดออเดอร์ (ป้ายเงินคนละชุดกับหน้ารวม)", () => {
  // ข้อความจากบล็อก "สรุปยอดรวมทั้งสิ้น" ของหน้า /customer/order/view จริง
  const totals =
    "สรุปยอดรวมทั้งสิ้น ยอดรวม ฿1,605.00 ค่าจัดส่ง ฿133.00 " +
    "โปรโมชั่นจากร้านค้า -฿2,590.00 โปรโมชั่นจาก Lazada -฿10,000.00 โปรโมชั่นค่าจัดส่ง -฿133.00 " +
    "ยอดรวมทั้งสิ้น ฿1,512.10";

  it('"ยอดรวม" เฉยๆ คือยอดสินค้า ไม่ใช่ยอดรวมทั้งสิ้นที่ขึ้นต้นเหมือนกัน', () => {
    const c = charges("lazada", totals);
    expect(c.goodsSubtotal).toBe(1605);
    expect(c.grandTotal).toBe(1512.1);
  });

  it('"โปรโมชั่นค่าจัดส่ง" คือส่วนลดค่าส่ง ต้องหักออก ไม่ใช่บวกเข้าไปเป็นค่าส่งอีกก้อน', () => {
    expect(charges("lazada", totals).shipping).toBe(0);
  });

  it("ส่วนลดหลายก้อน (ร้านค้า + Lazada) ต้องรวมกัน ส่วนลดค่าส่งต้องไม่ถูกนับซ้ำตรงนี้", () => {
    expect(charges("lazada", totals).discount).toBe(12590);
  });

  it('วันสั่งซื้อต้องมาจากป้าย "สั่งซื้อเมื่อ" ไม่ใช่ออเดอร์เก่าที่ติดมาจากเมนูหัวเว็บ', () => {
    const text =
      "คำสั่งซื้อล่าสุดของฉัน 04/03/2015 - Order 980488619368940 " +
      "คำสั่งซื้อ 219790845068940 สั่งซื้อเมื่อ 10 ธ.ค. 2018 10:40:36";
    expect(extractOrderDate(text, ["thai", "english", "dmy", "iso"])).toBe("2018-12-10");
  });
});
