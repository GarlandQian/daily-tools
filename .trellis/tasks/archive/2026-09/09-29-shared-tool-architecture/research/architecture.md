# Architecture findings and decisions

## Application shell

`ToolsLayoutClient.tsx` is 852 lines and mixes animation scheduling, visibility, storage preferences, recent tools, shortcuts, theme transitions, and navigation markup. Separate these responsibilities into feature-scoped hooks and components. Catch unavailable browser-storage errors. Preserve all storage keys, theme transitions, mobile navigation, editable shortcut exclusions, and lazy command-palette loading.

The 116 menu leaves already match all 116 route pages with bilingual labels. Keep the catalog and static page metadata. Preserve case-sensitive legacy paths and child-first matching for virtual /life and /inspect categories.

## Local previews

DOCX, Excel, PDF, PPTX repeat file selection, metadata, object URL lifecycle, and renderer initialization. Some clear paths remove their DOM but retain initialized instances; clear/reupload then renders into detached DOM. Imports can reject outside error handling and stale promises can mutate current state. Give each file/render session explicit cleanup, stale-result protection, and error handling. Preserve file-size/render-expansion caps and lazy imports. Keep format-specific renderer adapters separate.

## Downloads

90 feature components declare downloadText, mostly identically. Centralize browser download lifecycle in src/utils/download.ts and migrate consumers while preserving bytes, MIME types, filenames, and default parameters. Existing CSV serializers vary semantically and remain domain-specific.

## Decision

Use focused shared primitives and bounded domain hooks rather than replacing the already-correct route architecture. No dependency or version upgrades. Regression checks should cover behavior at shared boundaries and real browser upload/export flows where feasible.
