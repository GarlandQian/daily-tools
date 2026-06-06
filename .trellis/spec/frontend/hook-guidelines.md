# Hook Guidelines

> How hooks are used in this project.

---

## Overview

<!--
Document your project's hook conventions here.

Questions to answer:
- What custom hooks do you have?
- How do you handle data fetching?
- What are the naming conventions?
- How do you share stateful logic?
-->

(To be filled by the team)

---

## Custom Hook Patterns

<!-- How to create and structure custom hooks -->

### Convention: Shared Visible Timers

**What**: Components that need live wall-clock updates should share `useVisibleNow()` from `src/hooks/useVisibleNow.ts` instead of creating page-local `setInterval`, `useRafInterval`, or repeated `Date.now()` state loops.

**Why**: Tool pages such as `/social/time`, timestamp conversion, and JWT expiration can be mounted in the same app shell. A timer per component fans out into avoidable React renders and keeps work running while the tab is hidden.

**Example**:

```tsx
const now = useVisibleNow(expTimestamp !== null)
const isExpired = expTimestamp === null ? null : now >= expTimestamp
```

For large lists, pass `enabled=false` until the live region is near the viewport:

```tsx
const [ref, isNearViewport] = useNearViewport<HTMLDivElement>()
const now = useVisibleNow(isNearViewport)
```

**Related**: Use `createVisibleInterval()` only for imperative integrations that cannot reasonably subscribe through React, such as a third-party chart instance.

---

## Data Fetching

<!-- How data fetching is handled (React Query, SWR, etc.) -->

(To be filled by the team)

---

## Naming Conventions

<!-- Hook naming rules (use*, etc.) -->

(To be filled by the team)

---

## Common Mistakes

<!-- Hook-related mistakes your team has made -->

- Do not call `Date.now()` during render as a fallback value. React Compiler treats it as an impure render. Use a visible external store snapshot or compute the value in an event/effect.
- Do not subscribe every row in a large list to the shared live clock. Split static card chrome from live content, or enable the subscription only when the row is near the viewport.
