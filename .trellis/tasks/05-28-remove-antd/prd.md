# Remove Ant Design + Unify Mesh Gradient to R3F

## Goal

1. **Remove Ant Design completely** — migrate all antd components to custom Liquid Glass components using Radix UI + Tailwind
2. **Unify mesh gradient to R3F** — delete WebGPU native Three.js implementation, route WebGPU detection to R3F WebGL path for code elegance

## What I already know

### Current Ant Design usage
- `antd` components: Button, Form, DatePicker, Progress, Radio, Drawer, Menu, Breadcrumb, Layout, Grid, Dropdown, Flex, Typography
- `@ant-design/icons`: CopyOutlined, GithubOutlined, MenuOutlined, MoonOutlined, SunOutlined, BarcodeOutlined, etc.
- `@ant-design/nextjs-registry`: AntdRegistry wrapper
- Files using antd:
  - `src/app/layout.tsx` — AntdRegistry
  - `src/app/[locale]/(tools)/components/ToolsLayoutClient.tsx` — Layout, Menu, Drawer, Breadcrumb, Dropdown
  - `src/components/ThemeProvider.tsx` — ConfigProvider, App, theme
  - `src/components/IconFont.tsx` — createFromIconfontCN
  - `src/config/menus.tsx` — icon imports
  - `src/features/social/components/RetiresClient.tsx` — Button, DatePicker, Form, Progress, Radio, Typography

### Current mesh gradient implementation
- `src/components/effects/MeshGradient.tsx` — dispatcher with WebGPU/WebGL/CSS detection
- `src/components/effects/MeshGradientWebGPU.tsx` — native Three.js + TSL (217 lines)
- `src/components/effects/MeshGradientWebGL.tsx` — React Three Fiber + GLSL (217 lines)
- `src/components/effects/MeshGradientCSS.tsx` — CSS fallback (53 lines)

### Existing Radix UI components
- Already have: Button, Label, Textarea, Switch, Select, Dialog, DropdownMenu, Input
- Located in: `src/components/ui/`
- Styled with: Tailwind + CSS variables (Liquid Glass tokens)

## Requirements

### Part 1: Remove Ant Design

**Must Have**:
- [ ] Delete all antd dependencies from package.json
- [ ] Replace Layout/Menu/Drawer with custom Liquid Glass navigation
- [ ] Replace Form/Input components with Radix UI equivalents
- [ ] Replace DatePicker with Radix UI date picker or headless alternative
- [ ] Replace Progress/Radio/Typography with custom components
- [ ] Replace all @ant-design/icons with lucide-react
- [ ] Remove AntdRegistry from layout
- [ ] Update ThemeProvider to not depend on antd theme
- [ ] Remove IconFont component (createFromIconfontCN)

**Should Have**:
- [ ] Maintain visual consistency with Liquid Glass design
- [ ] Preserve all existing functionality
- [ ] Keep i18n support intact

### Part 2: Unify Mesh Gradient to R3F

**Must Have**:
- [ ] Delete `MeshGradientWebGPU.tsx`
- [ ] Update `MeshGradient.tsx` dispatcher:
  - WebGPU detection → route to `MeshGradientWebGL` (R3F)
  - WebGL detection → route to `MeshGradientWebGL` (R3F)
  - Fallback → route to `MeshGradientCSS`
- [ ] Update detection logic to return 'webgl' for both WebGPU and WebGL
- [ ] Add comment explaining R3F doesn't support WebGPU yet

## Acceptance Criteria

- [ ] No antd imports anywhere in codebase
- [ ] All pages render correctly with Liquid Glass styling
- [ ] All interactive features work (forms, navigation, theme switching)
- [ ] Only one GPU implementation exists (R3F WebGL)
- [ ] Mesh gradient works on WebGPU browsers (via R3F WebGL fallback)
- [ ] `pnpm lint` passes
- [ ] `pnpm typecheck` passes
- [ ] Dev server runs without errors

## Definition of Done

- Lint / typecheck / CI green
- Browser verification for all tool pages
- Both light and dark themes verified
- All antd dependencies removed from package.json

## Out of Scope

- Adding new features beyond antd replacement
- Redesigning existing tool UIs (keep current layouts)
- Performance optimization beyond current state
- Mobile-specific optimizations

## Technical Notes

### Files to modify (Part 1: Ant Design removal)
- `package.json` — remove antd, @ant-design/icons, @ant-design/nextjs-registry
- `src/app/layout.tsx` — remove AntdRegistry
- `src/app/[locale]/(tools)/components/ToolsLayoutClient.tsx` — rebuild with Radix UI
- `src/components/ThemeProvider.tsx` — remove antd ConfigProvider
- `src/components/IconFont.tsx` — delete file
- `src/config/menus.tsx` — replace @ant-design/icons with lucide-react
- `src/features/social/components/RetiresClient.tsx` — replace antd components

### Files to modify (Part 2: R3F unification)
- `src/components/effects/MeshGradient.tsx` — update dispatcher logic
- `src/components/effects/MeshGradientWebGPU.tsx` — delete file

### Constraints
- Must maintain Next.js 16 App Router architecture
- Must maintain TypeScript strict mode
- Must pass ESLint and TypeScript checks
- Must maintain i18n support (en/cn)
- Must preserve Liquid Glass design tokens

## Open Questions

1. **DatePicker replacement**: Which library should we use?
   - Option A: `react-day-picker` (headless, 14KB, widely used)
   - Option B: `@radix-ui/react-calendar` (not released yet, wait for it)
   - Option C: Build custom with native `<input type="date">` + glass styling
   
2. **Icon strategy**: 
   - Option A: Replace all with `lucide-react` (consistent, tree-shakeable)
   - Option B: Mix lucide-react + custom SVG for special icons
   
3. **Layout approach**:
   - Option A: Keep current sidebar/topbar structure, just replace antd components
   - Option B: Redesign layout to be more "Liquid Glass native"


## Decisions

**DatePicker replacement**: `react-day-picker` (headless, 14KB, widely used, perfect for Liquid Glass styling)

**Icon strategy**: Replace all `@ant-design/icons` with `lucide-react` (consistent, tree-shakeable, 1000+ icons)

**Layout approach**: Redesign layout to be "Liquid Glass native" — floating glass panels, modern navigation patterns, full visual refresh


## Design Direction (Creative Freedom)

**Not just component replacement** — this is a full visual refresh with creative Liquid Glass interactions:

### Navigation Concepts to Explore
- Floating glass navigation bar with blur + specular highlights
- Command palette (⌘K) for quick tool access
- Animated category cards with hover depth effects
- Pill-shaped tool switcher with smooth transitions
- Glassmorphic sidebar that slides in/out with spring physics

### Interaction Patterns
- Smooth page transitions with fade + scale
- Hover states with subtle lift + glow
- Focus states with animated glass borders
- Loading states with shimmer effects on glass surfaces
- Micro-interactions: button press depth, icon morphs, ripple effects

### Layout Ideas
- Centered content with floating glass panels
- Tool cards with depth layers (shadow + specular)
- Breadcrumb as floating pills instead of text links
- Theme toggle as animated sun/moon with glass orb
- Mobile: bottom sheet navigation with spring animations

**Key Principle**: Every interaction should feel premium, fluid, and distinctly "Liquid Glass" — not just antd with different styling.

