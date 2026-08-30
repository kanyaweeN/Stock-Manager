/**
 * ประตูเดียวของชั้นข้อมูล — โค้ดที่เหลือทั้งแอป import `@/lib/db` ตัวนี้
 * แยกภายในเป็น `schema.ts` (รูปร่าง) · `migrations.ts` (แปลงเวอร์ชัน) · `normalize.ts` (เติม default)
 */
import { CURRENT_SCHEMA_VERSION, MIGRATIONS } from "@/lib/db/migrations";
import { normalizeDB } from "@/lib/db/normalize";
import type { RawDB, StockDB } from "@/lib/db/schema";

export type { SkinType, SkinConcern, SkinProfile, StockDB } from "@/lib/db/schema";
export { SKIN_TYPE_LABELS, SKIN_CONCERN_LABELS } from "@/lib/db/schema";
export { MIGRATIONS, CURRENT_SCHEMA_VERSION, DEFAULT_DB } from "@/lib/db/migrations";
export { normalizeDB } from "@/lib/db/normalize";

/** อ่านเวอร์ชันของข้อมูลดิบ — ไม่มีฟิลด์นี้แปลว่าเป็นข้อมูลยุคก่อนมี schemaVersion (v0) */
export function detectSchemaVersion(raw: unknown): number {
  const v = (raw ?? {}) as RawDB;
  return typeof v.schemaVersion === "number" && Number.isFinite(v.schemaVersion) ? v.schemaVersion : 0;
}

/**
 * แปลงข้อมูลดิบ (จาก OPFS / localStorage / ไฟล์แบ็กอัป) ให้เป็น StockDB เวอร์ชันปัจจุบัน
 * รัน migration เฉพาะ step ที่ยังไม่เคยรัน แล้วปิดท้ายด้วย normalize เสมอ
 */
export function migrateDB(raw: unknown): StockDB {
  const input = (raw ?? {}) as RawDB;
  const from = detectSchemaVersion(input);

  if (from > CURRENT_SCHEMA_VERSION) {
    console.warn(
      `[db] ข้อมูลเป็น schema v${from} ซึ่งใหม่กว่าที่แอปรองรับ (v${CURRENT_SCHEMA_VERSION}) — ใช้ตามที่เป็นอยู่ อาจมีบางฟิลด์ที่แอปยังไม่รู้จัก`
    );
  }

  const migrated = MIGRATIONS.filter((m) => m.to > from).reduce((db, m) => m.up(db), input);
  return normalizeDB(migrated, from);
}
