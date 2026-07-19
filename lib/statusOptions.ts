import type { ItemStatus } from "./types";

export const STATUS_OPTIONS: { value: ItemStatus; label: string }[] = [
  { value: "", label: "ไม่ระบุ" },
  { value: "rebuy", label: "ซื้อซ้ำได้" },
  { value: "avoid", label: "ไม่ควรซื้อ" },
  { value: "have", label: "ได้ของอยู่แล้ว" },
];

export const STATUS_LABELS: Record<Exclude<ItemStatus, "">, string> = Object.fromEntries(
  STATUS_OPTIONS.filter((o) => o.value !== "").map((o) => [o.value, o.label])
) as Record<Exclude<ItemStatus, "">, string>;
