import type { MetadataRoute } from "next";

/**
 * ไฟล์ manifest สำหรับ "เพิ่มไปที่หน้าจอโฮม" บนมือถือ — ไม่มีผลกับการใช้งานผ่านเบราว์เซอร์ปกติ
 * ไอคอนอยู่ที่ `public/icons/` (ไม่ใช่ `app/icon.svg`) เพราะพาธในไฟล์นี้ต้องคงที่
 * ส่วนไอคอนแบบไฟล์ใน `app/` จะถูกต่อท้ายด้วยแฮชตอน build
 * สีต้องตรงกับ `viewport.themeColor` ใน `app/layout.tsx` ไม่งั้นแถบสถานะตอนเปิดจากหน้าจอโฮมจะคนละสีกับตอนเปิดในเบราว์เซอร์
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "จัดการสต็อกสินค้า",
    short_name: "สต็อกสินค้า",
    description: "จดของที่มีในบ้าน ของที่ต้องซื้อ ต้นทุน และยอดใช้จ่าย",
    lang: "th",
    start_url: "/",
    display: "standalone",
    background_color: "#f5f6f8",
    theme_color: "#f5f6f8",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-512-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
