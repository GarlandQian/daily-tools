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

### Pattern: Guard Local File Preview Expansion

**What**: Browser-only file preview tools must guard both the uploaded file size and the amount of DOM/work produced by third-party preview libraries.

**Why**: A file can be within the upload size cap but still expand into hundreds of rendered pages, slides, rows, canvases, or nested nodes. That expansion can make scrolling and route changes janky even when the file never leaves the browser.

**Required safeguards**:

- Keep hard file size caps before reading the file.
- Prefer library-level page, slide, row, or column caps when the library exposes them.
- If the library only exposes a full render API, trim or virtualize rendered sections after preview and show a localized partial-preview notice.
- Keep original-file download/reupload actions available when the preview is capped.
- Initialize heavy preview libraries only after a valid file is selected.

**Example**:

```tsx
const previewLimit = trimPreviewElements(containerRef.current, 'section.docx', 80)
if (previewLimit) {
  showNotice(t('app.preview.file.pages_limited', previewLimit))
}
```

---

## Testing Requirements

<!-- What level of testing is expected -->

(To be filled by the team)

### Convention: Route Smoke Tests in Next Dev

**What**: When smoke-testing many App Router pages against `next dev`, request routes sequentially with normal `GET` requests. Avoid high-concurrency `HEAD` sweeps against large route sets.

**Why**: In this project, a 6-wide `HEAD` sweep across tool routes corrupted `.next/dev/prerender-manifest.json` by appending a duplicate JSON tail. After that, unrelated pages returned 500 with `SyntaxError: Unexpected non-whitespace character after JSON` until the generated manifest was moved away and the dev server restarted. Sequential `GET` smoke over the same 116 tool routes returned 200 for every route and left the regenerated manifest valid JSON.

**Example**:

```ts
for (const route of routes) {
  const response = await fetch(`http://localhost:3000${route}`, {
    method: 'GET',
    headers: { Accept: 'text/html' }
  })
  assert(response.status === 200)
}
```

**Recovery**: If this dev-cache corruption appears, stop `next dev`, move or delete `.next/dev/prerender-manifest.json`, restart the dev server, and rerun the smoke test sequentially.

---

## Code Review Checklist

<!-- What reviewers should check -->

- Does a user-controlled input feed an unbounded synchronous loop, parser, regex, diff, or renderer?
- Does a live-updating component create its own interval instead of using the shared visible timer?
- Does a long list subscribe every row to a high-frequency store?
- Does a local file preview cap both file size and rendered page/row/slide expansion?
- Are large-input warnings translated in both supported locales?
