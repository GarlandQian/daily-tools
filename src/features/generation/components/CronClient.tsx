'use client'

import CronParser from 'cron-parser'
import dayjs from 'dayjs'
import {
  AlertTriangle,
  CalendarClock,
  ClipboardCheck,
  Copy,
  Download,
  FileSearch,
  ListChecks,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Trash2
} from 'lucide-react'
import { useCallback, useDeferredValue, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Slider } from '@/components/ui/slider'
import { Textarea } from '@/components/ui/textarea'
import { useCopy } from '@/hooks/useCopy'

interface CronFormData {
  second: string
  minute: string
  hour: string
  dayOfMonth: string
  month: string
  dayOfWeek: string
}

interface CronPreset {
  key: string
  value: CronFormData
}

type CronMode = 'builder' | 'manual'
type CronFindingLevel = 'danger' | 'good' | 'warn'
type ParsedCronSource = 'crontab' | 'github' | 'kubernetes' | 'macro' | 'six-field'

interface ParsedCronCandidate {
  command: string
  expression: string
  id: string
  line: number
  source: ParsedCronSource
  valid: boolean
}

interface ParsedCronWorkspace {
  candidates: ParsedCronCandidate[]
  capped: boolean
  invalidLines: number
  systemdSchedules: string[]
}

interface CronFinding {
  key: string
  level: CronFindingLevel
  subject: string
}

const DEFAULT_FORM_DATA: CronFormData = {
  second: '0',
  minute: '0',
  hour: '*',
  dayOfMonth: '*',
  month: '*',
  dayOfWeek: '*'
}

const CRON_PRESETS: CronPreset[] = [
  {
    key: 'minute',
    value: { second: '0', minute: '*', hour: '*', dayOfMonth: '*', month: '*', dayOfWeek: '*' }
  },
  {
    key: 'hourly',
    value: { second: '0', minute: '0', hour: '*', dayOfMonth: '*', month: '*', dayOfWeek: '*' }
  },
  {
    key: 'daily',
    value: { second: '0', minute: '0', hour: '0', dayOfMonth: '*', month: '*', dayOfWeek: '*' }
  },
  {
    key: 'weekday',
    value: { second: '0', minute: '0', hour: '9', dayOfMonth: '*', month: '*', dayOfWeek: '1-5' }
  },
  {
    key: 'monthly',
    value: { second: '0', minute: '0', hour: '0', dayOfMonth: '1', month: '*', dayOfWeek: '*' }
  }
]

const CRON_TIMEZONES = ['Asia/Shanghai', 'UTC', 'America/New_York', 'Europe/London']
const commonOptionValues = ['*', '0', '1', '5', '9', '10', '12', '15', '30']
const dayOptionValues = ['*', '1', '5', '10', '15', '20', '25', '30']
const weekdayOptionValues = ['*', '0', '1', '1-5', '2', '3', '4', '5', '6']
const MAX_CRON_WORKSPACE_CHARS = 60000
const MAX_PARSED_CRON_CANDIDATES = 24
const CRON_MACROS = new Set([
  '@annually',
  '@daily',
  '@hourly',
  '@midnight',
  '@monthly',
  '@reboot',
  '@weekly',
  '@yearly'
])
const CRON_MONTH_NAMES = new Set([
  'APR',
  'AUG',
  'DEC',
  'FEB',
  'JAN',
  'JUL',
  'JUN',
  'MAR',
  'MAY',
  'NOV',
  'OCT',
  'SEP'
])
const CRON_WEEKDAY_NAMES = new Set(['FRI', 'MON', 'SAT', 'SUN', 'THU', 'TUE', 'WED'])

const clampNumber = (value: number, min: number, max: number) => {
  if (!Number.isFinite(value)) return min
  return Math.min(max, Math.max(min, Math.floor(value)))
}

const buildSixFieldExpression = (formData: CronFormData) =>
  `${formData.second} ${formData.minute} ${formData.hour} ${formData.dayOfMonth} ${formData.month} ${formData.dayOfWeek}`

const toFiveFieldExpression = (expression: string) => {
  const parts = expression.trim().split(/\s+/)
  if (parts.length === 6) return parts.slice(1).join(' ')
  return expression.trim()
}

const getExpressionParts = (expression: string) => expression.trim().split(/\s+/).filter(Boolean)

const isCronMacro = (value: string) => CRON_MACROS.has(value.toLowerCase())

const isCronField = (value: string) => /^[\d*/,\-?A-Z#LW]+$/iu.test(value)

const isCronFieldForPosition = (value: string, position: number, hasSeconds: boolean) => {
  if (!isCronField(value)) return false
  const fiveFieldPosition = hasSeconds ? position - 1 : position
  const words = value.match(/[A-Z]+/giu) ?? []
  if (words.length === 0) return true

  return words.every(word => {
    const upper = word.toUpperCase()
    if (upper === 'L' || upper === 'W') return true
    if (fiveFieldPosition === 3) return CRON_MONTH_NAMES.has(upper)
    if (fiveFieldPosition === 4) return CRON_WEEKDAY_NAMES.has(upper)
    return false
  })
}

const isFiveFieldCron = (parts: string[]) =>
  parts.length >= 5 &&
  parts.slice(0, 5).every((part, index) => isCronFieldForPosition(part, index, false))

const isSixFieldCron = (parts: string[]) =>
  parts.length === 6 && parts.every((part, index) => isCronFieldForPosition(part, index, true))

const hasQuartzToken = (expression: string) => /[?#L]/iu.test(expression)

const hasRestrictedField = (value: string | undefined) =>
  Boolean(value && value !== '*' && value !== '?')

const isEveryMinute = (
  minute: string | undefined,
  hour: string | undefined,
  day: string | undefined,
  month: string | undefined,
  weekday: string | undefined
) =>
  (minute === '*' || minute === '*/1' || minute === '0/1') &&
  [hour, day, month, weekday].every(value => !value || value === '*' || value === '?')

const isSubMinuteSchedule = (second: string | undefined) =>
  second === '*' || /^(\*|0)\/[1-4]$/u.test(second ?? '')

const extractQuotedSchedule = (line: string, key: string) => {
  const quotedMatch = line.match(new RegExp(`${key}\\s*:\\s*["']([^"']+)["']`, 'iu'))
  if (quotedMatch?.[1]) return quotedMatch[1].trim()
  const bareMatch = line.match(new RegExp(`${key}\\s*:\\s*(.+)$`, 'iu'))
  return bareMatch?.[1]?.replace(/\s+#.*$/u, '').trim() ?? ''
}

const validateCronExpression = (expression: string, timezone: string) => {
  try {
    if (expression.trim().toLowerCase() === '@reboot') return false
    CronParser.parse(toFiveFieldExpression(expression), { tz: timezone })
    return true
  } catch {
    return false
  }
}

const pushCronCandidate = ({
  candidates,
  command = '',
  expression,
  line,
  source,
  timezone
}: {
  candidates: ParsedCronCandidate[]
  command?: string
  expression: string
  line: number
  source: ParsedCronSource
  timezone: string
}) => {
  if (!expression || candidates.length >= MAX_PARSED_CRON_CANDIDATES) return
  candidates.push({
    command,
    expression,
    id: `${source}-${line}-${candidates.length}`,
    line,
    source,
    valid: validateCronExpression(expression, timezone)
  })
}

const parseCronWorkspace = (input: string, timezone: string): ParsedCronWorkspace => {
  const source = input.slice(0, MAX_CRON_WORKSPACE_CHARS)
  const candidates: ParsedCronCandidate[] = []
  const systemdSchedules: string[] = []
  let invalidLines = 0

  source.split(/\r?\n/u).forEach((line, index) => {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) return

    const githubSchedule = extractQuotedSchedule(trimmed, 'cron')
    if (githubSchedule) {
      pushCronCandidate({
        candidates,
        expression: githubSchedule,
        line: index + 1,
        source: 'github',
        timezone
      })
      return
    }

    const kubernetesSchedule = extractQuotedSchedule(trimmed, 'schedule')
    if (kubernetesSchedule) {
      pushCronCandidate({
        candidates,
        expression: kubernetesSchedule,
        line: index + 1,
        source: 'kubernetes',
        timezone
      })
      return
    }

    const systemdMatch = trimmed.match(/^On(?:Calendar|UnitActiveSec|BootSec)\s*=\s*(.+)$/iu)
    if (systemdMatch?.[1]) {
      systemdSchedules.push(systemdMatch[1].trim())
      return
    }

    if (/^[A-Z_][A-Z0-9_]*=/u.test(trimmed)) return

    const parts = getExpressionParts(trimmed)
    const first = parts[0] ?? ''

    if (isCronMacro(first)) {
      pushCronCandidate({
        candidates,
        command: parts.slice(1).join(' '),
        expression: first,
        line: index + 1,
        source: 'macro',
        timezone
      })
      return
    }

    if (isSixFieldCron(parts)) {
      pushCronCandidate({
        candidates,
        expression: parts.join(' '),
        line: index + 1,
        source: 'six-field',
        timezone
      })
      return
    }

    if (isFiveFieldCron(parts)) {
      pushCronCandidate({
        candidates,
        command: parts.slice(5).join(' '),
        expression: parts.slice(0, 5).join(' '),
        line: index + 1,
        source: 'crontab',
        timezone
      })
      return
    }

    invalidLines += 1
  })

  return {
    candidates,
    capped: input.length > MAX_CRON_WORKSPACE_CHARS,
    invalidLines,
    systemdSchedules
  }
}

const buildCronFindings = ({
  activeExpression,
  parsedWorkspace,
  previewError,
  timezone
}: {
  activeExpression: string
  parsedWorkspace: ParsedCronWorkspace
  previewError: string
  timezone: string
}) => {
  const findings: CronFinding[] = []
  const parts = getExpressionParts(activeExpression)
  const isMacro = parts.length === 1 && isCronMacro(parts[0] ?? '')
  const expressionParts = parts.length === 6 ? parts.slice(1) : parts

  if (!activeExpression.trim())
    findings.push({ key: 'empty_expression', level: 'danger', subject: 'cron' })
  if (previewError)
    findings.push({ key: 'invalid_expression', level: 'danger', subject: previewError })
  if (parts.length === 6 && parts[0] !== '0')
    findings.push({ key: 'nonzero_seconds', level: 'warn', subject: parts[0] })
  if (parts.length === 6 && isSubMinuteSchedule(parts[0]))
    findings.push({ key: 'sub_minute', level: 'warn', subject: parts[0] })
  if (
    !isMacro &&
    expressionParts.length === 5 &&
    isEveryMinute(
      expressionParts[0],
      expressionParts[1],
      expressionParts[2],
      expressionParts[3],
      expressionParts[4]
    )
  ) {
    findings.push({
      key: 'too_frequent',
      level: 'warn',
      subject: toFiveFieldExpression(activeExpression)
    })
  }
  if (
    !isMacro &&
    expressionParts.length === 5 &&
    hasRestrictedField(expressionParts[2]) &&
    hasRestrictedField(expressionParts[4])
  ) {
    findings.push({
      key: 'dom_dow_ambiguity',
      level: 'warn',
      subject: `${expressionParts[2]} / ${expressionParts[4]}`
    })
  }
  if (hasQuartzToken(activeExpression))
    findings.push({ key: 'quartz_tokens', level: 'warn', subject: activeExpression })
  if (
    (timezone.startsWith('America/') || timezone.startsWith('Europe/')) &&
    !isMacro &&
    expressionParts.length === 5 &&
    /^(0|1|2|3)$/u.test(expressionParts[1] ?? '')
  ) {
    findings.push({ key: 'dst_sensitive', level: 'warn', subject: timezone })
  }
  if (parsedWorkspace.capped)
    findings.push({
      key: 'workspace_capped',
      level: 'warn',
      subject: `${MAX_CRON_WORKSPACE_CHARS}`
    })
  if (parsedWorkspace.invalidLines > 0)
    findings.push({
      key: 'workspace_invalid_lines',
      level: 'warn',
      subject: String(parsedWorkspace.invalidLines)
    })
  if (parsedWorkspace.systemdSchedules.length > 0)
    findings.push({
      key: 'systemd_calendar',
      level: 'warn',
      subject: parsedWorkspace.systemdSchedules.slice(0, 2).join(', ')
    })
  if (parsedWorkspace.candidates.some(candidate => !candidate.valid))
    findings.push({
      key: 'workspace_invalid_schedule',
      level: 'danger',
      subject: parsedWorkspace.candidates
        .filter(candidate => !candidate.valid)
        .map(candidate => `#${candidate.line}`)
        .join(', ')
    })
  if (
    parsedWorkspace.candidates.some(
      candidate =>
        ['github', 'kubernetes'].includes(candidate.source) &&
        getExpressionParts(candidate.expression).length === 6
    )
  ) {
    findings.push({ key: 'five_field_platform', level: 'warn', subject: 'GitHub/Kubernetes' })
  }
  if (parsedWorkspace.candidates.length >= MAX_PARSED_CRON_CANDIDATES)
    findings.push({
      key: 'workspace_result_capped',
      level: 'warn',
      subject: String(MAX_PARSED_CRON_CANDIDATES)
    })
  if (!previewError && findings.length === 0)
    findings.push({ key: 'ready', level: 'good', subject: toFiveFieldExpression(activeExpression) })

  return findings
}

const csvCell = (value: string | number | null | undefined) => {
  const raw = String(value ?? '')
  const safe = /^[=+\-@\t\r]/u.test(raw) ? `'${raw}` : raw
  return `"${safe.replace(/"/gu, '""')}"`
}

const buildFindingsCsv = (findings: CronFinding[]) =>
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

const CronClient = () => {
  const { t } = useTranslation()
  const { copy } = useCopy()
  const [formData, setFormData] = useState<CronFormData>(DEFAULT_FORM_DATA)
  const [mode, setMode] = useState<CronMode>('builder')
  const [manualExpression, setManualExpression] = useState('0 * * * *')
  const [timezone, setTimezone] = useState('Asia/Shanghai')
  const [previewCount, setPreviewCount] = useState(5)
  const [workspace, setWorkspace] = useState(
    '# crontab\n0 9 * * 1-5 npm run report\n\n# GitHub Actions\n- cron: "0 2 * * *"\n\n# Kubernetes CronJob\nschedule: "*/15 * * * *"'
  )
  const deferredWorkspace = useDeferredValue(workspace)

  const commonOptions = useMemo(
    () =>
      commonOptionValues.map(value => ({
        label: value === '*' ? t('app.generation.cron.every') : value,
        value
      })),
    [t]
  )
  const dayOptions = useMemo(
    () =>
      dayOptionValues.map(value => ({
        label: value === '*' ? t('app.generation.cron.every_day') : value,
        value
      })),
    [t]
  )
  const weekdayOptions = useMemo(
    () =>
      weekdayOptionValues.map(value => ({
        label:
          value === '*'
            ? t('app.generation.cron.every_day')
            : value === '1-5'
              ? t('app.generation.cron.weekday.business')
              : t(`app.generation.cron.weekday.${value}`),
        value
      })),
    [t]
  )

  const normalizedPreviewCount = clampNumber(previewCount, 1, 20)
  const builderExpression = useMemo(() => buildSixFieldExpression(formData), [formData])
  const activeExpression = mode === 'builder' ? builderExpression : manualExpression.trim()
  const fiveFieldExpression = useMemo(
    () => toFiveFieldExpression(activeExpression),
    [activeExpression]
  )
  const parsedWorkspace = useMemo(
    () => parseCronWorkspace(deferredWorkspace, timezone),
    [deferredWorkspace, timezone]
  )

  const preview = useMemo(() => {
    try {
      const interval = CronParser.parse(fiveFieldExpression, { tz: timezone })
      const results = Array.from({ length: normalizedPreviewCount }, () => {
        const next = interval.next()
        return dayjs(next.toDate()).format('YYYY-MM-DD HH:mm:ss')
      })
      return { error: '', results }
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : t('app.generation.cron.invalid'),
        results: []
      }
    }
  }, [fiveFieldExpression, normalizedPreviewCount, t, timezone])
  const findings = useMemo(
    () =>
      buildCronFindings({
        activeExpression,
        parsedWorkspace,
        previewError: preview.error,
        timezone
      }),
    [activeExpression, parsedWorkspace, preview.error, timezone]
  )
  const findingsCsv = useMemo(() => buildFindingsCsv(findings), [findings])
  const firstParsedCandidate = parsedWorkspace.candidates.find(candidate => candidate.valid)
  const runGapMinutes = useMemo(() => {
    if (preview.results.length < 2) return '-'
    const gap = dayjs(preview.results[1]).diff(dayjs(preview.results[0]), 'minute')
    if (!Number.isFinite(gap)) return '-'
    return String(gap)
  }, [preview.results])

  const handleApplyPreset = useCallback((preset: CronPreset) => {
    setMode('builder')
    setFormData(preset.value)
    setManualExpression(toFiveFieldExpression(buildSixFieldExpression(preset.value)))
  }, [])

  const handleReset = useCallback(() => {
    setFormData(DEFAULT_FORM_DATA)
    setMode('builder')
    setManualExpression('0 * * * *')
    setTimezone('Asia/Shanghai')
    setPreviewCount(5)
    setWorkspace(
      '# crontab\n0 9 * * 1-5 npm run report\n\n# GitHub Actions\n- cron: "0 2 * * *"\n\n# Kubernetes CronJob\nschedule: "*/15 * * * *"'
    )
  }, [])

  const handleApplyParsed = useCallback((candidate: ParsedCronCandidate) => {
    setMode('manual')
    setManualExpression(toFiveFieldExpression(candidate.expression))
  }, [])

  return (
    <div className="flex size-full flex-col gap-5">
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-2">
              <CardTitle className="flex items-center gap-2">
                <CalendarClock className="h-5 w-5 text-[var(--primary)]" />
                {t('app.generation.cron')}
              </CardTitle>
              <CardDescription>{t('app.generation.cron.description')}</CardDescription>
            </div>
            <Button
              type="button"
              variant="ghost"
              icon={<RotateCcw className="h-4 w-4" />}
              onClick={handleReset}
            >
              {t('app.generation.cron.reset')}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex flex-wrap gap-2">
            {CRON_PRESETS.map(preset => (
              <Button
                key={preset.key}
                type="button"
                size="sm"
                variant="ghost"
                icon={<Sparkles className="h-4 w-4" />}
                onClick={() => handleApplyPreset(preset)}
              >
                {t(`app.generation.cron.preset.${preset.key}`)}
              </Button>
            ))}
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 sm:w-fit">
                {(['builder', 'manual'] as const).map(nextMode => (
                  <Button
                    key={nextMode}
                    type="button"
                    variant={mode === nextMode ? 'primary' : 'ghost'}
                    onClick={() => setMode(nextMode)}
                  >
                    {t(`app.generation.cron.mode.${nextMode}`)}
                  </Button>
                ))}
              </div>

              {mode === 'builder' ? (
                <div className="grid grid-cols-1 gap-x-5 gap-y-5 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6">
                  <CronSelect
                    id="second"
                    label={t('app.generation.cron.second')}
                    value={formData.second}
                    options={commonOptions}
                    onChange={value => setFormData(prev => ({ ...prev, second: value }))}
                  />
                  <CronSelect
                    id="minute"
                    label={t('app.generation.cron.minute')}
                    value={formData.minute}
                    options={commonOptions}
                    onChange={value => setFormData(prev => ({ ...prev, minute: value }))}
                  />
                  <CronSelect
                    id="hour"
                    label={t('app.generation.cron.hour')}
                    value={formData.hour}
                    options={commonOptions}
                    onChange={value => setFormData(prev => ({ ...prev, hour: value }))}
                  />
                  <CronSelect
                    id="dayOfMonth"
                    label={t('app.generation.cron.day')}
                    value={formData.dayOfMonth}
                    options={dayOptions}
                    onChange={value => setFormData(prev => ({ ...prev, dayOfMonth: value }))}
                  />
                  <CronSelect
                    id="month"
                    label={t('app.generation.cron.month')}
                    value={formData.month}
                    options={commonOptions}
                    onChange={value => setFormData(prev => ({ ...prev, month: value }))}
                  />
                  <CronSelect
                    id="dayOfWeek"
                    label={t('app.generation.cron.weekday')}
                    value={formData.dayOfWeek}
                    options={weekdayOptions}
                    onChange={value => setFormData(prev => ({ ...prev, dayOfWeek: value }))}
                  />
                </div>
              ) : (
                <div className="space-y-3">
                  <Label htmlFor="cron-manual">{t('app.generation.cron.expression')}</Label>
                  <Input
                    id="cron-manual"
                    value={manualExpression}
                    onChange={event => setManualExpression(event.target.value)}
                    className="font-mono"
                    placeholder="0 9 * * 1-5"
                  />
                </div>
              )}
            </div>

            <div className="space-y-4">
              <div className="space-y-3">
                <Label htmlFor="cron-timezone">{t('app.generation.cron.timezone')}</Label>
                <Select
                  id="cron-timezone"
                  value={timezone}
                  onChange={event => setTimezone(event.target.value)}
                >
                  {CRON_TIMEZONES.map(zone => (
                    <option key={zone} value={zone}>
                      {zone}
                    </option>
                  ))}
                </Select>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <Label htmlFor="cron-preview-count">{t('app.generation.cron.count')}</Label>
                  <span className="font-mono text-sm text-[var(--text-secondary)]">
                    {normalizedPreviewCount}
                  </span>
                </div>
                <Slider
                  id="cron-preview-count"
                  min={1}
                  max={20}
                  value={normalizedPreviewCount}
                  onChange={setPreviewCount}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <CronMetric label={t('app.generation.cron.summary.mode')} value={mode} />
                <CronMetric
                  label={t('app.generation.cron.summary.timezone')}
                  value={timezone.replace(/.+\//, '')}
                />
                <CronMetric
                  label={t('app.generation.cron.summary.count')}
                  value={String(normalizedPreviewCount)}
                />
                <CronMetric label={t('app.generation.cron.summary.gap')} value={runGapMinutes} />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <FileSearch className="h-4 w-4 text-[var(--primary)]" />
              {t('app.generation.cron.workspace')}
            </CardTitle>
            <CardDescription>{t('app.generation.cron.workspace_hint')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              value={workspace}
              onChange={event => setWorkspace(event.target.value)}
              placeholder={t('app.generation.cron.workspace_placeholder')}
              className="min-h-[220px] font-mono text-xs"
              spellCheck={false}
            />
            <div className="grid grid-cols-3 gap-3">
              <CronMetric
                label={t('app.generation.cron.metric.parsed')}
                value={String(parsedWorkspace.candidates.length)}
              />
              <CronMetric
                label={t('app.generation.cron.metric.invalid')}
                value={String(parsedWorkspace.invalidLines)}
              />
              <CronMetric
                label={t('app.generation.cron.metric.systemd')}
                value={String(parsedWorkspace.systemdSchedules.length)}
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                icon={<ClipboardCheck className="h-4 w-4" />}
                disabled={!firstParsedCandidate}
                onClick={() => firstParsedCandidate && handleApplyParsed(firstParsedCandidate)}
              >
                {t('app.generation.cron.use_first')}
              </Button>
              <Button
                type="button"
                variant="outline"
                icon={<FileSearch className="h-4 w-4" />}
                onClick={() => setWorkspace(activeExpression)}
              >
                {t('app.generation.cron.use_current')}
              </Button>
              <Button
                type="button"
                variant="ghost"
                icon={<Trash2 className="h-4 w-4" />}
                onClick={() => setWorkspace('')}
              >
                {t('public.clear')}
              </Button>
            </div>
            <div className="space-y-2">
              {parsedWorkspace.candidates.length > 0 ? (
                parsedWorkspace.candidates.map(candidate => (
                  <ParsedCronRow
                    key={candidate.id}
                    candidate={candidate}
                    sourceLabel={t(`app.generation.cron.source.${candidate.source}`)}
                    useLabel={t('app.generation.cron.use_schedule')}
                    validLabel={
                      candidate.valid
                        ? t('app.generation.cron.parsed.valid')
                        : t('app.generation.cron.parsed.invalid')
                    }
                    onUse={() => handleApplyParsed(candidate)}
                  />
                ))
              ) : (
                <div className="rounded-2xl border border-dashed border-[var(--border-base)] p-5 text-sm leading-6 text-[var(--text-secondary)]">
                  {t('app.generation.cron.workspace_empty')}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ShieldCheck className="h-4 w-4 text-[var(--primary)]" />
              {t('app.generation.cron.audit')}
            </CardTitle>
            <CardDescription>{t('app.generation.cron.audit_hint')}</CardDescription>
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
                {t('app.generation.cron.copy_audit_csv')}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                icon={<Download className="h-4 w-4" />}
                onClick={() =>
                  downloadText(findingsCsv, 'cron-audit.csv', 'text/csv;charset=utf-8')
                }
              >
                {t('app.generation.cron.download_audit_csv')}
              </Button>
            </div>
            <div className="space-y-2">
              {findings.map(finding => (
                <CronFindingRow
                  key={`${finding.key}-${finding.subject}`}
                  finding={finding}
                  label={t(`app.generation.cron.audit.${finding.key}`)}
                  levelLabel={t(`app.generation.cron.level.${finding.level}`)}
                />
              ))}
            </div>
          </CardContent>
        </Card>
      </section>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <Card className="flex min-h-[320px] flex-col">
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle className="text-base">{t('app.generation.cron.expression')}</CardTitle>
              <CardDescription>{t('app.generation.cron.seconds_note')}</CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button icon={<Copy className="h-4 w-4" />} onClick={() => copy(activeExpression)}>
                {t('app.generation.cron.copy_six')}
              </Button>
              <Button
                variant="ghost"
                icon={<Copy className="h-4 w-4" />}
                onClick={() => copy(fiveFieldExpression)}
              >
                {t('app.generation.cron.copy_five')}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input value={activeExpression} readOnly className="font-mono text-center text-lg" />
            <Input value={fiveFieldExpression} readOnly className="font-mono text-center" />
            {preview.error && (
              <p className="rounded-lg border border-[var(--error)] bg-[var(--error-subtle)] px-3 py-2 text-sm text-[var(--error)]">
                {t('app.generation.cron.error', { message: preview.error })}
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="flex min-h-[320px] flex-col">
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between xl:flex-col xl:items-stretch">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <ListChecks className="h-4 w-4 text-[var(--primary)]" />
                {t('app.generation.cron.next')}
              </CardTitle>
              <CardDescription>{t('app.generation.cron.next_hint')}</CardDescription>
            </div>
            <Button
              variant="ghost"
              icon={<Copy className="h-4 w-4" />}
              disabled={!preview.results.length}
              onClick={() => copy(preview.results.join('\n'))}
            >
              {t('app.generation.cron.copy_next')}
            </Button>
          </CardHeader>
          <CardContent className="min-h-0 flex-1 space-y-3 overflow-auto">
            {preview.results.length > 0 ? (
              preview.results.map((time, index) => (
                <div key={`${time}-${index}`} className="glass-input rounded-xl p-3">
                  <code className="text-sm text-[var(--text-primary)]">
                    {index + 1}. {time}
                  </code>
                </div>
              ))
            ) : (
              <div className="flex min-h-[220px] items-center justify-center rounded-xl border border-dashed border-[var(--border-base)] px-4 text-center text-sm text-[var(--text-tertiary)]">
                {t('app.generation.cron.invalid')}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

const CronSelect = ({
  id,
  label,
  onChange,
  options,
  value
}: {
  id: string
  label: string
  onChange: (value: string) => void
  options: Array<{ label: string; value: string }>
  value: string
}) => (
  <div className="space-y-3">
    <Label htmlFor={id}>{label}</Label>
    <Select id={id} value={value} onChange={event => onChange(event.target.value)}>
      {options.map(opt => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </Select>
  </div>
)

const CronMetric = ({ label, value }: { label: string; value: string }) => (
  <div className="glass-input rounded-xl p-3">
    <p className="text-xs text-[var(--text-tertiary)]">{label}</p>
    <p className="mt-1 truncate font-mono text-sm font-semibold text-[var(--text-primary)]">
      {value}
    </p>
  </div>
)

const ParsedCronRow = ({
  candidate,
  onUse,
  sourceLabel,
  useLabel,
  validLabel
}: {
  candidate: ParsedCronCandidate
  onUse: () => void
  sourceLabel: string
  useLabel: string
  validLabel: string
}) => (
  <div className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--glass-input-bg)] p-3">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full border border-[var(--border-subtle)] px-2 py-0.5 text-[11px] font-medium text-[var(--text-secondary)]">
            {sourceLabel}
          </span>
          <span
            className={
              candidate.valid ? 'text-xs text-[var(--success)]' : 'text-xs text-[var(--error)]'
            }
          >
            {validLabel}
          </span>
          <span className="font-mono text-xs text-[var(--text-tertiary)]">#{candidate.line}</span>
        </div>
        <p className="break-all font-mono text-sm font-semibold text-[var(--text-primary)]">
          {candidate.expression}
        </p>
        {candidate.command && (
          <p className="break-all font-mono text-xs text-[var(--text-tertiary)]">
            {candidate.command}
          </p>
        )}
      </div>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        disabled={!candidate.valid}
        icon={<ClipboardCheck className="h-4 w-4" />}
        onClick={onUse}
      >
        {useLabel}
      </Button>
    </div>
  </div>
)

const getFindingColorClass = (level: CronFindingLevel) => {
  if (level === 'danger') return 'border-[var(--error)]/30 text-[var(--error)]'
  if (level === 'warn') return 'border-[var(--warning)]/30 text-[var(--warning)]'

  return 'border-[var(--success)]/30 text-[var(--success)]'
}

const CronFindingRow = ({
  finding,
  label,
  levelLabel
}: {
  finding: CronFinding
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

export default CronClient
