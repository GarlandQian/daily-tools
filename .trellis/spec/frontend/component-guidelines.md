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

(To be filled by the team)

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

---

## Accessibility

<!-- A11y requirements and patterns -->

(To be filled by the team)

---

## Common Mistakes

<!-- Component-related mistakes your team has made -->

- Do not place animated glass highlights or solid popover backgrounds in a rounded surface without clipping. It can leak outside the rounded corners, especially in date pickers, toasts, and floating panels.
- Do not make clipped popovers visually flat. Clipping fixes edge leaks, but the inner surface still needs translucency and highlight layers to read as liquid glass.
