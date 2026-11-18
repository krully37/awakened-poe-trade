# Data patches (fork-only)

Fixes on top of upstream's generated `public/data/<lang>/{stats,items}.ndjson`.
`src/assets/apply-data-patches.mjs` applies them automatically before index
files are built (`npm run dev` and `npm run build`). It is idempotent.

| File | Effect |
|------|--------|
| `<lang>/stats.<name>.ndjson` | Replaces the upstream stat with the same `ref` (also inside a stat group), or appends it if missing |
| `<lang>/items.<name>.ndjson` | Appends the item only if upstream has none with the same `namespace` + `refName` |

## Current patches

- `stats.atzoatl-rooms` – Chronicle of Atzoatl rooms. The 3.30 data update
  switched room matchers to trade-site text (`Has Room: X `) and dropped
  `option: true`, so rooms on the item never matched (upstream #1958).
  Matchers are the in-game room names; where a KO/CN translation changed
  between 3.29 and 3.30, both names are kept.
- `stats.viscera` / `items.viscera` – Viscera bases and their implicit stats
  (3.30 Covens), from Ex4amp1e's fork (upstream #1951).
- `items.legacy-uniques` – uniques that upstream data updates removed over
  time, restored so Standard items still price check (upstream #1947). Only
  uniques whose base type still exists are included.

## After merging an upstream data update

1. On conflicts in `public/data/**/*.ndjson`, take upstream's version.
2. Run `npm run build` in `renderer/` to re-apply the patches.
3. Commit the re-patched `.ndjson` files.
4. Drop a patch file once upstream ships the same fix.
