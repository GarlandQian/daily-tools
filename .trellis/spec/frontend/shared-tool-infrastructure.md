# Shared Tool Infrastructure

## Scope

Use these contracts when changing the application shell, adding a browser export,
or integrating a local document renderer. Route wrappers remain under
`src/app/[locale]/(tools)`; shared shell behavior lives in
`src/features/navigation`, and preview-specific behavior in `src/features/preview`.

## Signatures

- `downloadBlob(blob: Blob, filename: string): void`
- `downloadText(content: string, filename: string, type?: string): void`
- `readLocalStorage(key: string): string | null`
- `writeLocalStorage(key: string, value: string): void`
- `useLocalFilePreview(format, messages)` owns file selection, validation, renderer
  containers, loading/error/result state, clear/reupload, and original downloads.
- `startPreviewSession({ create, onSuccess, onError, release, previous })` returns
  `{ settled, cancel }`; adapters supply `render()` and `dispose()`.

## Contracts

### Navigation and preferences

- Keep the existing `theme-preference`, `ui-language`, `ui-direction`,
  `ui-sidebar-collapsed`, and `ui-recent-tools` keys.
- Server rendering and hydration use deterministic defaults. Restore saved values
  before enabling persistence; defaults must not overwrite saved preferences.
- Storage is optional. Denied reads return `null`; denied writes are ignored.
- Recent tools must be known routes, unique, most-recent first, and limited to six.
- Preserve child-first catalog matching for virtual categories such as `/life`
  and `/inspect`. Route path case is significant.
- Normalize configured locale prefixes before matching the catalog. Production
  prerendering can see an internal `/en/...` or `/cn/...` pathname while the
  browser sees the public path; both must produce the same initial navigation.
- Load the command palette only after activation. Shortcuts must not steal typing
  from inputs, textareas, selects, editable content, or textbox widgets.
- The command dialog needs a linked title and description for assistive technology.
- Theme transition callbacks and timers belong to one transition and must not
  apply stale state or remove a newer transition's classes.

### Translation deployment output

- Keep both locale dictionaries in the shared client translation provider's
  module imports. Each provider still creates its own i18next instance for SSR.
- Pass the selected locale across the server/client boundary, never the full
  dictionaries. Resource props are serialized into every prerendered HTML and
  RSC segment and can multiply megabytes of text across hundreds of outputs.
- Both languages must be available synchronously for saved-language restoration
  and the existing language switch. Namespace or lazy-loading changes require
  preserving translated SSR and handling loading before switching.
- Measure logical file bytes for production HTML/RSC and shared static assets;
  local disk allocation and development caches are not Vercel billing metrics.

### Downloads

- Text defaults to `text/plain;charset=utf-8`, uses UTF-8, and adds no BOM.
- Callers own content generation, filename, and MIME type. Consolidation must not
  change domain serializers such as CSV escaping.
- Attach the anchor before clicking, remove it even when clicking fails, and
  release each object URL after a short delay so the browser can consume it.
- Original-file downloads pass the selected `File` directly to `downloadBlob`.

### Preview sessions

- Validate extension/MIME and file size before importing heavy renderers.
- Every selected file owns a fresh child container and object URL. Never retain
  an initialized renderer bound to an old or removed container.
- Clear, replace, and unmount cancel the session. Late import/render completion
  must not update the current preview. Destroy and release each session once.
- Set `serializeSessions: true` only for Excel/PPTX, whose renderers share
  module-level resources. Independent DOCX/PDF sessions must allow a replacement
  to start even when an old renderer remains pending. Remove canceled content
  immediately and defer its resource cleanup until safe teardown.
- Readiness must follow the installed runtime API. The installed PDF library's
  `preview()` returns void even though its declaration says Promise: use
  `onRendered` / `onError` for completion.
- Keep existing upload and rendering bounds. The Excel library ignores
  `maxRows` / `maxCols`; apply the 2,000-row / 80-column cap through its supported
  `beforeTransformData` callback, including merges and image anchors.

## Validation and Error Matrix

| Condition | Expected behavior |
| --- | --- |
| Malformed or inaccessible storage | Usable shell with defaults |
| Unknown or duplicate recent path | Filtered from the recent list |
| Download append/click throws | Anchor and object URL still cleaned up; error propagates |
| Unsupported/oversize upload | Localized validation error; existing valid selection retained |
| Import or render failure | Loading ends and localized preview error is shown |
| Clear/replace during pending render | No stale result; old resources released after safe teardown |
| Renderer destroy throws | Session resources still released and replacement can proceed |

## Good, Base, and Bad Cases

- Good: upload a valid DOCX, replace it, clear it, and upload the same file again;
  only the current document is rendered and the original downloads unchanged.
- Base: localStorage is blocked; navigation and theme controls still work for the
  current session without persistence.
- Bad: a renderer import rejects or a damaged PDF is selected; show a recoverable
  error instead of a permanent loading spinner.

## Required Verification

- `pnpm test` covers catalog/route/translation parity, persisted-value validation,
  download bytes/MIME/cleanup, preview races, and Excel expansion limits.
- `pnpm check` includes lint, TypeScript, the regression suite, and production build.
- Browser checks must use real DOCX/XLSX/PDF/PPTX fixtures for upload, replacement,
  clear/reupload, and original-file download; include corrupt-file recovery.
- Check language/direction/theme and collapsed-sidebar persistence, editable
  shortcut exclusions, mobile navigation, and tool-search navigation.

## Wrong vs Correct

```ts
// Wrong: the instance still points at the removed DOM after clear.
container.replaceChildren()
isInitialized = true

// Correct: invalidate pending work and release the renderer's owned resources.
session.cancel()
```

Keep the shared lifecycle in hooks/session helpers; format adapters handle only
library initialization, rendering, format-specific limits, and destruction.
