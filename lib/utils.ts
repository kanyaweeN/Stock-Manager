// คัดลอกจาก app-template/lib/utils.ts — แก้ที่นี่แล้วต้องไปแก้ที่ template ด้วย
export function cn(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(" ");
}
