# Refactor shared tool architecture and navigation

## Goal

Improve maintainability and consistency across the existing tool collection, then validate, commit, and push the completed work. The user explicitly delegates design and scope decisions ("自由发挥，全局重构下，完成后提交到远程").

## Requirements

- Consolidate repeated cross-feature infrastructure based on repository research.
- Preserve existing tool URLs, localized functionality, and the Liquid Glass design.
- Preserve user work and the configured GitHub noreply identity.
- Use ordinary commits and a normal remote push for this task.
- Keep changes focused on architecture and reliability; no speculative new product features or version bump.

## Acceptance Criteria

- [x] Shared infrastructure replaces duplicated consumers without losing tools.
- [x] Lint, TypeScript checks, and production build pass.
- [x] Meaningful regression checks cover changed shared contracts.
- [x] Documentation describes the resulting architecture.
- [ ] Reviewed changes are committed and pushed to origin.

## Technical Notes

- Next.js 16, React 19, TypeScript, Tailwind CSS 4, pnpm 11, Node 24.
- All feature implementations live under `src/features`; App Router pages provide entry points.
- Working tree starts clean at `3d5e460` on `main`.
- Research complete: tool catalog/navigation and shared feature lifecycle patterns.

## Open Questions

None requiring user input; the user authorized autonomous scope choices.

## Implementation Scope

1. Extract shared app-shell concerns into focused components/hooks; harden persistence, preserve routes, localized navigation, theme/direction controls, recent tools, and shortcuts.
2. Introduce shared downloadBlob/downloadText and migrate repeated downloads across tools without changing content or MIME/filename conventions.
3. Share local-file lifecycle across DOCX/Excel/PDF/PPTX, with fresh renderer ownership per mounted container, cancellation/stale-result guards, and clear/reupload safety.
4. Add focused regression checks and update frontend architecture documentation.

## Research References

- research/architecture.md

## Scope Authorization

The user delegated scope and implementation decisions and explicitly requested committing and pushing the finished changes. No additional requirements or commit confirmation is needed.
