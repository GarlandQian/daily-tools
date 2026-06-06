'use client'

import { Copy, Grid3X3, RotateCcw } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Slider } from '@/components/ui/slider'
import { useCopy } from '@/hooks/useCopy'

type GridMode = 'fixed' | 'auto-fit' | 'auto-fill'
type AlignMode = 'stretch' | 'start' | 'center' | 'end'

const clampNumber = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

const buildGridCss = ({
  align,
  columns,
  gap,
  minTrack,
  mode,
  rows,
  squareItems
}: {
  align: AlignMode
  columns: number
  gap: number
  minTrack: number
  mode: GridMode
  rows: number
  squareItems: boolean
}) => {
  const template =
    mode === 'fixed'
      ? `repeat(${columns}, minmax(0, 1fr))`
      : `repeat(${mode}, minmax(min(${minTrack}px, 100%), 1fr))`

  return `.grid {
  display: grid;
  grid-template-columns: ${template};
  grid-auto-rows: minmax(${rows}px, auto);
  gap: ${gap}px;
  align-items: ${align};
}

.grid > * {
${squareItems ? '  aspect-ratio: 1;\n' : ''}  min-width: 0;
}`
}

const buildTailwind = (mode: GridMode, columns: number, gap: number, minTrack: number) => {
  if (mode === 'fixed') return `grid grid-cols-${columns} gap-[${gap}px]`
  return `grid grid-cols-[repeat(${mode},minmax(min(${minTrack}px,100%),1fr))] gap-[${gap}px]`
}

const GridBuilderClient = () => {
  const { t } = useTranslation()
  const { copy } = useCopy()
  const [mode, setMode] = useState<GridMode>('auto-fit')
  const [columns, setColumns] = useState(4)
  const [minTrack, setMinTrack] = useState(220)
  const [rows, setRows] = useState(120)
  const [gap, setGap] = useState(16)
  const [align, setAlign] = useState<AlignMode>('stretch')
  const [squareItems, setSquareItems] = useState(false)
  const [itemCount, setItemCount] = useState(8)

  const css = useMemo(
    () => buildGridCss({ align, columns, gap, minTrack, mode, rows, squareItems }),
    [align, columns, gap, minTrack, mode, rows, squareItems]
  )
  const tailwind = useMemo(
    () => buildTailwind(mode, columns, gap, minTrack),
    [columns, gap, minTrack, mode]
  )
  const previewTemplate =
    mode === 'fixed'
      ? `repeat(${columns}, minmax(0, 1fr))`
      : `repeat(${mode}, minmax(min(${minTrack}px, 100%), 1fr))`

  const reset = () => {
    setMode('auto-fit')
    setColumns(4)
    setMinTrack(220)
    setRows(120)
    setGap(16)
    setAlign('stretch')
    setSquareItems(false)
    setItemCount(8)
  }

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
              <Button size="sm" icon={<Copy className="h-4 w-4" />} onClick={() => copy(css)}>
                {t('public.copy')}
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
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <div className="space-y-3">
              <Label htmlFor="grid-mode">{t('app.generation.grid.mode')}</Label>
              <Select
                id="grid-mode"
                value={mode}
                onChange={event => setMode(event.target.value as GridMode)}
              >
                {(['auto-fit', 'auto-fill', 'fixed'] as const).map(value => (
                  <option key={value} value={value}>
                    {t(`app.generation.grid.mode.${value}`)}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-3">
              <Label htmlFor="grid-align">{t('app.generation.grid.align')}</Label>
              <Select
                id="grid-align"
                value={align}
                onChange={event => setAlign(event.target.value as AlignMode)}
              >
                {(['stretch', 'start', 'center', 'end'] as const).map(value => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </Select>
            </div>
            <div className="glass-input rounded-xl p-3">
              <Checkbox
                checked={squareItems}
                onChange={event => setSquareItems(event.target.checked)}
                label={t('app.generation.grid.square')}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            <GridSlider
              label={t('app.generation.grid.columns')}
              value={columns}
              min={1}
              max={12}
              onChange={setColumns}
            />
            <GridSlider
              label={t('app.generation.grid.min_track')}
              value={minTrack}
              min={120}
              max={420}
              onChange={setMinTrack}
              suffix="px"
            />
            <GridSlider
              label={t('app.generation.grid.rows')}
              value={rows}
              min={48}
              max={240}
              onChange={setRows}
              suffix="px"
            />
            <GridSlider
              label={t('app.generation.grid.gap')}
              value={gap}
              min={0}
              max={48}
              onChange={setGap}
              suffix="px"
            />
            <div className="space-y-3">
              <Label htmlFor="grid-items">{t('app.generation.grid.items')}</Label>
              <Input
                id="grid-items"
                type="number"
                min={1}
                max={36}
                value={itemCount}
                onChange={event => setItemCount(clampNumber(Number(event.target.value), 1, 36))}
                className="font-mono"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
        <Card className="min-h-[420px]">
          <CardHeader>
            <CardTitle className="text-base">{t('app.generation.grid.preview')}</CardTitle>
            <CardDescription>{t('app.generation.grid.preview_hint')}</CardDescription>
          </CardHeader>
          <CardContent>
            <div
              className="glass-clip grid rounded-2xl border border-[var(--border-base)] p-4"
              style={{
                alignItems: align,
                gap,
                gridAutoRows: `minmax(${rows}px, auto)`,
                gridTemplateColumns: previewTemplate
              }}
            >
              {Array.from({ length: itemCount }, (_, index) => (
                <div
                  key={index}
                  className="glass-panel glass-shimmer rounded-xl p-4"
                  style={squareItems ? { aspectRatio: '1' } : undefined}
                >
                  <span className="font-mono text-sm text-[var(--text-secondary)]">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="flex min-h-[420px] flex-col">
          <CardHeader>
            <CardTitle className="text-base">{t('app.generation.grid.code')}</CardTitle>
          </CardHeader>
          <CardContent className="flex min-h-0 flex-1 flex-col gap-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <Label htmlFor="grid-css">CSS</Label>
                <Button size="sm" variant="ghost" onClick={() => copy(css)}>
                  {t('public.copy')}
                </Button>
              </div>
              <textarea
                id="grid-css"
                value={css}
                readOnly
                rows={11}
                className="glass-input w-full resize-none rounded-xl p-3 font-mono text-sm text-[var(--text-primary)]"
              />
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-3">
                <Label htmlFor="grid-tailwind">Tailwind</Label>
                <Button size="sm" variant="ghost" onClick={() => copy(tailwind)}>
                  {t('public.copy')}
                </Button>
              </div>
              <textarea
                id="grid-tailwind"
                value={tailwind}
                readOnly
                rows={3}
                className="glass-input w-full resize-none rounded-xl p-3 font-mono text-sm text-[var(--text-primary)]"
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

const GridSlider = ({
  label,
  max,
  min,
  onChange,
  suffix = '',
  value
}: {
  label: string
  max: number
  min: number
  onChange: (value: number) => void
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
    <Slider value={value} min={min} max={max} onChange={onChange} />
  </div>
)

export default GridBuilderClient
