'use client'

import { Braces, Copy, FileCode2, RotateCcw, Sparkles, Trash2 } from 'lucide-react'
import { useDeferredValue, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useCopy } from '@/hooks/useCopy'

type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue }

interface GenerateOptions {
  readonlyProps: boolean
  nullableAsOptional: boolean
}

const SAMPLE_JSON = JSON.stringify(
  {
    id: 'tool_123',
    name: 'Daily Tools',
    published: true,
    tags: ['developer', 'utility'],
    owner: {
      name: 'Garland',
      url: 'https://example.com'
    },
    metrics: {
      users: 1200,
      rating: 4.8
    }
  },
  null,
  2
)

const isRecord = (value: JsonValue): value is { [key: string]: JsonValue } =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)

const toPascalCase = (value: string) => {
  const words = value
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean)

  const next = words.map(word => `${word.charAt(0).toUpperCase()}${word.slice(1)}`).join('')
  if (!next) return 'Generated'
  return /^\d/.test(next) ? `Type${next}` : next
}

const toSingularName = (value: string) => {
  const pascal = toPascalCase(value)
  if (pascal.endsWith('ies')) return `${pascal.slice(0, -3)}y`
  if (pascal.endsWith('s') && pascal.length > 1) return pascal.slice(0, -1)
  return `${pascal}Item`
}

const formatPropertyName = (key: string) =>
  /^[$A-Z_a-z][$\w]*$/.test(key) ? key : JSON.stringify(key)

const unionTypes = (types: string[]) => {
  const unique = [...new Set(types)]
  if (!unique.length) return 'unknown'
  if (unique.length === 1) return unique[0]
  return unique.sort().join(' | ')
}

const analyzeJson = (value: JsonValue) => {
  let objects = 0
  let arrays = 0
  let properties = 0
  let maxDepth = 0

  const visit = (node: JsonValue, depth: number) => {
    maxDepth = Math.max(maxDepth, depth)

    if (Array.isArray(node)) {
      arrays += 1
      node.forEach(item => visit(item, depth + 1))
      return
    }

    if (isRecord(node)) {
      objects += 1
      properties += Object.keys(node).length
      Object.values(node).forEach(item => visit(item, depth + 1))
    }
  }

  visit(value, 1)

  return { arrays, maxDepth, objects, properties }
}

const generateTypes = (value: JsonValue, rootName: string, options: GenerateOptions) => {
  const definitions: string[] = []
  const usedNames = new Map<string, number>()

  const reserveName = (rawName: string) => {
    const baseName = toPascalCase(rawName)
    const current = usedNames.get(baseName) ?? 0
    usedNames.set(baseName, current + 1)
    return current === 0 ? baseName : `${baseName}${current + 1}`
  }

  const infer = (node: JsonValue, nameHint: string): string => {
    if (node === null) return 'null'
    if (typeof node === 'string') return 'string'
    if (typeof node === 'number') return 'number'
    if (typeof node === 'boolean') return 'boolean'

    if (Array.isArray(node)) {
      if (!node.length) return 'unknown[]'
      const itemName = toSingularName(nameHint)
      const itemTypes = node.map(item => infer(item, itemName))
      return `Array<${unionTypes(itemTypes)}>`
    }

    const interfaceName = reserveName(nameHint)
    const lines = Object.entries(node).map(([key, child]) => {
      const nullable = child === null
      const optional = options.nullableAsOptional && nullable ? '?' : ''
      const type = options.nullableAsOptional && nullable ? 'unknown' : infer(child, key)
      const readonly = options.readonlyProps ? 'readonly ' : ''

      return `  ${readonly}${formatPropertyName(key)}${optional}: ${type}`
    })

    definitions.push(`export interface ${interfaceName} {\n${lines.join('\n')}\n}`)
    return interfaceName
  }

  const sanitizedRootName = toPascalCase(rootName)
  const rootType = infer(value, sanitizedRootName)
  const output = [...definitions]

  if (!isRecord(value)) {
    output.push(`export type ${sanitizedRootName} = ${rootType}`)
  }

  return output.join('\n\n')
}

const parseJson = (input: string): { data: JsonValue | null; error: string | null } => {
  if (!input.trim()) return { data: null, error: null }

  try {
    return { data: JSON.parse(input) as JsonValue, error: null }
  } catch (error) {
    return { data: null, error: error instanceof Error ? error.message : 'Invalid JSON' }
  }
}

const JsonToTsClient = () => {
  const { t } = useTranslation()
  const { copy } = useCopy()
  const [input, setInput] = useState(SAMPLE_JSON)
  const [rootName, setRootName] = useState('Root')
  const [readonlyProps, setReadonlyProps] = useState(false)
  const [nullableAsOptional, setNullableAsOptional] = useState(false)
  const deferredInput = useDeferredValue(input)

  const parsed = useMemo(() => parseJson(deferredInput), [deferredInput])
  const analysis = useMemo(
    () => (parsed.data === null ? null : analyzeJson(parsed.data)),
    [parsed.data]
  )
  const output = useMemo(() => {
    if (parsed.data === null) return ''
    return generateTypes(parsed.data, rootName, { nullableAsOptional, readonlyProps })
  }, [nullableAsOptional, parsed.data, readonlyProps, rootName])

  const handleReset = () => {
    setInput(SAMPLE_JSON)
    setRootName('Root')
    setReadonlyProps(false)
    setNullableAsOptional(false)
  }

  return (
    <div className="flex size-full flex-col gap-5">
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-2">
              <CardTitle className="flex items-center gap-2">
                <FileCode2 className="h-5 w-5 text-[var(--primary)]" />
                {t('app.format.json2ts')}
              </CardTitle>
              <CardDescription>{t('app.format.json2ts.description')}</CardDescription>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button
                icon={<Copy className="h-4 w-4" />}
                onClick={() => copy(output)}
                disabled={!output}
              >
                {t('public.copy')}
              </Button>
              <Button
                variant="ghost"
                icon={<RotateCcw className="h-4 w-4" />}
                onClick={handleReset}
              >
                {t('public.reset')}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div className="space-y-3">
              <Label htmlFor="json2ts-root">{t('app.format.json2ts.root_name')}</Label>
              <Input
                id="json2ts-root"
                value={rootName}
                onChange={event => setRootName(event.target.value)}
                className="font-mono"
              />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-1">
              <Checkbox
                checked={readonlyProps}
                onChange={event => setReadonlyProps(event.target.checked)}
                label={t('app.format.json2ts.readonly')}
              />
              <Checkbox
                checked={nullableAsOptional}
                onChange={event => setNullableAsOptional(event.target.checked)}
                label={t('app.format.json2ts.optional_null')}
              />
            </div>
          </div>

          {analysis && (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <Metric label={t('app.format.json2ts.objects')} value={String(analysis.objects)} />
              <Metric label={t('app.format.json2ts.arrays')} value={String(analysis.arrays)} />
              <Metric
                label={t('app.format.json2ts.properties')}
                value={String(analysis.properties)}
              />
              <Metric label={t('app.format.json2ts.depth')} value={String(analysis.maxDepth)} />
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-5 xl:grid-cols-2">
        <Card className="flex min-h-[420px] flex-col overflow-hidden">
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Braces className="h-4 w-4 text-[var(--primary)]" />
                JSON
              </CardTitle>
              <Button
                size="sm"
                variant="ghost"
                icon={<Trash2 className="h-4 w-4" />}
                onClick={() => setInput('')}
              >
                {t('public.clear')}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="flex-1 overflow-hidden">
            <Textarea
              value={input}
              onChange={event => setInput(event.target.value)}
              placeholder={t('app.format.json2ts.placeholder')}
              className="h-full min-h-[360px] resize-none font-mono text-xs"
            />
          </CardContent>
        </Card>

        <Card className="flex min-h-[420px] flex-col overflow-hidden">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Sparkles className="h-4 w-4 text-[var(--primary)]" />
              TypeScript
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1 overflow-hidden">
            {parsed.error ? (
              <div className="glass-input flex h-full min-h-[360px] items-center justify-center rounded-xl p-6 text-center">
                <p className="max-w-md text-sm leading-6 text-[var(--error)]">{parsed.error}</p>
              </div>
            ) : output ? (
              <pre className="glass-input h-full min-h-[360px] overflow-auto rounded-xl p-4 font-mono text-xs leading-6 text-[var(--text-primary)]">
                {output}
              </pre>
            ) : (
              <div className="glass-input flex h-full min-h-[360px] items-center justify-center rounded-xl p-6 text-center">
                <p className="max-w-md text-sm leading-6 text-[var(--text-secondary)]">
                  {t('app.format.json2ts.empty')}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

const Metric = ({ label, value }: { label: string; value: string }) => (
  <div className="glass-input rounded-2xl p-4">
    <div className="text-xs text-[var(--text-tertiary)]">{label}</div>
    <div className="mt-2 truncate font-mono text-sm font-semibold text-[var(--text-primary)]">
      {value}
    </div>
  </div>
)

export default JsonToTsClient
