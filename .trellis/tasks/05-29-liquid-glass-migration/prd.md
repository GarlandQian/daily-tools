# Liquid Glass Migration (Remaining 27 Files)

## Goal

Complete the migration from Ant Design to the Liquid Glass design system. The first batch (16 files) was done in commit bc2091b. This task covers the remaining 27 feature files that still import from `antd` or `@/lib/antd-compat`.

## Requirements

- Replace all `antd` and `@ant-design/icons` imports with Liquid Glass UI components (`@/components/ui/*`) and `lucide-react` icons
- Use Tailwind CSS for layout (flex, grid, gap, responsive) instead of antd's `Row`/`Col`/`Flex`
- Replace `antd` `message` API with toast from `@/components/ui/toast`
- Maintain identical functionality — no feature changes
- Follow patterns established in the first 16 migrated files

## Files to Migrate

### converter (4)
- HtmlClient.tsx
- ImageBase64Client.tsx
- TimestampClient.tsx
- UnitClient.tsx

### encryption (4)
- DESClient.tsx
- JwtClient.tsx
- TripleDESClient.tsx
- URLEncodeClient.tsx

### format (6)
- CaseClient.tsx
- SqlClient.tsx
- TextStatClient.tsx
- UaClient.tsx
- UrlClient.tsx
- XmlClient.tsx

### generation (2)
- GradientClient.tsx
- ShadowClient.tsx

### hash (7)
- HMACMD5Client.tsx
- HMACRIPEMDClient.tsx
- HMACSHAClient.tsx
- MD5Form.tsx
- PBKDFClient.tsx
- RIPEMDClient.tsx
- SHAForm.tsx

### preview (2)
- MarkdownClient.tsx
- PptxPreviewer.tsx

### social (2)
- KeyCodeClient.tsx
- TimeClient.tsx

## Acceptance Criteria

- [ ] Zero imports from `antd` or `@ant-design/icons` in `src/`
- [ ] TypeScript compiles without errors
- [ ] All components render with glass styling

## Out of Scope

- New features or UX changes
- Removing antd from package.json (separate cleanup task)
- Writing tests
