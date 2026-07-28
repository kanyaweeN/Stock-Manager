# stock-manager

Next.js (App Router) + TypeScript stock/inventory tracker. Thai UI. No backend — data persists client-side (OPFS/localStorage) with optional Google Sheets sync.

## Data flow

`app/page.tsx` (Home) is the only real page besides `/config`. It composes:

- `lib/StockDBProvider.tsx` — React context wrapping `usePersistedStockDB()`. Call `useStockDB()` to get `{ db, setDb, status }`. `db: StockDB = { items: StockItem[], categoryPresets: string[], updatedAt? }`.
- `lib/usePersistedDB.ts` — persistence engine. Priority: OPFS file → localStorage fallback → optional user-picked file handle. Don't touch unless changing storage strategy.
- `lib/useProductFilters.ts` — search/category/stock-tab/sort state + derived `filtered` list. All list-view filtering logic lives here.
- `lib/useProductActions.ts` — CRUD: `save`, `remove`, `inc`, `dec`, `importFromShopee`, `exportCsv`.
- `lib/db.ts` — `DEFAULT_DB` + `migrateDB(raw)`. **Any StockItem shape change must add a migration branch here** (old data in users' browsers won't have the new field).

## Data model (`lib/types.ts`)

```ts
StockItem { id, name, cats: string[], qty, min, note, img?, link?, status?, source?: "shopee"|"", price?, size?, variant? }
```

- `cats` is an **array** (multi-category since 2026-07-20). Anywhere `cat` (singular) appears, it's legacy — check `db.ts` migration.
- `ImportCandidate` (Shopee import staging row) still has a **singular** `cat: string` — intentionally simpler UX for the import form; gets wrapped into `cats: [c.cat]` in `useProductActions.importFromShopee`.

## Where things live

| Concern | File |
|---|---|
| Product card grid | `components/ProductGrid.tsx` |
| Add/edit product modal | `components/ProductModal.tsx` |
| Category multi-select (used in filter toolbar AND product modal) | `components/CategoryMultiSelect.tsx` — pass `allowCreate` to let user type a brand-new category inline |
| Shopee HTML paste-and-parse import | `components/ImportModal.tsx` + `lib/shopee.ts` (regex/DOM scraping of pasted page source) |
| Stats header (counts) | `components/StatsBar.tsx` |
| Reusable labeled input w/ copy·paste·clear buttons | `components/TextField.tsx` |
| Config page tabs (backup/categories/sheets/storage) | `components/config/*.tsx`, routed at `app/config/page.tsx` |
| Google Sheets push/pull (OAuth via GIS, columns A:L) | `lib/googleSheets.ts` — **column order is positional**; if you add a StockItem field, update `HEADER`, `itemsToRows`, `rowsToItems` together |

## Conventions specific to this repo

- Every user-facing string is Thai. Keep it that way.
- `cats`/CSV/Sheets serialize multi-value fields joined with `"; "` (see `useProductActions.exportCsv`, `googleSheets.ts`).
- Filter/sort/tab state all lives in `useProductFilters` — don't duplicate filter state in `page.tsx`.
- Styling is one global stylesheet, no CSS modules: `app/globals.css`, using CSS custom properties (`--bg`, `--card`, `--accent`, etc.) with a `prefers-color-scheme: dark` block. Match that pattern for new components — don't hardcode colors.
- Dev server port 3000 is often occupied by another session; `.claude/launch.json` has `autoPort: true` so `preview_start` picks a free port automatically.

## Gotchas when testing in the Browser pane

- Browser-tool `form_input`/`computer.type` can silently fail to update React controlled-input state (sets DOM value without a real `input` event). If a save button seems to no-op, verify via `javascript_tool` using the native value setter + dispatched `input` event before concluding there's a real bug.
- After editing hook return shapes (e.g. renaming a state var), do a hard reload / fresh tab — Fast Refresh sometimes shows a stale "hook order changed" error that clears on full reload.
