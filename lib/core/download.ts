/**
 * ดาวน์โหลดไฟล์จากฝั่งเบราว์เซอร์ + ประกอบ CSV
 *
 * เดิมท่านี้ถูกเขียนซ้ำ 4 ที่ (ส่งออกสินค้า / สูตร / แผน / สำรองข้อมูล JSON) พร้อม
 * `csvCell` ที่ก๊อปกันคนละก๊อป — กติกาเรื่องการ escape เครื่องหมายคำพูดกับ BOM
 * จึงอาจเพี้ยนไม่ตรงกันได้โดยไม่มีใครรู้ ตอนนี้ทุกที่เรียกที่เดียวกัน
 */

/**
 * 1 ช่องใน CSV — ครอบด้วย `"` เสมอและ escape `"` ข้างในเป็น `""`
 *
 * ครอบทุกช่องแม้ช่องที่ไม่มีตัวคั่น เพราะข้อมูลในแอปนี้เป็นข้อความไทยที่ผู้ใช้พิมพ์เอง
 * (ชื่อสินค้า/หมายเหตุ/ลิสต์ส่วนผสมที่คั่นด้วยจุลภาค) เดาไม่ได้ว่าช่องไหนปลอดภัย
 */
export function csvCell(v: unknown): string {
  return `"${String(v ?? "").replace(/"/g, '""')}"`;
}

/** ตาราง → ข้อความ CSV (1 แถวต่อบรรทัด) */
export function csvRows(rows: unknown[][]): string {
  return rows.map((r) => r.map(csvCell).join(",")).join("\n");
}

/**
 * สั่งให้เบราว์เซอร์เซฟไฟล์
 *
 * CSV ต้องมี BOM (`﻿`) นำหน้าเสมอ ไม่งั้น Excel บนวินโดวส์อ่านภาษาไทยเป็นขยะ
 * — ใส่ให้อัตโนมัติเมื่อ `type` เป็น csv จะได้ไม่มีใครลืม
 */
export function downloadFile(filename: string, content: string, type: "csv" | "json" = "csv"): void {
  const mime = type === "csv" ? "text/csv;charset=utf-8;" : "application/json;charset=utf-8;";
  const blob = new Blob([type === "csv" ? "﻿" + content : content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  // ต้องอยู่ใน DOM จริงตอนกด และห้าม revoke ทันที — Firefox/Safari อ่าน blob ต่อหลัง click
  // จบไปแล้ว ถ้าเพิกถอน URL ในบรรทัดถัดไปเลย ไฟล์จะไม่ถูกดาวน์โหลดแบบเงียบๆ (Chrome รอด)
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    a.remove();
    URL.revokeObjectURL(url);
  }, 0);
}
