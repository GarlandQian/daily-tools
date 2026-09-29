# Verification record

## Scope and review

- Shared navigation replaces the former 852-line shell with focused components,
  preference/shortcut/history hooks, and explicit animation cleanup.
- 91 tool components use shared download helpers. Existing serialization,
  filenames, and MIME parameters were checked against the original code.
- DOCX/XLSX/PDF/PPTX now share file/session ownership while keeping lazy format
  adapters and upload/render bounds.
- Independent review fixed pending-session blocking for independent renderers;
  only Excel/PPTX serialize their library-level shared resources.
- Browser review found production locale-prefix hydration drift and missing
  command-dialog accessibility metadata. Both received targeted fixes.
- No tool routes or versions changed. Radix Dialog 1.1.15 is now a direct
  dependency at the same version already in the lockfile; no package upgrade.

## Automated checks

- Final `pnpm check` passed: full ESLint, TypeScript, 23 regression tests, and
  production build (236 generated pages).
- Catalog checks cover all 116 pages, matching menu entries, both language
  dictionaries, virtual categories, and case-sensitive paths.
- Regression coverage includes preference parsing, unavailable storage, theme
  cancellation, text/binary download bytes and cleanup failures, preview races,
  Excel expansion limits, and locale-prefixed prerender paths.
- All 116 production tool URLs were individually requested and returned 200
  with expected HTML titles (two existing routes inherit the root title).

## Real browser checks

- Real DOCX/XLSX/PDF/PPTX fixtures: upload, clear, and reupload a second document.
  DOCX/PPTX displayed the selected fixture text; PDF rendered a canvas; Excel
  loaded the workbook sheet and completed loading after reupload.
- Corrupt DOCX and PDF files showed recoverable errors, then accepted valid files.
- Original DOCX download matched the uploaded file's SHA-256 exactly.
- Shared UUID export downloaded eight valid UUIDs with the expected filename.
- Direction, sidebar collapse, theme, and language persisted through reload.
- Slash opens search; Escape closes it; Ctrl+K does not capture an active input.
- Searching MD5 navigates to the correct tool. Mobile navigation selects SHA.
- Tools and theme controls remain usable with localStorage access denied.
- Final production retest used fresh browser contexts for reload, language
  restoration, search navigation, mobile drawer dismissal, and denied storage:
  no JavaScript exceptions or console errors. Hydration and dialog warnings
  were resolved.

Fixtures and browser logs are local-only and excluded from the commit.
