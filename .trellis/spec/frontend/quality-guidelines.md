# Quality Guidelines

> Code quality standards for frontend development.

---

## Overview

<!--
Document your project's quality standards here.

Questions to answer:
- What patterns are forbidden?
- What linting rules do you enforce?
- What are your testing requirements?
- What code review standards apply?
-->

(To be filled by the team)

---

## Forbidden Patterns

<!-- Patterns that should never be used and why -->

(To be filled by the team)

---

## Required Patterns

<!-- Patterns that must always be used -->

### Pattern: Guard Expensive Client-Side Text Work

**What**: Client-only tools that parse, diff, format, highlight, hash, or run user-provided expressions must cap synchronous main-thread work and show a graceful partial-result warning when input is large.

**Why**: Deferring state with `useDeferredValue()` keeps typing responsive, but it does not make the underlying calculation interruptible. Large diffs, pathological regex patterns, or huge render outputs can still freeze the page if the work is unbounded.

**Required safeguards**:

- Use `useDeferredValue()` for text inputs that trigger non-trivial derived computation.
- Add size caps for synchronous operations such as regex evaluation, character diffing, JSON-to-TypeScript generation, Markdown previewing, and statistics over very large strings.
- Cap rendered result rows/chunks when output can explode in size.
- Localize warning text in both `src/locales/en.json` and `src/locales/cn.json`.
- Yield between independent large-file operations with `yieldToMain()` or move the work to a worker when the operation cannot be safely capped.

**Example**:

```tsx
const deferredText = useDeferredValue(text)
const result = useMemo(() => {
  const safeText = deferredText.slice(0, MAX_INPUT_CHARS)
  return parseExpensiveResult(safeText)
}, [deferredText])
```

---

## Testing Requirements

<!-- What level of testing is expected -->

(To be filled by the team)

---

## Code Review Checklist

<!-- What reviewers should check -->

- Does a user-controlled input feed an unbounded synchronous loop, parser, regex, diff, or renderer?
- Does a live-updating component create its own interval instead of using the shared visible timer?
- Does a long list subscribe every row to a high-frequency store?
- Are large-input warnings translated in both supported locales?
