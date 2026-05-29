# Ant Design to Liquid Glass Migration Guide

## Completed Core Infrastructure

### ✅ Core Files Updated
- `src/app/layout.tsx` - Removed AntdRegistry
- `src/components/ThemeProvider.tsx` - Removed antd ConfigProvider, added ToastProvider
- `src/config/menus.tsx` - Replaced @ant-design/icons with lucide-react
- `src/app/[locale]/(tools)/components/ToolsLayoutClient.tsx` - Complete Liquid Glass redesign
- `src/components/ToolLayout.tsx` - Replaced antd Card/Button with custom components
- `src/components/IconFont.tsx` - DELETED (createFromIconfontCN)
- `src/theme/themeConfig.ts` - DELETED (antd theme config)
- `src/features/social/components/RetiresClient.tsx` - Full Liquid Glass redesign
- `src/hooks/useCopy.ts` - Replaced App.useApp() with useToast()
- `src/hooks/useHistory.ts` - Replaced App.useApp() with useToast()
- `src/components/HistoryList.tsx` - Replaced antd List/Card with custom components
- `src/components/EllipsisMiddle.tsx` - Replaced Typography.Paragraph with custom component

### ✅ UI Components Created
- `src/lib/utils.ts` - cn() utility
- `src/components/ui/button.tsx` - Liquid Glass button with variants
- `src/components/ui/input.tsx` - Glass input component
- `src/components/ui/textarea.tsx` - Glass textarea component
- `src/components/ui/card.tsx` - Glass card components
- `src/components/ui/label.tsx` - Form label component
- `src/components/ui/radio-group.tsx` - Radix UI radio group
- `src/components/ui/select.tsx` - Native select with glass styling
- `src/components/ui/calendar.tsx` - react-day-picker calendar
- `src/components/ui/date-picker.tsx` - DatePicker with calendar
- `src/components/ui/progress.tsx` - Progress bar with gradient support
- `src/components/ui/toast.tsx` - Toast notification system (replaces antd message)

### ✅ Package.json Updates
Removed:
- antd
- @ant-design/icons
- @ant-design/nextjs-registry

Added:
- lucide-react (icons)
- react-day-picker (date picker)
- cmdk (command palette - future)
- @radix-ui/react-radio-group
- @radix-ui/react-slot
- class-variance-authority
- clsx
- tailwind-merge

---

## Remaining Files to Migrate (50+ files)

### Component Mapping Reference

#### Ant Design → Liquid Glass Replacements

**Layout Components:**
- `Layout` → Custom flex/grid with glass-panel classes
- `Layout.Header` → `<header className="glass-panel">`
- `Layout.Content` → `<main className="flex-1">`
- `Layout.Sider` → `<aside className="glass-panel-strong">`

**Form Components:**
- `Form` → Native `<form>` with custom styling
- `Form.Item` → `<div className="space-y-2">` + `<Label>`
- `Input` → `@/components/ui/input`
- `Input.TextArea` → `@/components/ui/textarea`
- `InputNumber` → `<Input type="number">`
- `Select` → `@/components/ui/select` or native `<select>`
- `Radio.Group` → `@/components/ui/radio-group`
- `DatePicker` → `@/components/ui/date-picker`

**Display Components:**
- `Card` → `@/components/ui/card`
- `Typography.Text` → `<span>` or `<p>` with text classes
- `Typography.Title` → `<h1>` to `<h6>` with font classes
- `Typography.Paragraph` → `<p>` with text classes
- `Descriptions` → Custom `<dl>` with glass styling
- `Statistic` → Custom component with glass-panel
- `Table` → Custom `<table>` with glass styling

**Feedback Components:**
- `message.success()` → `toast.success()`
- `message.error()` → `toast.error()`
- `message.info()` → `toast.info()`
- `message.warning()` → `toast.warning()`
- `Spin` → Custom loading spinner
- `Progress` → `@/components/ui/progress`

**Data Entry:**
- `Button` → `@/components/ui/button`
- `Upload` → Custom file upload with glass styling
- `ColorPicker` → Native `<input type="color">` with glass wrapper
- `Slider` → Native `<input type="range">` with glass styling

**Navigation:**
- `Menu` → Custom nav with glass styling (already done in ToolsLayoutClient)
- `Breadcrumb` → Custom breadcrumb (already done in ToolsLayoutClient)
- `Dropdown` → Custom dropdown or Radix UI
- `Drawer` → Custom drawer with framer-motion (already done in ToolsLayoutClient)

**Other:**
- `Flex` → Native flexbox with Tailwind classes
- `Grid` → Native CSS Grid or Tailwind grid
- `Row/Col` → Tailwind grid system
- `Popconfirm` → Custom confirm dialog
- `List` → Custom list with glass styling

#### Icon Replacements (@ant-design/icons → lucide-react)

Already mapped in menus.tsx:
- `UserOutlined` → `User`
- `FundOutlined` → `Hash`
- `RollbackOutlined` → `Shield`
- `VideoCameraOutlined` → `Video`
- `BarcodeOutlined` → `Barcode`
- `FileTextOutlined` → `FileText`
- `BgColorsOutlined` → `Palette`

Common icons to replace:
- `CopyOutlined` → `Copy`
- `ClearOutlined` → `Trash2` or `X`
- `ReloadOutlined` → `RotateCcw`
- `DeleteOutlined` → `Trash2`
- `UploadOutlined` → `Upload`
- `DownloadOutlined` → `Download`
- `InboxOutlined` → `Inbox`
- `SwapOutlined` → `ArrowLeftRight`
- `SafetyOutlined` → `Shield`
- `FormatPainterOutlined` → `Paintbrush`
- `CompressOutlined` → `Minimize2`
- `PlusOutlined` → `Plus`
- `PlayCircleOutlined` → `Play`
- `PauseCircleOutlined` → `Pause`
- `GithubOutlined` → `Github`
- `MenuOutlined` → `Menu`
- `MoonOutlined` → `Moon`
- `SunOutlined` → `Sun`
- `LaptopOutlined` → `Laptop`

---

## Migration Strategy for Remaining Files

### Phase 1: Create Missing UI Components (if needed)
- Slider component
- ColorPicker wrapper
- Upload component
- Table component
- Descriptions component
- Statistic component

### Phase 2: Systematic File Updates
For each file in the 50+ remaining files:

1. **Replace imports:**
   ```typescript
   // OLD
   import { Button, Card, Input } from 'antd'
   import { CopyOutlined } from '@ant-design/icons'
   
   // NEW
   import { Button } from '@/components/ui/button'
   import { Card } from '@/components/ui/card'
   import { Input } from '@/components/ui/input'
   import { Copy } from 'lucide-react'
   ```

2. **Replace components:**
   ```typescript
   // OLD
   <Button type="primary" icon={<CopyOutlined />} onClick={handleCopy}>
     Copy
   </Button>
   
   // NEW
   <Button variant="primary" icon={<Copy className="w-4 h-4" />} onClick={handleCopy}>
     Copy
   </Button>
   ```

3. **Replace Form patterns:**
   ```typescript
   // OLD
   <Form.Item label="Name" name="name">
     <Input />
   </Form.Item>
   
   // NEW
   <div className="space-y-2">
     <Label htmlFor="name">Name</Label>
     <Input id="name" name="name" />
   </div>
   ```

4. **Replace message API:**
   ```typescript
   // OLD
   const { message } = App.useApp()
   message.success('Success!')
   
   // NEW
   const toast = useToast()
   toast.success('Success!')
   ```

### Phase 3: Testing
- Run `pnpm lint` and fix all errors
- Run `pnpm typecheck` and fix all type errors
- Test each tool page in browser
- Verify light/dark theme switching
- Verify responsive design (mobile/desktop)

---

## Files Requiring Migration (Grouped by Feature)

### Social Features (3 files)
- ✅ `src/features/social/components/RetiresClient.tsx` - DONE
- `src/features/social/components/TimeClient.tsx`
- `src/features/social/components/KeyCodeClient.tsx`

### Hash Features (7 files)
- `src/features/hash/components/MD5Form.tsx`
- `src/features/hash/components/SHAForm.tsx`
- `src/features/hash/components/HMACMD5Client.tsx`
- `src/features/hash/components/HMACSHAClient.tsx`
- `src/features/hash/components/RIPEMDClient.tsx`
- `src/features/hash/components/HMACRIPEMDClient.tsx`
- `src/features/hash/components/PBKDFClient.tsx`

### Encryption Features (6 files)
- `src/features/encryption/components/AESClient.tsx`
- `src/features/encryption/components/DESClient.tsx`
- `src/features/encryption/components/TripleDESClient.tsx`
- `src/features/encryption/components/Base64Client.tsx`
- `src/features/encryption/components/URLEncodeClient.tsx`
- `src/features/encryption/components/JwtClient.tsx`

### Format Features (9 files)
- `src/features/format/components/JsonClient.tsx`
- `src/features/format/components/DiffClient.tsx`
- `src/features/format/components/RegexClient.tsx`
- `src/features/format/components/SqlClient.tsx`
- `src/features/format/components/UrlClient.tsx`
- `src/features/format/components/CaseClient.tsx`
- `src/features/format/components/TextStatClient.tsx`
- `src/features/format/components/XmlClient.tsx`
- `src/features/format/components/UaClient.tsx`

### Converter Features (6 files)
- `src/features/converter/components/ColorClient.tsx`
- `src/features/converter/components/ImageBase64Client.tsx`
- `src/features/converter/components/TimestampClient.tsx`
- `src/features/converter/components/BaseClient.tsx`
- `src/features/converter/components/HtmlClient.tsx`
- `src/features/converter/components/UnitClient.tsx`

### Generation Features (7 files)
- `src/features/generation/components/UuidClient.tsx`
- `src/features/generation/components/QrcodeClient.tsx`
- `src/features/generation/components/PasswordClient.tsx`
- `src/features/generation/components/CronClient.tsx`
- `src/features/generation/components/ShadowClient.tsx`
- `src/features/generation/components/LoremClient.tsx`
- `src/features/generation/components/GradientClient.tsx`

### Preview Features (5 files)
- `src/features/preview/components/DocxPreviewer.tsx`
- `src/features/preview/components/ExcelPreviewer.tsx`
- `src/features/preview/components/PdfPreviewer.tsx`
- `src/features/preview/components/PptxPreviewer.tsx`
- `src/features/preview/components/MarkdownClient.tsx`
- `src/features/preview/components/FileUploader.tsx`

---

## Quick Reference: Common Patterns

### Pattern 1: Simple Button
```typescript
// OLD
<Button type="primary" onClick={handleClick}>Submit</Button>

// NEW
<Button variant="primary" onClick={handleClick}>Submit</Button>
```

### Pattern 2: Icon Button
```typescript
// OLD
<Button icon={<CopyOutlined />} onClick={handleCopy} />

// NEW
<Button icon={<Copy className="w-4 h-4" />} onClick={handleCopy} />
```

### Pattern 3: Card with Title
```typescript
// OLD
<Card title="My Card">Content</Card>

// NEW
<Card>
  <CardHeader>
    <CardTitle>My Card</CardTitle>
  </CardHeader>
  <CardContent>Content</CardContent>
</Card>
```

### Pattern 4: Form Layout
```typescript
// OLD
<Form layout="vertical">
  <Form.Item label="Name" name="name">
    <Input />
  </Form.Item>
</Form>

// NEW
<form className="space-y-4">
  <div className="space-y-2">
    <Label htmlFor="name">Name</Label>
    <Input id="name" name="name" />
  </div>
</form>
```

### Pattern 5: Flex Layout
```typescript
// OLD
<Flex gap={8} align="center" justify="space-between">
  <div>Left</div>
  <div>Right</div>
</Flex>

// NEW
<div className="flex items-center justify-between gap-2">
  <div>Left</div>
  <div>Right</div>
</div>
```

### Pattern 6: Grid Layout
```typescript
// OLD
<Row gutter={16}>
  <Col span={12}>Left</Col>
  <Col span={12}>Right</Col>
</Row>

// NEW
<div className="grid grid-cols-2 gap-4">
  <div>Left</div>
  <div>Right</div>
</div>
```

---

## Next Steps

1. **Install dependencies** (when network is available):
   ```bash
   pnpm install
   ```

2. **Create additional UI components as needed** (Slider, ColorPicker, Upload, Table, etc.)

3. **Migrate remaining 50+ files systematically** using the patterns above

4. **Run verification**:
   ```bash
   pnpm lint
   pnpm typecheck
   pnpm dev
   ```

5. **Test all tool pages** in browser (light/dark themes, mobile/desktop)

---

## Design System Reference

### CSS Variables (from globals.css)
- Colors: `var(--primary)`, `var(--success)`, `var(--error)`, `var(--warning)`
- Text: `var(--text-primary)`, `var(--text-secondary)`, `var(--text-tertiary)`
- Backgrounds: `var(--bg-base)`, `var(--bg-subtle)`, `var(--bg-muted)`
- Glass: `var(--glass-bg)`, `var(--glass-border)`, `var(--glass-specular)`

### Utility Classes
- `.glass-panel` - Standard glass panel
- `.glass-panel-strong` - Stronger glass effect
- `.glass-input` - Recessed glass for inputs
- `.glass-specular` - Specular highlight effect

### Tailwind Utilities
- Spacing: `gap-2`, `p-4`, `m-6`, `space-y-4`
- Layout: `flex`, `grid`, `items-center`, `justify-between`
- Text: `text-sm`, `font-medium`, `text-[var(--text-primary)]`
- Rounded: `rounded-lg`, `rounded-xl`, `rounded-[var(--radius-pill)]`
