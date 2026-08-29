import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

/**
 * เทสต์ครอบเฉพาะ **ชั้นคำนวณล้วนๆ** ใน `lib/` (ไม่มี state ไม่มี DOM ไม่มีเน็ต)
 *
 * ตั้งใจไม่ลง jsdom/happy-dom เพิ่ม — ของที่ต้องใช้ DOM มีแค่ `lib/shopee.ts` (ใช้ `DOMParser`
 * แกะ HTML) กับพวก component ซึ่งพิสูจน์ด้วยการกดจริงในเบราว์เซอร์คุ้มกว่าอยู่แล้ว
 * ตรรกะที่พังแล้วเงียบ (ยอดเงิน/วันหมดอายุ/migration) อยู่ในชั้นนี้ทั้งหมด
 */
export default defineConfig({
  test: {
    environment: "node",
    include: ["lib/__tests__/**/*.test.ts"],
  },
  resolve: {
    // ให้ `@/lib/...` ทำงานเหมือนใน Next (ดู paths ใน tsconfig.json)
    alias: { "@": fileURLToPath(new URL("./", import.meta.url)) },
  },
});
