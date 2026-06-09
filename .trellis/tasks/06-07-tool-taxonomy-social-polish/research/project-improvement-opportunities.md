# Project Improvement Opportunities

Exploration date: 2026-06-07 23:19 CST

Scope: read-only exploration of current navigation taxonomy, `/generation/env`, and frontend performance/maintainability opportunities. No product code was changed during this exploration.

## High-Priority Opportunities

1. Decouple menu identity from route paths.
   `src/config/menus.tsx` currently uses virtual paths such as `/life` and `/inspect` as category identifiers. `ToolsLayoutClient` also treats those paths as breadcrumb and navigation targets. A clearer schema with `id`, `labelKey`, `defaultPath`, and `children` would make mobile drawer, collapsed sidebar, active states, and breadcrumbs less fragile.

2. Add a command palette or tool search.
   The app has 63 tool pages and already depends on `cmdk`, but the dependency is unused. A localized command palette would reduce reliance on long sidebar scanning, especially on mobile and collapsed desktop sidebar states.

3. Improve `/generation/env` audit quality.
   The env builder already parses variables and emits useful output, but parser errors are hard-coded in English, the audit does not flag duplicate keys or public secrets, and every parsed row is rendered. Add localized structured parser errors, high-signal audit flags, and a capped/virtualized audit list.

4. Stabilize first paint and providers.
   `ThemeProvider` currently hides the whole app until mounted, and `TranslationsProvider` initializes i18n during render. Improving these would affect every route and should be treated as one of the highest-impact performance refinements.

5. Make bundle analysis part of the workflow.
   `@next/bundle-analyzer` is configured in `next.config.mjs`, but `package.json` has no `analyze` script. Add a routine way to inspect route bundles, then verify heavy route-only dependencies such as `sql-formatter`, `yaml`, `ua-parser-js`, `crypto-js`, preview libraries, and Three/R3F.

## Navigation And IA

- Keep route URLs stable, but model visual groups separately from URL groups.
- Keep `app.social` neutral because `/social/time` and `/social/keycode` are no longer in the finance group. Let `app.menu.life` carry the Personal Finance / 生活财务 label.
- Consider renaming `Time & Debug` / `时间调试`. The grouping contains world time and keyboard event inspection, which are both inspectors but not both time tools. Candidate direction: `Inspectors` / `检查工具`, with child `World Time` / `世界时间`.
- Choose a stronger ordering principle for the sidebar:
  - Daily-first: finance, time/inspectors, generators, converters, format/parse, preview, hash, crypto.
  - Developer-workflow-first: format/parse, converters, generators, preview, hash, crypto, inspectors, finance.
- Improve collapsed desktop behavior. Today category clicks navigate to the first child, while the active child is only implied by the category icon. A flyout, mini child list, or active-child tooltip would make this state clearer.
- Tighten broad category labels:
  - `Text Tools` is more accurately `Format & Parse`.
  - `Converters` includes lookups and inspectors, so it may need either a broader label or child rebalancing.
  - `Hash Checks` includes HMAC and PBKDF, so its label should imply derivation as well as checksum.

## `/generation/env` Feature Polish

- Return structured parser errors instead of literal strings, then localize line errors in `src/locales/cn.json` and `src/locales/en.json`.
- Localize the input placeholder.
- Flag duplicate keys, public variables that look sensitive, empty sensitive values, invalid lines, and unterminated quotes.
- Render only the first 200-500 audit rows, with a localized note when more are present.
- Move copy/download actions into the output panel, matching nearby generator tools.
- Add framework samples: Next.js, Vite, Node API, and Docker Compose.
- Improve parser fidelity for `export KEY=value`, multiple preceding comments, inline comments outside quotes, and quoted values.
- Add a `ProcessEnv` declaration output option for `env.d.ts`.
- Add `aria-invalid`, `aria-describedby`, and `role="alert"` around parser errors and truncation warnings.

## Performance And Maintainability

- First paint:
  - Avoid blanking the full app while theme is mounting.
  - Avoid recreating or initializing i18n during render.
- Bundles:
  - Add an `analyze` script.
  - Inspect whether route-only heavy packages stay isolated.
  - Prefer dynamic imports for modules only needed after user action or only inside previews.
- `/social/time`:
  - Reduce render fanout from one-second dashboard ticks plus zone-card subscriptions.
  - Consider component isolation, virtualization, or capped visible rendering for long world-time lists.
- Shared UI utilities:
  - `Select` and `date-picker` duplicate floating positioning, portal, scroll/resize listeners, and keyboard handling. A shared floating-layer helper would reduce edge-case drift.
- Preview tools:
  - PDF object URLs are revoked, but DOCX and Excel preview flows need the same cleanup discipline.
- Social calculators:
  - `parseAmount`, input field wrappers, metric cards, reset handling, and summary composition repeat across salary, pension, and housing-fund tools. Extract only once duplication becomes stable enough.
- Live parsers:
  - Many large-input guards were added, but parsing policy is inconsistent. Standardize which tools parse live, which parse deferred, and which require explicit action for expensive work.

## Suggested Execution Order

1. Implement `/generation/env` structured errors, audit flags, row cap, and accessibility. This is narrow and user-visible.
2. Add bundle analysis script and run a route-bundle audit before changing heavy imports.
3. Refactor menu config to split visual category identity from route paths.
4. Add command palette/tool search using existing `cmdk`.
5. Address first-paint/provider stability after checking hydration behavior carefully.
6. Clean preview object URL handling and shared floating-layer logic as maintenance passes.

