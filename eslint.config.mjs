import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { FlatCompat } from "@eslint/eslintrc";

/**
 * ก่อนหน้านี้โปรเจกต์ไม่มี ESLint config เลย (`next lint` ที่เลิกใช้แล้วไม่เคยถูกตั้งค่า)
 * แปลว่าคอมเมนต์ `eslint-disable` ~10 จุดในโค้ดไม่มีผลอะไรทั้งนั้น และไม่มีอะไรจับ
 * ตัวแปรที่ไม่ได้ใช้/dependency ของ hook ที่ขาด — ไฟล์นี้ทำให้กติกาพวกนั้นมีผลจริง
 */
const compat = new FlatCompat({ baseDirectory: dirname(fileURLToPath(import.meta.url)) });

const config = [
  { ignores: [".next/**", "node_modules/**", "next-env.d.ts"] },
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    rules: {
      // ตัวแปรที่ตั้งใจทิ้ง (เช่น destructure เอา `deletedAt` ออกใน lib/trash.ts) ให้ขึ้นต้นด้วย _
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
    },
  },
];

export default config;
