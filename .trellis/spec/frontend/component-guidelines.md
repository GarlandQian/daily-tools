# Component Guidelines

> How components are built in this project.

---

## Overview

<!--
Document your project's component conventions here.

Questions to answer:
- What component patterns do you use?
- How are props defined?
- How do you handle composition?
- What accessibility standards apply?
-->

(To be filled by the team)

---

## Component Structure

<!-- Standard structure of a component file -->

### Convention: Tool Page Additions

**What**: A new tool page must include all of these project touchpoints:

- `src/app/[locale]/(tools)/<category>/<tool>/page.tsx` with static `metadata`
- `src/features/<category>/components/<Tool>Client.tsx` for the interactive client UI
- `src/config/menus.tsx` entry so the tool is discoverable in navigation
- Matching `app.<category>.<tool>` title and feature-specific keys in both `src/locales/en.json` and `src/locales/cn.json`
- `package.json` and `pnpm-lock.yaml` updates when a parser or domain library is needed

**Why**: Tool pages are routed, navigated, translated, and statically built through separate layers. Missing one layer creates invisible pages, untranslated menu labels, or Vercel build drift.

**Example**:

```tsx
// src/app/[locale]/(tools)/format/yaml/page.tsx
import type { Metadata } from 'next'

import YamlClient from '@/features/format/components/YamlClient'

export const metadata: Metadata = {
  title: 'YAML Formatter - Daily Tools',
  description: 'Format, minify, validate, and convert YAML and JSON'
}

export default function YamlPage() {
  return <YamlClient />
}
```

---

## Props Conventions

<!-- How props should be defined and typed -->

(To be filled by the team)

---

## Styling Patterns

<!-- How styles are applied (CSS modules, styled-components, Tailwind, etc.) -->

- Shared visual primitives live in `src/app/globals.css` and are composed with Tailwind utility classes.
- Rounded liquid-glass surfaces should keep internal highlights, shimmer, and popover backgrounds clipped to the visible radius. Use `glass-clip` for explicit clipping, or rely on the global `.glass-panel` clipping behavior when the surface is not a scroll container.
- If a glass surface must scroll, declare the scroll behavior explicitly with Tailwind overflow utilities such as `overflow-auto`; the global clip rule intentionally does not override explicit scroll utilities.
- Floating popovers should preserve the liquid-glass feel with translucent layered backgrounds, backdrop blur, and clipped specular highlights. Do not replace them with an opaque solid surface token.
- Select controls use the shared headless `Select` component. Keep the native `<select>` hidden for form compatibility, and render the visible control as a liquid-glass trigger plus portal listbox so the menu can escape clipped cards.
- Color inputs use the shared `ColorPicker` component. Keep the native color input hidden inside a liquid-glass swatch control with a visible color preview and HEX value instead of exposing the browser's raw color input.
- Inspector-style tools should keep the raw input as the primary state, derive parsed summaries with `useMemo`, and expose practical affordances such as current/sample input, copy actions, empty states, compact signal badges, and raw JSON output.

---

## Accessibility

<!-- A11y requirements and patterns -->

(To be filled by the team)

---

## Common Mistakes

<!-- Component-related mistakes your team has made -->

- Do not place animated glass highlights or solid popover backgrounds in a rounded surface without clipping. It can leak outside the rounded corners, especially in date pickers, toasts, and floating panels.
- Do not make clipped popovers visually flat. Clipping fixes edge leaks, but the inner surface still needs translucency and highlight layers to read as liquid glass.
- Do not expose native browser select dropdowns in tool forms. They cannot match the liquid-glass visual system and their option panels are not consistently styleable across browsers.
- Do not expose native browser color inputs as visible long rectangles. They look inconsistent across browsers and break the liquid-glass control language.
- Do not store duplicated parser result state when it can be derived from the current input. Duplicated parse state drifts easily when sample/reset/clear actions are added.
