import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

/**
 * ก่อนหน้านี้โปรเจกต์ไม่มี ESLint config เลย (`next lint` ที่เลิกใช้แล้วไม่เคยถูกตั้งค่า)
 * แปลว่าคอมเมนต์ `eslint-disable` ~10 จุดในโค้ดไม่มีผลอะไรทั้งนั้น และไม่มีอะไรจับ
 * ตัวแปรที่ไม่ได้ใช้/dependency ของ hook ที่ขาด — ไฟล์นี้ทำให้กติกาพวกนั้นมีผลจริง
 *
 * ตอนอัป Next 16: `eslint-config-next` เลิกรองรับการ extend ผ่าน `FlatCompat` แล้ว
 * (พังด้วย "Converting circular structure to JSON") — ต้อง import เป็น flat config ตรง ๆ
 * แบบข้างล่างนี้ เหมือน app อื่นใน workspace
 */
const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts"]),
  {
    rules: {
      // ตัวแปรที่ตั้งใจทิ้ง (เช่น destructure เอา `deletedAt` ออกใน lib/trash.ts) ให้ขึ้นต้นด้วย _
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
    },
  },
]);

export default eslintConfig;
