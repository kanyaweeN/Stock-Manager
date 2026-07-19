# 📦 Stock Manager (จัดการสต็อกสินค้า)

เว็บแอปจัดการสต็อกสินค้าส่วนตัว สร้างด้วย Next.js + TypeScript ข้อมูลเก็บไว้ในเบราว์เซอร์ของคุณเอง (ไม่มีเซิร์ฟเวอร์/ฐานข้อมูลกลาง) พร้อมนำเข้ารายการจาก Shopee และซิงก์กับ Google Sheets ได้

## ฟีเจอร์

- **จัดการสินค้า** — เพิ่ม/แก้ไข/ลบ, ปรับจำนวนแบบ +/−, ตั้งค่าขั้นต่ำแจ้งเตือน "ใกล้หมด"
- **แสดงผลแบบการ์ด (grid)** พร้อมรูปภาพสินค้า
- **สถานะสินค้า** — ซื้อซ้ำได้ / ไม่ควรซื้อ / ได้ของอยู่แล้ว
- **หมวดหมู่ที่แนะนำ** ตั้งค่าล่วงหน้าได้ในหน้าตั้งค่า
- **นำเข้าจาก Shopee** — วางโค้ด HTML จากหน้าออเดอร์ Shopee (Ctrl+U) แล้วระบบแยกชื่อ/จำนวน/รูปภาพให้อัตโนมัติ ตรวจสอบก่อนนำเข้าได้
- **บันทึกอัตโนมัติลงไฟล์** — ใช้ Origin Private File System (OPFS) ของเบราว์เซอร์เป็นหลัก สำรองด้วย localStorage และเลือกผูกกับไฟล์ `.json` บนเครื่องจริงได้ (Chrome/Edge)
- **สำรอง/กู้คืนข้อมูล** เป็นไฟล์ JSON
- **ซิงก์กับ Google Sheets** (ไม่บังคับ) — เชื่อมต่อผ่าน Google OAuth แล้วส่งข้อมูลขึ้น/ดึงข้อมูลจาก Google Sheet ของคุณเองได้
- **ส่งออก CSV**

## เริ่มต้นใช้งาน

```bash
npm install
npm run dev
```

เปิด [http://localhost:3000](http://localhost:3000)

### คำสั่งอื่นๆ

```bash
npm run build   # build สำหรับ production
npm run start   # รันเวอร์ชัน production ที่ build แล้ว
npm run lint     # ตรวจโค้ดด้วย ESLint
```

## โครงสร้างโปรเจกต์

```
app/
  page.tsx            หน้าหลัก (รายการสินค้า)
  config/page.tsx      หน้าตั้งค่า (แท็บ: ที่เก็บข้อมูล / Google Sheets / หมวดหมู่ / สำรอง-กู้คืน)
  globals.css          สไตล์รวมทั้งแอป
components/
  ProductGrid.tsx       การ์ดแสดงรายการสินค้า
  ProductModal.tsx      ฟอร์มเพิ่ม/แก้ไขสินค้า
  ImportModal.tsx       หน้าต่างนำเข้าจาก Shopee
  StatsBar.tsx          สรุปยอดด้านบน
  config/               คอมโพเนนต์ของแต่ละแท็บในหน้าตั้งค่า
lib/
  types.ts              type ของสินค้า/รายการนำเข้า
  db.ts                  โครงสร้างข้อมูลรวม + migration ของเวอร์ชันเก่า
  usePersistedDB.ts      hook จัดการ OPFS/localStorage/ไฟล์ที่ผูกไว้
  StockDBProvider.tsx    React Context แชร์ข้อมูลระหว่างหน้า
  useProductFilters.ts   ค้นหา/กรองหมวดหมู่
  useProductActions.ts   CRUD สินค้า, นำเข้า, ส่งออก CSV
  shopee.ts              ตัวแยกรายการสินค้าจาก HTML ของ Shopee
  googleSheets.ts        เรียก Google Sheets API
  useGoogleSheetsSync.ts hook เชื่อมต่อ/ซิงก์ Google Sheets
```

## การเก็บข้อมูล

ไม่มีฐานข้อมูลหรือเซิร์ฟเวอร์ ข้อมูลทั้งหมดอยู่ในเบราว์เซอร์ของผู้ใช้:

1. **OPFS** (Origin Private File System) — ไฟล์จริงที่เบราว์เซอร์จัดการให้ ใช้เป็นค่าเริ่มต้น
2. **localStorage** — สำรองคู่กันเสมอ
3. **ไฟล์บนเครื่องจริง (ไม่บังคับ)** — กด "ผูกกับไฟล์บนเครื่อง" ในหน้าตั้งค่าเพื่อเขียนข้อมูลไปยังไฟล์ `.json` ที่เลือกไว้ด้วย (ต้องใช้ Chrome/Edge เพราะพึ่ง File System Access API)

หากต้องการย้ายข้อมูลไปเครื่องอื่น ใช้ปุ่ม **สำรองข้อมูล (ดาวน์โหลด)** และ **กู้คืนจากไฟล์** ในหน้าตั้งค่า

## เชื่อมต่อ Google Sheets (ไม่บังคับ)

1. สร้างโปรเจกต์ใน [Google Cloud Console](https://console.cloud.google.com/) แล้วเปิดใช้งาน **Google Sheets API**
2. ตั้งค่า **OAuth consent screen** (User type: External) แล้วเพิ่มอีเมลของคุณใน Test users
3. สร้าง **OAuth Client ID** ประเภท "Web application" แล้วเพิ่ม URL ของแอป (เช่น `http://localhost:3000`) ใน Authorized JavaScript origins
4. สร้าง Google Sheet เปล่า แล้วคัดลอก Spreadsheet ID จาก URL (ส่วนระหว่าง `/d/` กับ `/edit`)
5. ใส่ Client ID และ Spreadsheet ID ในหน้าตั้งค่า → แท็บ Google Sheets แล้วกด "เชื่อมต่อ Google"

ระบบเชื่อมต่อผ่าน Google Identity Services ฝั่ง client ล้วนๆ ไม่มี backend และไม่มี client secret ฝังอยู่ในโค้ด

## เทคโนโลยีที่ใช้

- [Next.js](https://nextjs.org/) 15 (App Router)
- React 19 + TypeScript
- CSS ธรรมดา (ไม่มี framework CSS เพิ่มเติม)

## หมายเหตุ

ไฟล์ `index.html` ที่อยู่ใน root เป็นเวอร์ชันเดิมก่อนย้ายมาเป็น Next.js (static single-file) เก็บไว้เผื่อใช้งานแบบไม่ต้องรัน build
