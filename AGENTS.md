<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

@CLAUDE.md

# เพิ่มเติมสำหรับ workspace นี้

`CLAUDE.md` (ที่ include ไว้ข้างบน) คือกฎหลักของ repo นี้ · [`ARCHITECTURE.md`](./ARCHITECTURE.md)
คือ domain rule ทั้งหมด · กฎกลางของ workspace อยู่ที่ [`../PROJECT-STANDARD.md`](../PROJECT-STANDARD.md)

- **port 3001** pin ไว้ทั้งใน `package.json` และ `.claude/launch.json`
  (ย้ายมาจาก 3000 เมื่อ 2026-09-26 เพราะชนกับ investment-tools — ข้อมูลเดิมที่ `localhost:3000`
  ยังอยู่ ต้อง export/import ถ้าจะเอามาใช้ต่อ)
- **app นี้เป็น reference ของ workspace** — helper ที่พิสูจน์แล้วหลายตัวถูกยกไปเป็นของกลางที่
  `app-template/` แล้ว (`lib/download.ts` · `lib/uid.ts` · `lib/date.ts` → `todayISO`)
  **แก้ของพวกนี้ที่นี่เมื่อไหร่ ต้องไปแก้ที่ `app-template/` ด้วย** ไม่งั้นก๊อปจะเริ่มเพี้ยนกัน
  (ตัวที่ยังไม่ได้ยกไป: `lib/core/cats.ts`, `lib/core/statusOptions.ts` — ผูกกับโดเมนนี้)
- **`cn()` จาก `@/lib/utils`** ใช้กับ class ที่มีเงื่อนไข — template literal เหลือไว้เฉพาะการ
  ต่อสตริงจริง ๆ (`skin-score--${level}`)
- **ห้าม hardcode สีใน `.tsx`** รวม palette ของกราฟ (ใช้ `--cat-1..8`)
  ยกเว้นที่เดียวคือ `lib/core/themeColors.ts` ซึ่งอธิบายเหตุผลไว้ในไฟล์แล้ว
- **`ModalShell`** เป็นเปลือกของโมดัลทุกตัวในแอป — ห้ามเขียน `.modal-backdrop` หรือ
  `useEffect` ดัก Escape เองอีก (ตัวเดียวกันนี้ถูกยกไปเป็น `Modal` ของ `app-template/` แล้ว)

## ก่อนบอกว่าเสร็จ

```bash
npm run lint && npm run typecheck && npm test && npm run build
```
