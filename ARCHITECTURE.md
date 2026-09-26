# Architecture (reusable template)

Client-side Next.js App Router + TypeScript. No backend. Persistence: OPFS → localStorage → optional file handle. Optional cloud sync = whole-DB JSON to Drive `appDataFolder`.

## Layering rule
Split by **testability**, not by feature.
- Pure functions → vitest, no jsdom.
- State/DOM/network → verify in browser.
- Lower layer never imports upper. `core` knows only `types`. `domain` knows `core`+`types`. `hooks` may know everything below.
- All imports use `@/...`. No relative paths.

## `lib/` layout
```
lib/types.ts       central types
lib/core/          util, no context: date, uid, download, cats     [tested]
lib/domain/        business logic (calc/decide/transform)          [tested]
lib/import/        parsers (HTML/text)                              [tested]
lib/forms/         entity ↔ draft (toX/fromX pair per entity)      [tested]
lib/db/            schema · migrations · normalize (index.ts = sole gate)
lib/sync/          network (OAuth, cloud APIs)
lib/hooks/         React hooks + Provider
lib/__tests__/     flat; do not mirror folders
```

## `components/` layout
```
components/AppShell.tsx    app shell (sidebar/tabbar/status), mounted in layout.tsx
components/ui/             domain-free primitives: ModalShell, TextField, icons, pickers
components/<feature>/      product/, import/, recipe/, ...
```
- `ui/*` may import only React + other `ui/*`. Importing `@/lib/domain/*` = not `ui/`.
- All modals extend one `ModalShell` (Escape, focus trap, aria, restore focus).
- Duplicated pickers/modals across features → extract one reusable component.

## Data layer
```
usePersistedDB (single source of truth for DB state)
  priority: OPFS file → localStorage → user file handle
StockDBProvider = Context wrapping usePersistedDB + cloud sync hook
useStockDB() → { db, setDb, status, driveSync? }
```

### Schema versioning
- `MIGRATIONS: { to, note, up(rawDb) }[]` ordered.
- `CURRENT_SCHEMA_VERSION` derived from last step.
- Data without `schemaVersion` = v0, replays every step ⇒ **every step must be idempotent**.
- `normalizeDB` runs after migrations: defaults, type coercion, dedupe. Pure default-filling belongs here, not in a migration.
- Changing entity shape ⇒ append migration step.

### Cloud sync (optional pattern)
- Whole DB JSON in one file, schema-agnostic (new fields sync free).
- Before overwriting: diff vs a snapshot of "state when app opened" (stored in localStorage). Manual push on risk → confirm. Auto push on risk → pause + banner.
- Pull replaces local DB wholesale, runs migrations on the way in.
- Hook mounted **once** at Provider. Never sync before local load finished (would push empty defaults over real data).

## Forms pattern
Per entity: one draft type + `toDraft` / `fromDraft` pair. Only place that knows field-by-field conversion. Add a field = update type + two functions.
- Numeric inputs stored as **strings** so user can clear while typing.
- Distinguish `0` (intentional) from empty (unset): `numOrUndef` vs `positiveOrUndef`.
- Never fallback pack size / divisor to `1` silently — corrupts unit-cost math.

## Domain rules that generalize
- One threshold per concept, one constant, one file. No re-declaring `<= min` inline.
- Return `null` when data is insufficient. Do not guess. Callers surface "unknown" separately.
- Idempotent operations at every entry (import merge, normalize, migration step).
- Money touched from many entry points → pass through one function (`normalizeShopName`, `applyPriceMode`, `roundPrice`).
- Deletions = move to `trash` array, not a hidden flag. Every list loop stays honest.
- Snapshot vs live: cost-at-time-of-purchase kept per event (price history); current cost derived. Never conflate.

## Import pipeline pattern (multi-source parser)
```
extractOrderPage(html, source)   sole entry
  ├─ shared: DOM parse, date, totals, per-row shop, ingredients
  └─ per-source row collector (one function per site)
```
- Add a site = 1 entry in `SITES` + 1 value in `Source` union + 1 collector. No changes to shared code.
- Never target CSS class names (sites randomize). Anchor on structural facts: "each row has a product image", "row must have a quantity badge".
- Text-only helpers (money/date/qty parsing) live in `lib/import/text.ts` and are tested.
- "First label wins" for totals — a page repeats the same amount under multiple labels; summing double-counts silently.

## Store the pattern, not the recipe
- Constants at module top, exported.
- Public API of each `lib/domain/*` file: 3–6 named functions. No default exports.
- No cross-domain imports inside `domain/`. Compose in hooks.
- Comments explain **why**, only when non-obvious (past bug, invariant, silent-failure trap). Never explain what.

## Anti-patterns (learned the hard way)
- Side effects (`confirm`, `alert`, network) inside a `setState` updater. React StrictMode double-invokes ⇒ prompts twice. Ask outside, then set.
- `new Date().toISOString().slice(0,10)` for a local calendar day (UTC skew).
- Reading raw fields with two representations (e.g. label expiry vs opened+PAO). Always through one resolver.
- Caching parsed results and mutating the cached array/object downstream.
- Positional column contracts (CSV/Sheets export): append only, never insert.
- Feature state duplicated in page + hook. State lives in the hook; page reads.

## Styling
- One global stylesheet split into `app/styles/*.css`, `@import` order matters (later overrides earlier). New rules append to the closest topical file.
- CSS custom properties with `prefers-color-scheme: dark` block. No hardcoded colors —
  including chart/category palettes (`--cat-1..8` in `app/styles/base.css`).
- No CSS-in-JS. No Tailwind — this is the workspace's *CSS track B*, which
  `../PROJECT-STANDARD.md` §1.1 recognises as a valid track (decided 2026-09-26).
- The only literal colors in TypeScript live in `lib/core/themeColors.ts`: the OS reads
  `viewport.themeColor` and the manifest before any CSS loads, so they cannot be `var()`.
- Conditional class names go through `cn()` from `@/lib/utils` (shared with app-template).
  Template literals are still fine for *concatenation* (`skin-score--${level}`).

## Testing
- vitest only. No jsdom. DOM-touching parsers verified manually in browser.
- Tests **import real modules**. Copying logic into tests = green while prod breaks.
- Mandatory coverage: every migration step, every money calculation, the overwrite-risk detector for cloud sync.

## Dev server
- Pin a port. Persistence is origin-scoped; different port = empty DB, user thinks data is lost.
- Cross-origin move = export/import JSON only.
