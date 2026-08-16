# stock-manager

Next.js (App Router) + TypeScript stock/inventory tracker. Thai UI. No backend — data persists client-side (OPFS/localStorage) with optional Google Drive sync.

## Data flow

`app/page.tsx` (Home) is the main list view; the other routes (`/config`, `/analyze`, `/cost`, `/summary`, `/plan`) read the same DB. Home composes:

- `lib/StockDBProvider.tsx` — React context wrapping `usePersistedStockDB()`. Call `useStockDB()` to get `{ db, setDb, status }`. `db: StockDB = { schemaVersion, items, categoryPresets, avoidIngredients?, skinProfile?, recipes?, plans?, updatedAt? }`.
- `lib/usePersistedDB.ts` — persistence engine. Priority: OPFS file → localStorage fallback → optional user-picked file handle. Don't touch unless changing storage strategy.
- `lib/useProductFilters.ts` — search/category/stock-tab/sort state + derived `filtered` list. All list-view filtering logic lives here. Default sort is `"bought-desc"` (ซื้อล่าสุด) = `item.purchasedAt` desc — **not** `"added-desc"` (เพิ่มล่าสุด, `item.createdAt`), because a repeat Shopee purchase merges into the existing row and leaves `createdAt` untouched, so just-bought items never surface under `added-desc`. Both fall back to position in `db.items` when dates tie or are missing.
- `lib/useProductActions.ts` — CRUD: `save`, `remove`, `inc`, `dec`, `groupItems`, `ungroup`, `setCatsForItems`, `importFromShopee`, `exportCsv`.
- `lib/db.ts` — `StockDB` type, `DEFAULT_DB`, and versioned migrations. `db.schemaVersion` tracks the shape; `MIGRATIONS` is an ordered list of `{ to, note, up(rawDb) }` steps and `CURRENT_SCHEMA_VERSION` is derived from the last one. `migrateDB(raw)` runs only the steps newer than the data's version, then always runs `normalizeDB` (defaults + type coercion + parent-category dedupe). **Changing the StockItem/StockDB shape ⇒ append a new step to `MIGRATIONS`** (data without `schemaVersion` counts as v0 and replays every step, so each step must be idempotent). Pure default-filling needs no step — put it in `normalizeDB`.

## Data model (`lib/types.ts`)

```ts
StockItem { id, name, cats: string[], qty, min, note, img?, link?, status?, source?: "shopee"|"", price?, size?, variant?, groupId?, groupName?, purchasedAt?, createdAt?, ingredients? }
```

- `cats` is an **array** (multi-category since 2026-07-20). Anywhere `cat` (singular) appears, it's legacy — check `db.ts` migration.
- `createdAt` (ISO) is set **once** when the item is created and never touched by edits or repeat purchases — that's what "เพิ่มล่าสุด" sorts on. `purchasedAt` (YYYY-MM-DD) is the opposite: it *does* bump on a repeat Shopee import. `/summary` doesn't sum on it though — it sums `priceHistory` points (see the summary row below); `purchasedAt` only fills in the date of a point that has none.
- `ImportCandidate` (Shopee import staging row) carries `cats: string[]` + `mergeExisting`/`mergeFields` for the repeat-purchase flow — a candidate with `existingId` merges into the existing item instead of adding a row.

## Where things live

| Concern | File |
|---|---|
| **App shell** — sidebar (≥861px) / bottom tab bar (mobile), sync status, version | `components/AppShell.tsx`, mounted once in `app/layout.tsx`. Every page gets nav for free, so pages must NOT add their own "← กลับหน้าหลัก" link. Add a route ⇒ add it to `NAV` |
| Product card grid | `components/ProductGrid.tsx` — same markup for both breakpoints; CSS turns the card into a horizontal list row under 640px. Per-card ⋯ menu (แก้ไข/ใส่สูตร/ลบ) lives here, so `.product-card` must stay `overflow: visible` |
| Add/edit product modal | `components/ProductModal.tsx` |
| Category multi-select (used in filter toolbar AND product modal) | `components/CategoryMultiSelect.tsx` — pass `allowCreate` to let user type a brand-new category inline |
| Shopee HTML paste-and-parse import | `components/ImportModal.tsx` + `lib/shopee.ts` (regex/DOM scraping of pasted page source) |
| Home toolbar — search, filter chips row, primary button, ⋯ menu | `components/Toolbar.tsx`. **นำเข้าจาก Shopee คือทางหลักที่ของเข้าสต็อก** จึงเป็นปุ่ม primary บนแถบ (และ FAB ตัวใหญ่บนมือถือ) ส่วน "เพิ่มเอง" เป็นปุ่มรอง/FAB ตัวเล็กที่ซ้อนอยู่ด้านบน — คำสั่งที่ใช้นานๆ ครั้ง (ส่งออก/สร้างสูตร/เลือกหลายอัน) อยู่ในเมนู ⋯ |
| Clickable count chips (ยุบ StatsBar + stock-tabs เดิมเป็นแถวเดียว) | `components/FilterChips.tsx` — one chip active at a time; `ChipKey = StockTab \| "uncategorized"`. `.stats`/`.stat` CSS still exists for `/cost` + `/summary` |
| Reusable labeled input w/ copy·paste·clear buttons | `components/TextField.tsx` |
| Config page tabs (backup/categories/sheets/storage) | `components/config/*.tsx`, routed at `app/config/page.tsx` |
| Ingredient (INCI) analysis — offline dictionary, tags, conflict rules | `lib/ingredients.ts` — **no network, no API**. Add ingredients to `INGREDIENT_DB`, tag pairs that clash to `CONFLICT_RULES`. New tag ⇒ also add to `TAG_META` + `TAG_PRIORITY` |
| Ingredient analysis UI (tag chips, warnings, parsed list) | `components/IngredientPanel.tsx` — used in `ProductModal` and `/analyze` |
| Multi-product ingredient comparison + user's avoid-list | `app/analyze/page.tsx`. Avoid-list is `StockDB.avoidIngredients` (not per-item) |
| คำนวณต้นทุน (สูตรผลิต → ต้นทุน/ชิ้น, กำไร) | `lib/cost.ts` (คำนวณล้วนๆ ไม่มี state) + `lib/useRecipeActions.ts` (CRUD) + `app/cost/page.tsx` + `components/RecipeModal.tsx`. เก็บใน `StockDB.recipes`; ต้นทุนบรรทัด = `buyPrice ÷ packAmount × usedAmount`. เลือกสินค้าจากสต็อกแล้วดึงราคา/ขนาด (`parsePackSize` แกะ `item.size` เช่น `"1000 g"`) มาเติมให้ เปิด `RecipeModal` ได้จาก 3 ทาง: หน้า `/cost`, ปุ่ม 🧮 บนการ์ดสินค้า (`ProductGrid.onAddToRecipe`) และปุ่มในแถบเลือกหลายอันของ `app/page.tsx` — **ไม่ตัดสต็อกอัตโนมัติ** สูตรจะติดไปกับ Drive sync + แบ็กอัป JSON (แต่ไม่ไป Google Sheets ที่ส่งออกเฉพาะ items) |
| วางแผนซื้อของ (เดือนหน้า/ปีใหม่ต้องซื้ออะไร ซื้อไปแล้วเท่าไร) | `lib/plan.ts` (คำนวณล้วนๆ) + `lib/usePlanActions.ts` (CRUD) + `app/plan/page.tsx` + `components/PlanModal.tsx` เก็บใน `StockDB.plans`. ยอดบรรทัด = `price × qty`; ติ๊ก `bought` แล้วยอดย้ายจาก "ยังต้องจ่าย" ไป "จ่ายไปแล้ว" (ใช้ `paidPrice` ถ้ากรอก) — **ไม่ยุ่งกับสต็อก** สต็อกอัปเดตทางนำเข้า Shopee เท่านั้น `suggestForPlan` ดึงของหมด/ใกล้หมด/ติดธง `rebuy` มาเสนอ ส่วน `boughtHint` เตือนเฉยๆ ว่าของชิ้นนั้นถูกนำเข้าสต็อกหลังสร้างแผนแล้ว (ไม่ติ๊กให้เอง เพราะ `purchasedAt` อาจเป็นการซื้อรอบอื่น) วันครบกำหนดของพรีเซ็ตคิดจาก `endOfMonthISO`/`monthISO` ใน `lib/date.ts` |
| สรุปยอด (จ่ายไปเท่าไร เดือนไหน หมวดไหน) | `lib/summary.ts` (คำนวณล้วนๆ) + `app/summary/page.tsx`. **ทุกยอดคิดจาก "ครั้งที่ซื้อ" = จุดใน `item.priceHistory` (`spendEvents`) ไม่ใช่ `price × qty` ของสต็อกที่เหลือ** ของที่ใช้หมดแล้วจึงยังนับเป็นยอดของเดือนที่ซื้อ และของที่ซื้อซ้ำจะกระจายยอดไปตามเดือนจริง ไม่กองที่ `purchasedAt` ครั้งล่าสุด — `stockValue` (มูลค่าของที่เหลือ) เป็นยอดคนละตัว จุดที่ไม่มีวันที่ตกไปอยู่แถว "ไม่ทราบวันที่" และไม่เข้าตัวกรองช่วงวัน `summaryInsights` แปลตัวเลขเป็นประโยคไทย (เทียบเดือนก่อน/ค่าเฉลี่ย, หมวดที่กินงบ, ราคาขึ้น, ข้อมูลที่ยังขาด) — เพิ่มประโยคใหม่ที่นี่ที่เดียว |
| Google OAuth token (GIS, client-side only) | `lib/googleAuth.ts` — `requestAccessToken(clientId, scope, silent)`. Shared by Drive + Sheets; same OAuth client id, different scope |
| **Cloud sync (the real one)** — whole `StockDB` as one JSON file in Drive `appDataFolder` | `lib/googleDrive.ts` + `lib/useGoogleDriveSync.ts` + `components/config/DriveTab.tsx`. Schema-agnostic: new StockDB fields sync automatically, nothing to update here. Pull replaces the local DB wholesale (runs `migrateDB` on the way in) |
| Google Sheets **export only** (no pull) | `lib/googleSheets.ts` — **column order is positional**; ranges (`ITEMS_RANGE`, `PRESETS_CELL`, write range) derive from `HEADER.length`, so adding a StockItem field = append to `HEADER` + `itemsToRows`. Append at the END or old sheets shift out of alignment. Pull was removed on purpose — a sheet only holds `items`, so pulling wiped `recipes`/`skinProfile`/uncolumned fields |

## Conventions specific to this repo

- Every user-facing string is Thai. Keep it that way.
- วันที่แบบ `YYYY-MM-DD` (`purchasedAt`, `priceHistory[].date`, `plans[].dueDate`/`lines[].boughtAt`, ช่วงวันใน `/summary`, ชื่อไฟล์ export) ใช้ `todayISO()`/`daysAgoISO()`/`endOfMonthISO()`/`daysUntil()` จาก `lib/date.ts` เท่านั้น — **ห้าม** `new Date().toISOString().slice(0, 10)` เพราะนั่นคือวันที่ตาม UTC ไทยเร็วกว่า 7 ชม. เลยได้ "เมื่อวาน" ตั้งแต่เที่ยงคืนถึง 7 โมงเช้า (`createdAt`/`updatedAt` ที่เป็น timestamp เต็มยังใช้ `toISOString()` ได้ตามปกติ)
- `lib/ingredients.ts` แคชผลไว้ 3 ชั้น (`defsFor`, `itemTags`, `analyzeIngredients`) เพราะทั้งสต็อกถูก parse ใหม่ทุกครั้งที่ `db.items` เปลี่ยน identity — อาร์เรย์/ออบเจ็กต์ที่คืนมาถูกใช้ร่วมกัน **ห้ามแก้ไข** ให้ copy ก่อนถ้าจะ sort/push
- `cats`/CSV/Sheets serialize multi-value fields joined with `"; "` (see `useProductActions.exportCsv`, `googleSheets.ts`).
- Filter/sort/tab state all lives in `useProductFilters` — don't duplicate filter state in `page.tsx`.
- Styling is one global stylesheet, no CSS modules: `app/globals.css`, using CSS custom properties (`--bg`, `--panel`, `--card`, `--accent`/`--accent-soft`, `--ok`, `--low`, `--danger`, `--violet` + `-soft` pairs, `--shadow-1/2`) with a `prefers-color-scheme: dark` block. Match that pattern for new components — don't hardcode colors.
- Page root is `.page` (`.wrap` kept as an alias). Breakpoints: **860px** = shell switches sidebar → bottom tab bar (`--side-w`, `--tabbar-h` drive the offsets of `.select-action-bar` and `.fab`), **640px** = product cards switch to list rows.
- Low/out-of-stock is shown as a thin colored bar on the card's left edge (`.product-card.low-row::before`) — not by tinting the whole card, which fought with the ingredient tag colors.
- Dev server port 3000 is often occupied by another session; `.claude/launch.json` has `autoPort: true` so `preview_start` picks a free port automatically.

## Gotchas when testing in the Browser pane

- Browser-tool `form_input`/`computer.type` can silently fail to update React controlled-input state (sets DOM value without a real `input` event). If a save button seems to no-op, verify via `javascript_tool` using the native value setter + dispatched `input` event before concluding there's a real bug.
- After editing hook return shapes (e.g. renaming a state var), do a hard reload / fresh tab — Fast Refresh sometimes shows a stale "hook order changed" error that clears on full reload.
