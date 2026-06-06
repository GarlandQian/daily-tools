'use client'

import { ArrowRightLeft, CheckCircle2, Copy, FileCode2, Minimize2, Sparkles } from 'lucide-react'
import { useCallback, useDeferredValue, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import YAML from 'yaml'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/components/ui/toast'

type YamlAction = 'format' | 'minify' | 'yamlToJson' | 'jsonToYaml'

interface ParsedOutput {
  output: string
  error: string
  mode: YamlAction
}

const YAML_SAMPLE = `name: Daily Tools
version: 1
features:
  - YAML formatting
  - JSON conversion
  - validation
deploy:
  provider: Vercel
  runtime: static
`

const JSON_SAMPLE = `{
  "name": "Daily Tools",
  "features": ["YAML formatting", "JSON conversion", "validation"],
  "deploy": {
    "provider": "Vercel",
    "runtime": "static"
  }
}`

const parseYaml = (input: string) => YAML.parse(input)

const stringifyYaml = (value: unknown, minify = false) =>
  YAML.stringify(value, {
    indent: minify ? 0 : 2,
    lineWidth: minify ? 0 : 100
  }).trim()

const runAction = (input: string, action: YamlAction): ParsedOutput => {
  const trimmed = input.trim()
  if (!trimmed) {
    return {
      output: '',
      error: '',
      mode: action
    }
  }

  try {
    if (action === 'jsonToYaml') {
      return {
        output: stringifyYaml(JSON.parse(trimmed)),
        error: '',
        mode: action
      }
    }

    const parsed = parseYaml(trimmed)

    if (action === 'yamlToJson') {
      return {
        output: JSON.stringify(parsed, null, 2),
        error: '',
        mode: action
      }
    }

    return {
      output: stringifyYaml(parsed, action === 'minify'),
      error: '',
      mode: action
    }
  } catch (error) {
    return {
      output: '',
      error: error instanceof Error ? error.message : String(error),
      mode: action
    }
  }
}

const YamlClient = () => {
  const { t } = useTranslation()
  const toast = useToast()
  const [input, setInput] = useState(YAML_SAMPLE)
  const [action, setAction] = useState<YamlAction>('format')
  const deferredInput = useDeferredValue(input)

  const parsed = useMemo(() => runAction(deferredInput, action), [action, deferredInput])
  const hasInput = input.trim().length > 0
  const lineCount = useMemo(() => deferredInput.split(/\r\n|\r|\n/).length, [deferredInput])

  const handleCopy = useCallback(async () => {
    if (!parsed.output) return

    try {
      await navigator.clipboard.writeText(parsed.output)
      toast.success(t('public.copy.success'))
    } catch {
      toast.error(t('public.error'))
    }
  }, [parsed.output, toast, t])

  const handleUseSample = useCallback((sample: 'yaml' | 'json') => {
    setInput(sample === 'yaml' ? YAML_SAMPLE : JSON_SAMPLE)
    setAction(sample === 'yaml' ? 'format' : 'jsonToYaml')
  }, [])

  const handleApplyOutput = useCallback(() => {
    if (!parsed.output) return
    setInput(parsed.output)
    setAction(parsed.mode === 'yamlToJson' ? 'jsonToYaml' : 'format')
  }, [parsed.mode, parsed.output])

  return (
    <div className="flex size-full flex-col gap-5">
      <Card>
        <CardHeader>
          <div className="space-y-2">
            <CardTitle>{t('app.format.yaml')}</CardTitle>
            <CardDescription>{t('app.format.yaml.description')}</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant={action === 'format' ? 'primary' : 'default'}
              icon={<Sparkles className="h-4 w-4" />}
              onClick={() => setAction('format')}
            >
              {t('app.format.yaml.format')}
            </Button>
            <Button
              type="button"
              variant={action === 'minify' ? 'primary' : 'default'}
              icon={<Minimize2 className="h-4 w-4" />}
              onClick={() => setAction('minify')}
            >
              {t('app.format.yaml.minify')}
            </Button>
            <Button
              type="button"
              variant={action === 'yamlToJson' ? 'primary' : 'default'}
              icon={<ArrowRightLeft className="h-4 w-4" />}
              onClick={() => setAction('yamlToJson')}
            >
              {t('app.format.yaml.to_json')}
            </Button>
            <Button
              type="button"
              variant={action === 'jsonToYaml' ? 'primary' : 'default'}
              icon={<ArrowRightLeft className="h-4 w-4" />}
              onClick={() => setAction('jsonToYaml')}
            >
              {t('app.format.yaml.to_yaml')}
            </Button>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant="default"
              icon={<FileCode2 className="h-3.5 w-3.5" />}
              onClick={() => handleUseSample('yaml')}
            >
              {t('app.format.yaml.sample_yaml')}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="default"
              icon={<FileCode2 className="h-3.5 w-3.5" />}
              onClick={() => handleUseSample('json')}
            >
              {t('app.format.yaml.sample_json')}
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-5 xl:grid-cols-2">
        <Card className="flex min-h-[420px] flex-col overflow-hidden">
          <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1.5">
              <CardTitle className="text-base">{t('app.format.yaml.input')}</CardTitle>
              <CardDescription>
                {t('app.format.yaml.stats', {
                  lines: lineCount,
                  chars: input.length
                })}
              </CardDescription>
            </div>
            <Button type="button" variant="ghost" onClick={() => setInput('')}>
              {t('public.clear')}
            </Button>
          </CardHeader>
          <CardContent className="flex min-h-0 flex-1 flex-col gap-3">
            <Label htmlFor="yaml-input" className="sr-only">
              {t('app.format.yaml.input')}
            </Label>
            <Textarea
              id="yaml-input"
              value={input}
              onChange={event => setInput(event.target.value)}
              placeholder={t('app.format.yaml.placeholder')}
              spellCheck={false}
              className="min-h-[320px] flex-1 resize-none font-mono text-sm leading-6"
            />
          </CardContent>
        </Card>

        <Card className="flex min-h-[420px] flex-col overflow-hidden">
          <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1.5">
              <CardTitle className="text-base">{t('app.format.yaml.output')}</CardTitle>
              <CardDescription>
                {parsed.error
                  ? t('app.format.yaml.invalid')
                  : hasInput
                    ? t('app.format.yaml.valid')
                    : t('app.format.yaml.empty')}
              </CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="default"
                icon={<Copy className="h-4 w-4" />}
                disabled={!parsed.output}
                onClick={handleCopy}
              >
                {t('public.copy')}
              </Button>
              <Button
                type="button"
                variant="default"
                icon={<ArrowRightLeft className="h-4 w-4" />}
                disabled={!parsed.output}
                onClick={handleApplyOutput}
              >
                {t('app.format.yaml.use_output')}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="flex min-h-0 flex-1 flex-col gap-3">
            {parsed.error ? (
              <div className="rounded-2xl border border-[var(--error)] bg-[var(--error-subtle)] p-4 font-mono text-sm leading-6 text-[var(--text-primary)]">
                {parsed.error}
              </div>
            ) : parsed.output ? (
              <pre className="glass-input min-h-[320px] flex-1 overflow-auto rounded-lg p-4 text-sm leading-6">
                <code className="font-mono text-[var(--text-primary)]">{parsed.output}</code>
              </pre>
            ) : (
              <div className="flex min-h-[320px] flex-1 items-center justify-center rounded-2xl border border-[var(--glass-border)] bg-[var(--glass-bg)] p-6 text-center">
                <div className="max-w-sm space-y-3">
                  <div className="glass-panel glass-shimmer glass-clip mx-auto flex h-14 w-14 items-center justify-center rounded-2xl">
                    <CheckCircle2 className="h-7 w-7 text-[var(--text-secondary)]" />
                  </div>
                  <p className="text-sm leading-6 text-[var(--text-secondary)]">
                    {t('app.format.yaml.empty_description')}
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default YamlClient
