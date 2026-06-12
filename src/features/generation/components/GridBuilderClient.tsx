'use client'

import {
  AlertTriangle,
  Braces,
  ClipboardCheck,
  Code2,
  Copy,
  Download,
  FileCode2,
  FileSearch,
  Grid3X3,
  LayoutTemplate,
  RotateCcw,
  ShieldCheck,
  Sparkles
} from 'lucide-react'
import { useCallback, useDeferredValue, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Slider } from '@/components/ui/slider'
import { Textarea } from '@/components/ui/textarea'
import { useCopy } from '@/hooks/useCopy'

type GridMode = 'fixed' | 'auto-fit' | 'auto-fill'
type AlignMode = 'stretch' | 'start' | 'center' | 'end'
type FlowMode = 'row' | 'column' | 'row-dense'
type AreaPreset = 'none' | 'dashboard' | 'app' | 'gallery'
type OutputTab = 'css' | 'tailwind' | 'html' | 'react' | 'json'
type GridFindingLevel = 'danger' | 'good' | 'warn'
type GridImportSource = 'css' | 'html' | 'tailwind'

interface GridState {
  align: AlignMode
  areaPreset: AreaPreset
  columns: number
  containerQuery: boolean
  flow: FlowMode
  gap: number
  itemCount: number
  justify: AlignMode
  maxWidth: number
  minTrack: number
  mode: GridMode
  rows: number
  squareItems: boolean
}

interface AreaDefinition {
  columns: number
  items: Array<{ area: string; labelKey: string }>
  rows: string[]
}

interface ParsedGridWorkspace {
  align: AlignMode | null
  areaIssues: string[]
  areaRows: string[]
  capped: boolean
  columns: number | null
  flow: FlowMode | null
  gap: number | null
  hasMinWidthZero: boolean
  itemCount: number | null
  justify: AlignMode | null
  maxWidth: number | null
  minTrack: number | null
  mode: GridMode | null
  rows: number | null
  scanLimited: boolean
  sources: GridImportSource[]
  templateColumns: string
}

interface GridFinding {
  key: string
  level: GridFindingLevel
  subject: string
}

const DEFAULT_GRID: GridState = {
  align: 'stretch',
  areaPreset: 'none',
  columns: 4,
  containerQuery: true,
  flow: 'row-dense',
  gap: 16,
  itemCount: 8,
  justify: 'stretch',
  maxWidth: 1120,
  minTrack: 220,
  mode: 'auto-fit',
  rows: 120,
  squareItems: false
}

const GRID_PRESETS: Array<{ key: string; state: GridState }> = [
  {
    key: 'cards',
    state: DEFAULT_GRID
  },
  {
    key: 'dashboard',
    state: {
      ...DEFAULT_GRID,
      areaPreset: 'dashboard',
      columns: 4,
      itemCount: 6,
      maxWidth: 1240,
      mode: 'fixed',
      rows: 132
    }
  },
  {
    key: 'gallery',
    state: {
      ...DEFAULT_GRID,
      areaPreset: 'gallery',
      gap: 12,
      itemCount: 12,
      minTrack: 160,
      rows: 160,
      squareItems: true
    }
  },
  {
    key: 'app',
    state: {
      ...DEFAULT_GRID,
      areaPreset: 'app',
      columns: 4,
      gap: 18,
      itemCount: 5,
      maxWidth: 1180,
      mode: 'fixed',
      rows: 140
    }
  }
]

const AREA_DEFINITIONS: Record<Exclude<AreaPreset, 'none'>, AreaDefinition> = {
  app: {
    columns: 4,
    rows: [
      '"header header header header"',
      '"sidebar main main aside"',
      '"footer footer footer footer"'
    ],
    items: [
      { area: 'header', labelKey: 'app.generation.grid.area.header' },
      { area: 'sidebar', labelKey: 'app.generation.grid.area.sidebar' },
      { area: 'main', labelKey: 'app.generation.grid.area.main' },
      { area: 'aside', labelKey: 'app.generation.grid.area.aside' },
      { area: 'footer', labelKey: 'app.generation.grid.area.footer' }
    ]
  },
  dashboard: {
    columns: 4,
    rows: ['"hero hero stats stats"', '"chart chart chart aside"', '"table table table aside"'],
    items: [
      { area: 'hero', labelKey: 'app.generation.grid.area.hero' },
      { area: 'stats', labelKey: 'app.generation.grid.area.stats' },
      { area: 'chart', labelKey: 'app.generation.grid.area.chart' },
      { area: 'aside', labelKey: 'app.generation.grid.area.aside' },
      { area: 'table', labelKey: 'app.generation.grid.area.table' }
    ]
  },
  gallery: {
    columns: 5,
    rows: ['"feature feature a b c"', '"feature feature d e f"'],
    items: [
      { area: 'feature', labelKey: 'app.generation.grid.area.feature' },
      { area: 'a', labelKey: 'app.generation.grid.area.item_a' },
      { area: 'b', labelKey: 'app.generation.grid.area.item_b' },
      { area: 'c', labelKey: 'app.generation.grid.area.item_c' },
      { area: 'd', labelKey: 'app.generation.grid.area.item_d' },
      { area: 'e', labelKey: 'app.generation.grid.area.item_e' },
      { area: 'f', labelKey: 'app.generation.grid.area.item_f' }
    ]
  }
}

const OUTPUT_TABS: OutputTab[] = ['css', 'tailwind', 'html', 'react', 'json']
const PREVIEW_ITEM_LIMIT = 36
const GRID_AREA_RENDER_LIMIT = 24
const GRID_FINDING_RENDER_LIMIT = 48
const GRID_AREA_SCAN_LIMIT = 120
const GRID_AREA_CELL_SCAN_LIMIT = 48
const GRID_ITEM_SCAN_LIMIT = 240
const MAX_GRID_WORKSPACE_CHARS = 60000
const GRID_WORKSPACE_SAMPLE = `.grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(220px, 100%), 1fr));
  grid-auto-rows: minmax(120px, auto);
  grid-auto-flow: row dense;
  gap: 16px;
  max-width: 1120px;
}

.grid > * {
  min-width: 0;
}

<section class="grid grid-cols-[repeat(auto-fit,minmax(min(220px,100%),1fr))] gap-[16px]">
  <article class="grid__item">A</article>
  <article class="grid__item">B</article>
</section>`
const numberFormatter = new Intl.NumberFormat()

const clampNumber = (value: number, min: number, max: number) => {
  if (!Number.isFinite(value)) return min
  return Math.min(max, Math.max(min, value))
}

const getAreaDefinition = (areaPreset: AreaPreset) =>
  areaPreset === 'none' ? null : AREA_DEFINITIONS[areaPreset]

const getTemplate = (state: GridState, areaDefinition: AreaDefinition | null) => {
  if (areaDefinition) return `repeat(${areaDefinition.columns}, minmax(0, 1fr))`
  if (state.mode === 'fixed') return `repeat(${state.columns}, minmax(0, 1fr))`
  return `repeat(${state.mode}, minmax(min(${state.minTrack}px, 100%), 1fr))`
}

const getFlowValue = (flow: FlowMode) => (flow === 'row-dense' ? 'row dense' : flow)

const pxToNumber = (value: string | undefined) => {
  if (!value) return null
  const match = value.match(/(-?\d+(?:\.\d+)?)px/u)
  if (!match?.[1]) return null
  return Math.round(Number(match[1]))
}

const normalizeAlign = (value: string | null): AlignMode | null => {
  if (value === 'stretch' || value === 'start' || value === 'center' || value === 'end')
    return value
  return null
}

const extractCssDeclaration = (source: string, property: string) => {
  const match = source.match(new RegExp(`${property}\\s*:\\s*([^;{}]+)`, 'iu'))
  return match?.[1]?.trim() ?? ''
}

const extractAreaRows = (value: string) => {
  const rows: string[] = []
  const pattern = /"([^"]+)"/gu
  let limited = false

  let match: RegExpExecArray | null
  while ((match = pattern.exec(value))) {
    if (rows.length >= GRID_AREA_SCAN_LIMIT) {
      limited = true
      break
    }
    const row = match[1]?.trim() ?? ''
    if (row) rows.push(row)
    if (match[0] === '') pattern.lastIndex += 1
  }

  return { limited, rows }
}

const countPattern = (source: string, pattern: RegExp, limit: number) => {
  let count = 0
  let limited = false
  pattern.lastIndex = 0

  let match: RegExpExecArray | null
  while ((match = pattern.exec(source))) {
    if (count >= limit) {
      limited = true
      break
    }
    count += 1
    if (match[0] === '') pattern.lastIndex += 1
  }

  return { count, limited }
}

const findLastPattern = (source: string, pattern: RegExp) => {
  let last = ''
  let count = 0
  let limited = false
  pattern.lastIndex = 0

  let match: RegExpExecArray | null
  while ((match = pattern.exec(source))) {
    if (count >= GRID_ITEM_SCAN_LIMIT) {
      limited = true
      break
    }
    last = match[0] ?? last
    count += 1
    if (match[0] === '') pattern.lastIndex += 1
  }

  return { last, limited }
}

const collectAreaCells = (row: string) => {
  const cells: string[] = []
  let limited = false
  let tokenStart = -1

  for (let index = 0; index <= row.length; index += 1) {
    const char = row[index]
    const isDelimiter = index === row.length || /\s/u.test(char ?? '')

    if (!isDelimiter) {
      if (tokenStart < 0) tokenStart = index
      continue
    }

    if (tokenStart < 0) continue
    if (cells.length >= GRID_AREA_CELL_SCAN_LIMIT) {
      limited = true
      break
    }

    const cell = row.slice(tokenStart, index)
    if (cell) cells.push(cell)
    tokenStart = -1
  }

  return { cells, limited }
}

const analyzeAreaRows = (rows: string[]) => {
  const issues: string[] = []
  if (rows.length === 0) return { issues, limited: false }
  let limited = false
  const cells = rows.map(row => {
    const result = collectAreaCells(row)
    if (result.limited) limited = true
    return result.cells
  })
  const width = cells[0]?.length ?? 0
  if (cells.some(row => row.length !== width)) issues.push('uneven')

  const names = new Set<string>()
  cells.forEach(row => {
    row.forEach(name => {
      if (name !== '.') names.add(name)
    })
  })
  names.forEach(name => {
    const positions: Array<{ column: number; row: number }> = []
    cells.forEach((row, rowIndex) => {
      row.forEach((cell, columnIndex) => {
        if (cell === name) positions.push({ column: columnIndex, row: rowIndex })
      })
    })
    const minRow = Math.min(...positions.map(position => position.row))
    const maxRow = Math.max(...positions.map(position => position.row))
    const minColumn = Math.min(...positions.map(position => position.column))
    const maxColumn = Math.max(...positions.map(position => position.column))
    for (let row = minRow; row <= maxRow; row += 1) {
      for (let column = minColumn; column <= maxColumn; column += 1) {
        if (cells[row]?.[column] !== name) issues.push(`non_rect:${name}`)
      }
    }
  })

  return { issues: Array.from(new Set(issues)), limited }
}

const getTemplateColumnCount = (template: string) => {
  const repeatMatch = template.match(/repeat\(\s*(\d+)\s*,/iu)
  if (repeatMatch?.[1]) return Number(repeatMatch[1])
  if (!template || /auto-fit|auto-fill/iu.test(template)) return null
  return template.split(/\s+/u).filter(Boolean).length || null
}

const parseTemplateMode = (
  template: string
): Pick<ParsedGridWorkspace, 'columns' | 'minTrack' | 'mode'> => {
  const autoMatch = template.match(/repeat\(\s*(auto-fit|auto-fill)\s*,/iu)
  const fixedMatch = template.match(/repeat\(\s*(\d+)\s*,/iu)
  const minTrack = pxToNumber(template)
  if (autoMatch?.[1]) {
    return {
      columns: null,
      minTrack,
      mode: autoMatch[1].toLowerCase() as GridMode
    }
  }
  if (fixedMatch?.[1]) {
    return {
      columns: Number(fixedMatch[1]),
      minTrack: null,
      mode: 'fixed'
    }
  }

  return {
    columns: getTemplateColumnCount(template),
    minTrack: null,
    mode: template ? 'fixed' : null
  }
}

const tailwindGapToPx = (value: string) => {
  const arbitrary = value.match(/^gap-\[(\d+)px\]$/u)
  if (arbitrary?.[1]) return Number(arbitrary[1])
  const scale = value.match(/^gap-(\d+)$/u)
  if (scale?.[1]) return Number(scale[1]) * 4
  return null
}

const parseGridWorkspace = (input: string): ParsedGridWorkspace => {
  const source = input.slice(0, MAX_GRID_WORKSPACE_CHARS)
  const sources = new Set<GridImportSource>()
  const templateColumns = extractCssDeclaration(source, 'grid-template-columns')
  const areaDeclaration = extractCssDeclaration(source, 'grid-template-areas')
  const areaRowResult = extractAreaRows(areaDeclaration)
  const areaAnalysis = analyzeAreaRows(areaRowResult.rows)
  const tailwindColumns = source.match(/\bgrid-cols-(\d+)\b/u)?.[1]
  const tailwindAuto = source.match(
    /\bgrid-cols-\[repeat\((auto-fit|auto-fill),minmax\(min\((\d+)px,100%\),1fr\)\)\]/u
  )
  const tailwindGapResult = findLastPattern(source, /\bgap-(?:\[(?:\d+)px\]|\d+)\b/gu)
  const templateMode = parseTemplateMode(templateColumns)
  const classItemCount = countPattern(
    source,
    /class=["'][^"']*(?:grid__item|grid-item|card|tile)[^"']*["']/giu,
    GRID_ITEM_SCAN_LIMIT
  )
  const articleItemCount = countPattern(source, /<article\b/giu, GRID_ITEM_SCAN_LIMIT)
  const itemCount = Math.max(classItemCount.count, articleItemCount.count)

  if (templateColumns || areaDeclaration || extractCssDeclaration(source, 'display') === 'grid')
    sources.add('css')
  if (/<(?:section|div|article)\b/iu.test(source)) sources.add('html')
  if (/\bgrid\b|\bgrid-cols-/u.test(source)) sources.add('tailwind')

  const flowValue = extractCssDeclaration(source, 'grid-auto-flow')
  const flow: FlowMode | null = /dense/iu.test(flowValue)
    ? 'row-dense'
    : flowValue === 'column'
      ? 'column'
      : flowValue === 'row'
        ? 'row'
        : /\bgrid-flow-row-dense\b/u.test(source)
          ? 'row-dense'
          : /\bgrid-flow-col\b/u.test(source)
            ? 'column'
            : /\bgrid-flow-row\b/u.test(source)
              ? 'row'
              : null

  return {
    align: normalizeAlign(extractCssDeclaration(source, 'align-items')),
    areaIssues: areaAnalysis.issues,
    areaRows: areaRowResult.rows,
    capped: input.length > MAX_GRID_WORKSPACE_CHARS,
    columns: tailwindColumns ? Number(tailwindColumns) : tailwindAuto ? null : templateMode.columns,
    flow,
    gap:
      tailwindGapToPx(tailwindGapResult.last) ?? pxToNumber(extractCssDeclaration(source, 'gap')),
    hasMinWidthZero:
      /min-width\s*:\s*0\b/iu.test(source) ||
      source.includes('[&>*]:min-w-0') ||
      /\bmin-w-0\b/u.test(source),
    itemCount: itemCount > 0 ? clampNumber(itemCount, 1, PREVIEW_ITEM_LIMIT) : null,
    justify: normalizeAlign(extractCssDeclaration(source, 'justify-items')),
    maxWidth: pxToNumber(extractCssDeclaration(source, 'max-width')),
    minTrack: tailwindAuto?.[2] ? Number(tailwindAuto[2]) : templateMode.minTrack,
    mode: tailwindColumns
      ? 'fixed'
      : tailwindAuto?.[1]
        ? (tailwindAuto[1] as GridMode)
        : templateMode.mode,
    rows: pxToNumber(extractCssDeclaration(source, 'grid-auto-rows')),
    scanLimited:
      areaRowResult.limited ||
      areaAnalysis.limited ||
      tailwindGapResult.limited ||
      classItemCount.limited ||
      articleItemCount.limited,
    sources: Array.from(sources),
    templateColumns
  }
}

const buildGridFindings = (state: GridState, parsed: ParsedGridWorkspace) => {
  const findings: GridFinding[] = []
  const template = parsed.templateColumns || getTemplate(state, getAreaDefinition(state.areaPreset))
  const columns = parsed.columns ?? (state.mode === 'fixed' ? state.columns : null)
  const gap = parsed.gap ?? state.gap
  const maxWidth = parsed.maxWidth ?? state.maxWidth
  const flow = parsed.flow ?? state.flow
  const areaRows =
    parsed.areaRows.length > 0
      ? parsed.areaRows
      : (getAreaDefinition(state.areaPreset)?.rows.map(row => row.replaceAll('"', '')) ?? [])

  if (parsed.capped)
    findings.push({
      key: 'workspace_capped',
      level: 'warn',
      subject: String(MAX_GRID_WORKSPACE_CHARS)
    })
  if (parsed.scanLimited)
    findings.push({ key: 'scan_limited', level: 'warn', subject: String(GRID_ITEM_SCAN_LIMIT) })
  if (parsed.sources.length === 0)
    findings.push({ key: 'workspace_empty', level: 'warn', subject: 'grid' })
  if (flow === 'row-dense')
    findings.push({ key: 'dense_order', level: 'warn', subject: getFlowValue(flow) })
  if (!state.containerQuery)
    findings.push({ key: 'missing_container_query', level: 'warn', subject: 'container-query' })
  if (
    columns &&
    columns >= 6 &&
    maxWidth > 0 &&
    maxWidth < columns * 160 + Math.max(columns - 1, 0) * gap
  ) {
    findings.push({ key: 'fixed_overflow', level: 'warn', subject: `${columns} / ${maxWidth}px` })
  }
  if (/\b1fr\b/iu.test(template) && !/minmax\(/iu.test(template)) {
    findings.push({ key: 'missing_minmax_zero', level: 'warn', subject: template.slice(0, 96) })
  }
  if (parsed.sources.length > 0 && /\b1fr\b/iu.test(template) && !parsed.hasMinWidthZero) {
    findings.push({ key: 'missing_min_width', level: 'warn', subject: 'min-width: 0' })
  }
  if (areaRows.length > 0 && parsed.areaIssues.some(issue => issue === 'uneven')) {
    findings.push({
      key: 'uneven_areas',
      level: 'danger',
      subject: areaRows.join(' / ').slice(0, 96)
    })
  }
  parsed.areaIssues
    .filter(issue => issue.startsWith('non_rect:'))
    .forEach(issue =>
      findings.push({
        key: 'non_rectangular_area',
        level: 'danger',
        subject: issue.replace('non_rect:', '')
      })
    )
  if (gap === 0) findings.push({ key: 'zero_gap', level: 'warn', subject: '0px' })
  if (state.itemCount > PREVIEW_ITEM_LIMIT)
    findings.push({ key: 'preview_capped', level: 'warn', subject: String(PREVIEW_ITEM_LIMIT) })
  if (
    parsed.sources.length > 0 &&
    !findings.some(finding => finding.level === 'danger' || finding.level === 'warn')
  ) {
    findings.push({ key: 'ready', level: 'good', subject: parsed.sources.join(', ') })
  }
  if (parsed.sources.length === 0 && findings.length === 1) {
    findings.push({ key: 'ready', level: 'good', subject: 'builder' })
  }

  return findings
}

const csvCell = (value: string | number | null | undefined) => {
  const raw = String(value ?? '')
  const safe = /^[=+\-@\t\r]/u.test(raw) ? `'${raw}` : raw
  return `"${safe.replace(/"/gu, '""')}"`
}

const buildFindingsCsv = (findings: GridFinding[]) =>
  [
    ['level', 'key', 'subject'].map(csvCell).join(','),
    ...findings.map(finding => [finding.level, finding.key, finding.subject].map(csvCell).join(','))
  ].join('\n')

const downloadText = (content: string, filename: string, type: string) => {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.download = filename
  link.href = url
  link.click()
  URL.revokeObjectURL(url)
}

const buildGridCss = (state: GridState, areaDefinition: AreaDefinition | null) => {
  const template = getTemplate(state, areaDefinition)
  const areaCss = areaDefinition
    ? `\n  grid-template-areas:\n    ${areaDefinition.rows.join('\n    ')};`
    : ''
  const maxWidthCss =
    state.maxWidth > 0 ? `\n  max-width: ${state.maxWidth}px;\n  margin-inline: auto;` : ''
  const childCss = [state.squareItems ? '  aspect-ratio: 1;' : '', '  min-width: 0;'].filter(
    Boolean
  )
  const areaChildCss = areaDefinition
    ? `\n\n${areaDefinition.items
        .map(item => `.grid__${item.area} {\n  grid-area: ${item.area};\n}`)
        .join('\n\n')}`
    : ''
  const containerCss = state.containerQuery
    ? `\n\n.grid-shell {\n  container-type: inline-size;\n}\n\n@container (max-width: 640px) {\n  .grid {\n    grid-template-columns: 1fr;\n    grid-template-areas: none;\n  }\n\n  .grid > * {\n    grid-area: auto;\n  }\n}`
    : ''

  return `.grid {
  display: grid;
  grid-template-columns: ${template};${areaCss}
  grid-auto-rows: minmax(${state.rows}px, auto);
  grid-auto-flow: ${getFlowValue(state.flow)};
  gap: ${state.gap}px;
  align-items: ${state.align};
  justify-items: ${state.justify};${maxWidthCss}
}

.grid > * {
${childCss.join('\n')}
}${areaChildCss}${containerCss}`
}

const escapeAttribute = (value: string) =>
  value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')

const buildTailwind = (state: GridState, areaDefinition: AreaDefinition | null) => {
  const flowClass =
    state.flow === 'row-dense'
      ? 'grid-flow-row-dense'
      : state.flow === 'column'
        ? 'grid-flow-col'
        : 'grid-flow-row'
  const templateClass = areaDefinition
    ? `grid-cols-[repeat(${areaDefinition.columns},minmax(0,1fr))]`
    : state.mode === 'fixed'
      ? `grid-cols-${state.columns}`
      : `grid-cols-[repeat(${state.mode},minmax(min(${state.minTrack}px,100%),1fr))]`
  const areaClass = areaDefinition
    ? `[grid-template-areas:${areaDefinition.rows
        .map(row => `'${row.replaceAll('"', '').replaceAll(' ', '_')}'`)
        .join('_')}]`
    : ''

  return [
    'grid',
    templateClass,
    areaClass,
    `auto-rows-[minmax(${state.rows}px,auto)]`,
    flowClass,
    `gap-[${state.gap}px]`,
    `items-${state.align}`,
    `justify-items-${state.justify}`,
    state.maxWidth > 0 ? `max-w-[${state.maxWidth}px]` : '',
    state.maxWidth > 0 ? 'mx-auto' : '',
    state.squareItems ? '[&>*]:aspect-square' : ''
  ]
    .filter(Boolean)
    .join(' ')
}

const buildHtml = (state: GridState, areaDefinition: AreaDefinition | null) => {
  if (areaDefinition) {
    const items = areaDefinition.items
      .map(
        item =>
          `  <article class="grid__item grid__${item.area}" data-area="${escapeAttribute(
            item.area
          )}">${item.area}</article>`
      )
      .join('\n')
    return `<section class="grid-shell">
  <div class="grid">
${items}
  </div>
</section>`
  }

  const count = clampNumber(state.itemCount, 1, PREVIEW_ITEM_LIMIT)
  const items = Array.from(
    { length: count },
    (_, index) => `  <article class="grid__item">Item ${index + 1}</article>`
  ).join('\n')

  return `<section class="grid-shell">
  <div class="grid">
${items}
  </div>
</section>`
}

const buildReact = (state: GridState, areaDefinition: AreaDefinition | null) => {
  if (areaDefinition) {
    const items = areaDefinition.items
      .map(item => `  { area: '${item.area}', label: '${item.area}' }`)
      .join(',\n')

    return `const areas = [
${items}
]

export function ResponsiveGrid() {
  return (
    <section className="grid-shell">
      <div className="grid">
        {areas.map(item => (
          <article
            key={item.area}
            className={\`grid__item grid__\${item.area}\`}
            data-area={item.area}
          >
            {item.label}
          </article>
        ))}
      </div>
    </section>
  )
}`
  }

  const count = clampNumber(state.itemCount, 1, PREVIEW_ITEM_LIMIT)

  return `const items = Array.from({ length: ${count} }, (_, index) => index + 1)

export function ResponsiveGrid() {
  return (
    <section className="grid-shell">
      <div className="grid">
        {items.map(item => (
          <article key={item} className="grid__item">
            Item {item}
          </article>
        ))}
      </div>
    </section>
  )
}`
}

const buildJson = (state: GridState, areaDefinition: AreaDefinition | null) =>
  JSON.stringify(
    {
      alignItems: state.align,
      areaPreset: state.areaPreset,
      columns: areaDefinition?.columns ?? state.columns,
      containerQuery: state.containerQuery,
      gap: `${state.gap}px`,
      gridAutoFlow: getFlowValue(state.flow),
      gridAutoRows: `minmax(${state.rows}px, auto)`,
      gridTemplateAreas: areaDefinition?.rows ?? null,
      gridTemplateColumns: getTemplate(state, areaDefinition),
      justifyItems: state.justify,
      maxWidth: state.maxWidth > 0 ? `${state.maxWidth}px` : null,
      previewItems: areaDefinition?.items.map(item => item.area) ?? state.itemCount,
      squareItems: state.squareItems
    },
    null,
    2
  )

const GridBuilderClient = () => {
  const { t } = useTranslation()
  const { copy } = useCopy()
  const [grid, setGrid] = useState<GridState>(DEFAULT_GRID)
  const [outputTab, setOutputTab] = useState<OutputTab>('css')
  const [workspace, setWorkspace] = useState(GRID_WORKSPACE_SAMPLE)
  const deferredWorkspace = useDeferredValue(workspace)

  const areaDefinition = useMemo(() => getAreaDefinition(grid.areaPreset), [grid.areaPreset])
  const previewTemplate = useMemo(() => getTemplate(grid, areaDefinition), [areaDefinition, grid])
  const parsedWorkspace = useMemo(() => parseGridWorkspace(deferredWorkspace), [deferredWorkspace])
  const findings = useMemo(() => buildGridFindings(grid, parsedWorkspace), [grid, parsedWorkspace])
  const visibleAreaRows = useMemo(
    () => parsedWorkspace.areaRows.slice(0, GRID_AREA_RENDER_LIMIT),
    [parsedWorkspace.areaRows]
  )
  const areaRowsLimited = parsedWorkspace.areaRows.length > visibleAreaRows.length
  const visibleFindings = useMemo(() => findings.slice(0, GRID_FINDING_RENDER_LIMIT), [findings])
  const findingsLimited = findings.length > visibleFindings.length
  const findingsCsv = useMemo(() => buildFindingsCsv(findings), [findings])
  const css = useMemo(() => buildGridCss(grid, areaDefinition), [areaDefinition, grid])
  const tailwind = useMemo(() => buildTailwind(grid, areaDefinition), [areaDefinition, grid])
  const html = useMemo(() => buildHtml(grid, areaDefinition), [areaDefinition, grid])
  const react = useMemo(() => buildReact(grid, areaDefinition), [areaDefinition, grid])
  const json = useMemo(() => buildJson(grid, areaDefinition), [areaDefinition, grid])
  const allOutput = useMemo(
    () => `/* CSS */\n${css}\n\n/* Tailwind */\n${tailwind}\n\n<!-- HTML -->\n${html}`,
    [css, html, tailwind]
  )
  const workspaceJson = useMemo(
    () =>
      JSON.stringify(
        {
          audit: findings,
          builder: JSON.parse(json) as Record<string, unknown>,
          parsed: parsedWorkspace
        },
        null,
        2
      ),
    [findings, json, parsedWorkspace]
  )
  const currentOutput = {
    css,
    html,
    json,
    react,
    tailwind
  }[outputTab]
  const previewItems = useMemo(() => {
    if (areaDefinition) return areaDefinition.items
    const count = clampNumber(grid.itemCount, 1, PREVIEW_ITEM_LIMIT)
    return Array.from({ length: count }, (_, index) => ({
      area: String(index + 1),
      labelKey: ''
    }))
  }, [areaDefinition, grid.itemCount])
  const trackCount = areaDefinition?.columns ?? (grid.mode === 'fixed' ? grid.columns : 'auto')
  const areaCount = areaDefinition?.items.length ?? 0

  const updateGrid = (patch: Partial<GridState>) => {
    setGrid(prev => ({ ...prev, ...patch }))
  }

  const updateWorkspace = useCallback((value: string) => {
    setWorkspace(
      value.length > MAX_GRID_WORKSPACE_CHARS ? value.slice(0, MAX_GRID_WORKSPACE_CHARS) : value
    )
  }, [])

  const applyPreset = (key: string) => {
    const preset = GRID_PRESETS.find(item => item.key === key)
    if (preset) setGrid(preset.state)
  }

  const reset = () => {
    setGrid(DEFAULT_GRID)
    setOutputTab('css')
    updateWorkspace(GRID_WORKSPACE_SAMPLE)
  }

  const applyParsedWorkspace = useCallback(() => {
    const patch: Partial<GridState> = {
      areaPreset: 'none'
    }
    if (parsedWorkspace.mode) patch.mode = parsedWorkspace.mode
    if (parsedWorkspace.columns) patch.columns = clampNumber(parsedWorkspace.columns, 1, 12)
    if (parsedWorkspace.minTrack) patch.minTrack = clampNumber(parsedWorkspace.minTrack, 120, 420)
    if (parsedWorkspace.rows) patch.rows = clampNumber(parsedWorkspace.rows, 48, 260)
    if (parsedWorkspace.gap !== null) patch.gap = clampNumber(parsedWorkspace.gap, 0, 56)
    if (parsedWorkspace.maxWidth) patch.maxWidth = clampNumber(parsedWorkspace.maxWidth, 0, 1600)
    if (parsedWorkspace.flow) patch.flow = parsedWorkspace.flow
    if (parsedWorkspace.align) patch.align = parsedWorkspace.align
    if (parsedWorkspace.justify) patch.justify = parsedWorkspace.justify
    if (parsedWorkspace.itemCount)
      patch.itemCount = clampNumber(parsedWorkspace.itemCount, 1, PREVIEW_ITEM_LIMIT)
    setGrid(prev => ({ ...prev, ...patch }))
  }, [parsedWorkspace])

  return (
    <div className="flex size-full flex-col gap-5">
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-2">
              <CardTitle className="flex items-center gap-2">
                <Grid3X3 className="h-5 w-5 text-[var(--primary)]" />
                {t('app.generation.grid')}
              </CardTitle>
              <CardDescription>{t('app.generation.grid.description')}</CardDescription>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button size="sm" icon={<Copy className="h-4 w-4" />} onClick={() => copy(allOutput)}>
                {t('app.generation.grid.copy_all')}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                icon={<RotateCcw className="h-4 w-4" />}
                onClick={reset}
              >
                {t('public.reset')}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex flex-wrap gap-2">
            {GRID_PRESETS.map(preset => (
              <Button
                key={preset.key}
                type="button"
                size="sm"
                variant="default"
                icon={<Sparkles className="h-3.5 w-3.5" />}
                onClick={() => applyPreset(preset.key)}
              >
                {t(`app.generation.grid.preset.${preset.key}`)}
              </Button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Metric label={t('app.generation.grid.metric.tracks')} value={String(trackCount)} />
            <Metric
              label={t('app.generation.grid.metric.items')}
              value={numberFormatter.format(previewItems.length)}
            />
            <Metric label={t('app.generation.grid.metric.areas')} value={String(areaCount)} />
            <Metric
              label={t('app.generation.grid.metric.max_width')}
              value={`${grid.maxWidth}px`}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
            <div className="space-y-3">
              <Label htmlFor="grid-mode">{t('app.generation.grid.mode')}</Label>
              <Select
                id="grid-mode"
                value={grid.mode}
                onChange={event =>
                  updateGrid({ areaPreset: 'none', mode: event.target.value as GridMode })
                }
              >
                {(['auto-fit', 'auto-fill', 'fixed'] as const).map(value => (
                  <option key={value} value={value}>
                    {t(`app.generation.grid.mode.${value}`)}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-3">
              <Label htmlFor="grid-area">{t('app.generation.grid.area_preset')}</Label>
              <Select
                id="grid-area"
                value={grid.areaPreset}
                onChange={event => {
                  const areaPreset = event.target.value as AreaPreset
                  const definition = getAreaDefinition(areaPreset)
                  updateGrid({
                    areaPreset,
                    columns: definition?.columns ?? grid.columns,
                    itemCount: definition?.items.length ?? grid.itemCount,
                    mode: definition ? 'fixed' : grid.mode
                  })
                }}
              >
                {(['none', 'dashboard', 'app', 'gallery'] as const).map(value => (
                  <option key={value} value={value}>
                    {t(`app.generation.grid.area.${value}`)}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-3">
              <Label htmlFor="grid-align">{t('app.generation.grid.align')}</Label>
              <Select
                id="grid-align"
                value={grid.align}
                onChange={event => updateGrid({ align: event.target.value as AlignMode })}
              >
                {(['stretch', 'start', 'center', 'end'] as const).map(value => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-3">
              <Label htmlFor="grid-justify">{t('app.generation.grid.justify')}</Label>
              <Select
                id="grid-justify"
                value={grid.justify}
                onChange={event => updateGrid({ justify: event.target.value as AlignMode })}
              >
                {(['stretch', 'start', 'center', 'end'] as const).map(value => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            <GridSlider
              label={t('app.generation.grid.columns')}
              value={grid.columns}
              min={1}
              max={12}
              disabled={Boolean(areaDefinition)}
              onChange={value => updateGrid({ columns: value })}
            />
            <GridSlider
              label={t('app.generation.grid.min_track')}
              value={grid.minTrack}
              min={120}
              max={420}
              disabled={Boolean(areaDefinition) || grid.mode === 'fixed'}
              onChange={value => updateGrid({ minTrack: value })}
              suffix="px"
            />
            <GridSlider
              label={t('app.generation.grid.rows')}
              value={grid.rows}
              min={48}
              max={260}
              onChange={value => updateGrid({ rows: value })}
              suffix="px"
            />
            <GridSlider
              label={t('app.generation.grid.gap')}
              value={grid.gap}
              min={0}
              max={56}
              onChange={value => updateGrid({ gap: value })}
              suffix="px"
            />
            <GridSlider
              label={t('app.generation.grid.max_width')}
              value={grid.maxWidth}
              min={0}
              max={1600}
              step={20}
              onChange={value => updateGrid({ maxWidth: value })}
              suffix="px"
            />
            <div className="space-y-3">
              <Label htmlFor="grid-items">{t('app.generation.grid.items')}</Label>
              <Input
                id="grid-items"
                type="number"
                min={1}
                max={PREVIEW_ITEM_LIMIT}
                disabled={Boolean(areaDefinition)}
                value={grid.itemCount}
                onChange={event =>
                  updateGrid({
                    itemCount: clampNumber(Number(event.target.value), 1, PREVIEW_ITEM_LIMIT)
                  })
                }
                className="font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="space-y-3">
              <Label htmlFor="grid-flow">{t('app.generation.grid.flow')}</Label>
              <Select
                id="grid-flow"
                value={grid.flow}
                onChange={event => updateGrid({ flow: event.target.value as FlowMode })}
              >
                {(['row', 'column', 'row-dense'] as const).map(value => (
                  <option key={value} value={value}>
                    {t(`app.generation.grid.flow.${value}`)}
                  </option>
                ))}
              </Select>
            </div>
            <div className="glass-input rounded-xl p-3">
              <Checkbox
                checked={grid.squareItems}
                onChange={event => updateGrid({ squareItems: event.target.checked })}
                label={t('app.generation.grid.square')}
              />
            </div>
            <div className="glass-input rounded-xl p-3">
              <Checkbox
                checked={grid.containerQuery}
                onChange={event => updateGrid({ containerQuery: event.target.checked })}
                label={t('app.generation.grid.container_query')}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_400px]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <FileSearch className="h-4 w-4 text-[var(--primary)]" />
              {t('app.generation.grid.workspace')}
            </CardTitle>
            <CardDescription>{t('app.generation.grid.workspace_hint')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              value={workspace}
              onChange={event => updateWorkspace(event.target.value)}
              placeholder={t('app.generation.grid.workspace_placeholder')}
              className="min-h-[240px] font-mono text-xs"
              spellCheck={false}
            />
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <Metric
                label={t('app.generation.grid.metric.sources')}
                value={
                  parsedWorkspace.sources.length
                    ? parsedWorkspace.sources
                        .map(source => t(`app.generation.grid.source.${source}`))
                        .join(', ')
                    : '-'
                }
              />
              <Metric
                label={t('app.generation.grid.metric.import_columns')}
                value={
                  parsedWorkspace.columns
                    ? String(parsedWorkspace.columns)
                    : (parsedWorkspace.mode ?? '-')
                }
              />
              <Metric
                label={t('app.generation.grid.metric.import_gap')}
                value={parsedWorkspace.gap === null ? '-' : `${parsedWorkspace.gap}px`}
              />
              <Metric
                label={t('app.generation.grid.metric.import_areas')}
                value={String(parsedWorkspace.areaRows.length)}
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                icon={<ClipboardCheck className="h-4 w-4" />}
                disabled={parsedWorkspace.sources.length === 0}
                onClick={applyParsedWorkspace}
              >
                {t('app.generation.grid.use_parsed')}
              </Button>
              <Button
                type="button"
                variant="outline"
                icon={<FileSearch className="h-4 w-4" />}
                onClick={() => updateWorkspace(css)}
              >
                {t('app.generation.grid.use_generated')}
              </Button>
              <Button
                type="button"
                variant="ghost"
                icon={<Download className="h-4 w-4" />}
                onClick={() =>
                  downloadText(
                    workspaceJson,
                    'grid-workspace.json',
                    'application/json;charset=utf-8'
                  )
                }
              >
                {t('app.generation.grid.download_json')}
              </Button>
            </div>
            {parsedWorkspace.templateColumns || parsedWorkspace.areaRows.length > 0 ? (
              <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--glass-input-bg)] p-3">
                {parsedWorkspace.templateColumns && (
                  <p className="break-all font-mono text-xs text-[var(--text-secondary)]">
                    {parsedWorkspace.templateColumns}
                  </p>
                )}
                {parsedWorkspace.areaRows.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {visibleAreaRows.map(row => (
                      <p
                        key={row}
                        className="break-all font-mono text-xs text-[var(--text-tertiary)]"
                      >
                        {row}
                      </p>
                    ))}
                    {areaRowsLimited && (
                      <p className="rounded-lg border border-[var(--border-base)] bg-[var(--glass-input-bg)] px-3 py-2 text-xs leading-5 text-[var(--text-secondary)]">
                        {t('public.output_preview_rows_limited', {
                          total: parsedWorkspace.areaRows.length.toLocaleString(),
                          visible: visibleAreaRows.length.toLocaleString()
                        })}
                      </p>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-[var(--border-base)] p-5 text-sm leading-6 text-[var(--text-secondary)]">
                {t('app.generation.grid.workspace_empty')}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ShieldCheck className="h-4 w-4 text-[var(--primary)]" />
              {t('app.generation.grid.audit')}
            </CardTitle>
            <CardDescription>{t('app.generation.grid.audit_hint')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                icon={<Copy className="h-4 w-4" />}
                onClick={() => copy(findingsCsv)}
              >
                {t('app.generation.grid.copy_audit_csv')}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                icon={<Download className="h-4 w-4" />}
                onClick={() =>
                  downloadText(findingsCsv, 'grid-audit.csv', 'text/csv;charset=utf-8')
                }
              >
                {t('app.generation.grid.download_audit_csv')}
              </Button>
            </div>
            <div className="space-y-2">
              {visibleFindings.map(finding => (
                <GridFindingRow
                  key={`${finding.key}-${finding.subject}`}
                  finding={finding}
                  label={t(`app.generation.grid.audit.${finding.key}`)}
                  levelLabel={t(`app.generation.grid.level.${finding.level}`)}
                />
              ))}
              {findingsLimited && (
                <p className="rounded-lg border border-[var(--border-base)] bg-[var(--glass-input-bg)] px-3 py-2 text-xs leading-5 text-[var(--text-secondary)]">
                  {t('public.output_preview_rows_limited', {
                    total: findings.length.toLocaleString(),
                    visible: visibleFindings.length.toLocaleString()
                  })}
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </section>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_440px]">
        <Card className="min-h-[440px]">
          <CardHeader>
            <CardTitle className="text-base">{t('app.generation.grid.preview')}</CardTitle>
            <CardDescription>{t('app.generation.grid.preview_hint')}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid-shell">
              <div
                className="glass-clip grid rounded-2xl border border-[var(--border-base)] p-4 [content-visibility:auto]"
                style={{
                  alignItems: grid.align,
                  gap: grid.gap,
                  gridAutoFlow: getFlowValue(grid.flow),
                  gridAutoRows: `minmax(${grid.rows}px, auto)`,
                  gridTemplateAreas: areaDefinition?.rows.join(' ') ?? undefined,
                  gridTemplateColumns: previewTemplate,
                  justifyItems: grid.justify,
                  marginInline: grid.maxWidth > 0 ? 'auto' : undefined,
                  maxWidth: grid.maxWidth > 0 ? grid.maxWidth : undefined
                }}
              >
                {previewItems.map((item, index) => (
                  <div
                    key={`${item.area}-${index}`}
                    className="glass-panel glass-shimmer rounded-xl p-4"
                    style={{
                      aspectRatio: grid.squareItems ? '1' : undefined,
                      gridArea: areaDefinition ? item.area : undefined
                    }}
                  >
                    <span className="font-mono text-sm text-[var(--text-secondary)]">
                      {item.labelKey ? t(item.labelKey) : String(index + 1).padStart(2, '0')}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="flex min-h-[440px] flex-col">
          <CardHeader>
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between gap-3">
                <CardTitle className="text-base">{t('app.generation.grid.code')}</CardTitle>
                <Button
                  size="sm"
                  icon={<Copy className="h-3.5 w-3.5" />}
                  onClick={() => copy(currentOutput)}
                >
                  {t('public.copy')}
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                {OUTPUT_TABS.map(tab => (
                  <Button
                    key={tab}
                    type="button"
                    size="sm"
                    variant={outputTab === tab ? 'primary' : 'default'}
                    icon={getOutputIcon(tab)}
                    onClick={() => setOutputTab(tab)}
                  >
                    {t(`app.generation.grid.output.${tab}`)}
                  </Button>
                ))}
              </div>
            </div>
          </CardHeader>
          <CardContent className="flex min-h-0 flex-1 flex-col">
            <textarea
              id="grid-output"
              value={currentOutput}
              readOnly
              className="glass-input min-h-[320px] flex-1 resize-none rounded-xl p-3 font-mono text-sm text-[var(--text-primary)]"
            />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

const getOutputIcon = (tab: OutputTab) => {
  if (tab === 'css') return <Code2 className="h-3.5 w-3.5" />
  if (tab === 'tailwind') return <Sparkles className="h-3.5 w-3.5" />
  if (tab === 'html') return <FileCode2 className="h-3.5 w-3.5" />
  if (tab === 'react') return <LayoutTemplate className="h-3.5 w-3.5" />
  return <Braces className="h-3.5 w-3.5" />
}

const GridSlider = ({
  disabled = false,
  label,
  max,
  min,
  onChange,
  step = 1,
  suffix = '',
  value
}: {
  disabled?: boolean
  label: string
  max: number
  min: number
  onChange: (value: number) => void
  step?: number
  suffix?: string
  value: number
}) => (
  <div className="space-y-3">
    <div className="flex items-center justify-between gap-3">
      <Label>{label}</Label>
      <span className="font-mono text-sm text-[var(--text-secondary)]">
        {value}
        {suffix}
      </span>
    </div>
    <Slider value={value} min={min} max={max} step={step} disabled={disabled} onChange={onChange} />
  </div>
)

const Metric = ({ label, value }: { label: string; value: string }) => (
  <div className="glass-panel glass-clip rounded-2xl p-4">
    <div className="text-xs font-medium text-[var(--text-secondary)]">{label}</div>
    <div className="mt-2 font-mono text-xl font-semibold text-[var(--text-primary)]">{value}</div>
  </div>
)

const getFindingColorClass = (level: GridFindingLevel) => {
  if (level === 'danger') return 'border-[var(--error)]/30 text-[var(--error)]'
  if (level === 'warn') return 'border-[var(--warning)]/30 text-[var(--warning)]'

  return 'border-[var(--success)]/30 text-[var(--success)]'
}

const GridFindingRow = ({
  finding,
  label,
  levelLabel
}: {
  finding: GridFinding
  label: string
  levelLabel: string
}) => (
  <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--glass-input-bg)] p-3">
    <div className="flex items-start gap-2">
      {finding.level === 'good' ? (
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[var(--success)]" />
      ) : (
        <AlertTriangle
          className={`mt-0.5 h-4 w-4 shrink-0 ${finding.level === 'danger' ? 'text-[var(--error)]' : 'text-[var(--warning)]'}`}
        />
      )}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold text-[var(--text-primary)]">{label}</span>
          <span
            className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${getFindingColorClass(finding.level)}`}
          >
            {levelLabel}
          </span>
        </div>
        <p className="mt-1 break-all font-mono text-xs text-[var(--text-tertiary)]">
          {finding.subject}
        </p>
      </div>
    </div>
  </div>
)

export default GridBuilderClient
