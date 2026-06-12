'use client'

import { AnimatePresence, motion } from 'framer-motion'
import {
  Braces,
  ClipboardList,
  Copy,
  Download,
  Keyboard,
  Pause,
  Play,
  RotateCcw,
  Search,
  TerminalSquare
} from 'lucide-react'
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { useCopy } from '@/hooks/useCopy'

type CaptureEventType = 'keydown' | 'keyup'
type SnippetFormat = 'json' | 'javascript' | 'sequence'

interface KeyInfo {
  altKey: boolean
  code: string
  ctrlKey: boolean
  eventType: CaptureEventType
  isComposing: boolean
  key: string
  keyCode: number
  location: number
  metaKey: boolean
  repeat: boolean
  shiftKey: boolean
  time: number
  which: number
}

const HISTORY_LIMIT = 40
const SEARCH_LIMIT = 120
const shortcutOrder = ['ctrlKey', 'altKey', 'shiftKey', 'metaKey'] as const
const shortcutLabels: Record<(typeof shortcutOrder)[number], string> = {
  altKey: 'Alt',
  ctrlKey: 'Ctrl',
  metaKey: 'Meta',
  shiftKey: 'Shift'
}

const blockedMetaShortcuts = new Set(['r', 'w', 't', 'q'])

const getKeyLabel = (info: KeyInfo) => {
  if (info.key === ' ') return 'Space'
  if (info.key.length === 1) return info.key.toUpperCase()
  return info.key || info.code
}

const getShortcut = (info: KeyInfo) => {
  const modifiers = shortcutOrder
    .filter(modifier => info[modifier])
    .map(modifier => shortcutLabels[modifier])
  const keyLabel = getKeyLabel(info)
  return [...modifiers, keyLabel].join(' + ')
}

const getLocationLabelKey = (location: number) => {
  if (location === 1) return 'app.social.keycode.location.left'
  if (location === 2) return 'app.social.keycode.location.right'
  if (location === 3) return 'app.social.keycode.location.numpad'
  return 'app.social.keycode.location.standard'
}

const buildEventJson = (info: KeyInfo) =>
  JSON.stringify(
    {
      type: info.eventType,
      key: info.key,
      code: info.code,
      keyCode: info.keyCode,
      which: info.which,
      location: info.location,
      repeat: info.repeat,
      isComposing: info.isComposing,
      modifiers: {
        ctrl: info.ctrlKey,
        alt: info.altKey,
        shift: info.shiftKey,
        meta: info.metaKey
      },
      shortcut: getShortcut(info)
    },
    null,
    2
  )

const buildListenerSnippet = (
  info: KeyInfo
) => `window.addEventListener('${info.eventType}', event => {
  if (event.code === '${info.code}'${info.ctrlKey ? ' && event.ctrlKey' : ''}${
    info.altKey ? ' && event.altKey' : ''
  }${info.shiftKey ? ' && event.shiftKey' : ''}${info.metaKey ? ' && event.metaKey' : ''}) {
    event.preventDefault()
    console.log('${getShortcut(info)}')
  }
})`

const downloadText = (content: string, filename: string, type = 'text/plain;charset=utf-8') => {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

const KeyCodeClient = () => {
  const { t } = useTranslation()
  const [keyInfo, setKeyInfo] = useState<KeyInfo | null>(null)
  const [history, setHistory] = useState<KeyInfo[]>([])
  const [captureType, setCaptureType] = useState<CaptureEventType>('keydown')
  const [ignoreRepeats, setIgnoreRepeats] = useState(true)
  const [preventDefault, setPreventDefault] = useState(true)
  const [paused, setPaused] = useState(false)
  const [search, setSearch] = useState('')
  const [snippetFormat, setSnippetFormat] = useState<SnippetFormat>('json')
  const pressAreaRef = useRef<HTMLDivElement>(null)
  const { copy } = useCopy()

  const captureEvent = useCallback(
    (event: KeyboardEvent) => {
      if (paused) return
      if (event.type !== captureType) return
      if (event.metaKey && blockedMetaShortcuts.has(event.key.toLowerCase())) return
      if (ignoreRepeats && event.repeat) return

      if (preventDefault) event.preventDefault()

      const info: KeyInfo = {
        altKey: event.altKey,
        code: event.code,
        ctrlKey: event.ctrlKey,
        eventType: event.type as CaptureEventType,
        isComposing: event.isComposing,
        key: event.key,
        keyCode: event.keyCode,
        location: event.location,
        metaKey: event.metaKey,
        repeat: event.repeat,
        shiftKey: event.shiftKey,
        time: Date.now(),
        which: event.which
      }

      setKeyInfo(info)
      setHistory(previous => [info, ...previous].slice(0, HISTORY_LIMIT))
    },
    [captureType, ignoreRepeats, paused, preventDefault]
  )

  useEffect(() => {
    window.addEventListener('keydown', captureEvent)
    window.addEventListener('keyup', captureEvent)
    return () => {
      window.removeEventListener('keydown', captureEvent)
      window.removeEventListener('keyup', captureEvent)
    }
  }, [captureEvent])

  const filteredHistory = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return history
    return history.filter(item =>
      [item.key, item.code, getShortcut(item), item.eventType, String(item.keyCode)]
        .join(' ')
        .toLowerCase()
        .includes(query)
    )
  }, [history, search])

  const sequence = useMemo(() => history.map(getShortcut).reverse().join(' -> '), [history])
  const currentJson = useMemo(() => (keyInfo ? buildEventJson(keyInfo) : ''), [keyInfo])
  const listenerSnippet = useMemo(() => (keyInfo ? buildListenerSnippet(keyInfo) : ''), [keyInfo])
  const exportJson = useMemo(
    () =>
      JSON.stringify(
        history.map(item => ({
          ...item,
          shortcut: getShortcut(item),
          isoTime: new Date(item.time).toISOString()
        })),
        null,
        2
      ),
    [history]
  )
  const snippetOutput =
    snippetFormat === 'javascript'
      ? listenerSnippet
      : snippetFormat === 'sequence'
        ? sequence
        : currentJson
  const activeModifiers = keyInfo ? shortcutOrder.filter(modifier => keyInfo[modifier]).length : 0

  const reset = () => {
    setKeyInfo(null)
    setHistory([])
    setSearch('')
  }

  return (
    <div className="flex size-full flex-col gap-5">
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-2">
              <CardTitle className="flex items-center gap-2">
                <Keyboard className="h-5 w-5 text-[var(--primary)]" />
                {t('app.social.keycode')}
              </CardTitle>
              <CardDescription>{t('app.social.keycode.description')}</CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant={paused ? 'primary' : 'default'}
                icon={paused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
                onClick={() => setPaused(current => !current)}
              >
                {paused ? t('app.social.keycode.resume') : t('app.social.keycode.pause')}
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                icon={<RotateCcw className="h-4 w-4" />}
                onClick={reset}
              >
                {t('public.clear')}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Metric label={t('app.social.keycode.metric.history')} value={history.length} />
            <Metric
              label={t('app.social.keycode.metric.filtered')}
              value={filteredHistory.length}
            />
            <Metric label={t('app.social.keycode.metric.modifiers')} value={activeModifiers} />
            <Metric
              label={t('app.social.keycode.metric.location')}
              value={keyInfo?.location ?? 0}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
            <div
              ref={pressAreaRef}
              tabIndex={0}
              className="glass-panel glass-clip relative flex min-h-[260px] cursor-pointer flex-col items-center justify-center overflow-hidden rounded-2xl outline-none transition-shadow focus:ring-2 focus:ring-[var(--primary)] focus:ring-offset-2 hover:shadow-lg"
            >
              <div className="glass-specular" />
              <AnimatePresence mode="wait">
                {keyInfo ? (
                  <motion.div
                    key={`${keyInfo.code}-${keyInfo.keyCode}-${keyInfo.time}`}
                    initial={{ opacity: 0, scale: 0.82, y: 10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.94 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                    className="z-10 flex w-full max-w-2xl flex-col items-center gap-5 px-4 text-center"
                  >
                    <span className="break-all font-mono text-5xl font-semibold tabular-nums text-[var(--text-primary)] md:text-6xl">
                      {getKeyLabel(keyInfo)}
                    </span>
                    <span className="rounded-2xl bg-[var(--glass-input-bg)] px-4 py-2 font-mono text-sm font-semibold text-[var(--primary)]">
                      {getShortcut(keyInfo)}
                    </span>
                    <div className="flex flex-wrap items-center justify-center gap-2">
                      {shortcutOrder.map(modifier => (
                        <ModifierChip
                          key={modifier}
                          label={shortcutLabels[modifier]}
                          active={keyInfo[modifier]}
                        />
                      ))}
                    </div>
                  </motion.div>
                ) : (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="z-10 flex flex-col items-center gap-3 px-4 text-center"
                  >
                    <Keyboard className="h-10 w-10 text-[var(--text-tertiary)]" />
                    <span className="text-lg font-medium text-[var(--text-secondary)]">
                      {t('app.social.keycode.press_any_key')}
                    </span>
                    <span className="max-w-md text-sm text-[var(--text-tertiary)]">
                      {t('app.social.keycode.press_hint')}
                    </span>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-1">
                <div className="space-y-2">
                  <Label htmlFor="keycode-event-type">{t('app.social.keycode.event_type')}</Label>
                  <Select
                    id="keycode-event-type"
                    value={captureType}
                    onChange={event => setCaptureType(event.target.value as CaptureEventType)}
                  >
                    <option value="keydown">keydown</option>
                    <option value="keyup">keyup</option>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="keycode-snippet-format">
                    {t('app.social.keycode.snippet_format')}
                  </Label>
                  <Select
                    id="keycode-snippet-format"
                    value={snippetFormat}
                    onChange={event => setSnippetFormat(event.target.value as SnippetFormat)}
                  >
                    <option value="json">{t('app.social.keycode.format.json')}</option>
                    <option value="javascript">{t('app.social.keycode.format.javascript')}</option>
                    <option value="sequence">{t('app.social.keycode.format.sequence')}</option>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <div className="glass-input rounded-xl px-3 py-2">
                  <Checkbox
                    checked={ignoreRepeats}
                    onChange={event => setIgnoreRepeats(event.target.checked)}
                    label={t('app.social.keycode.ignore_repeats')}
                  />
                </div>
                <div className="glass-input rounded-xl px-3 py-2">
                  <Checkbox
                    checked={preventDefault}
                    onChange={event => setPreventDefault(event.target.checked)}
                    label={t('app.social.keycode.prevent_default')}
                  />
                </div>
              </div>

              {keyInfo && (
                <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--glass-input-bg)] p-3">
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <Property label="event.key" value={keyInfo.key} />
                    <Property label="event.code" value={keyInfo.code} />
                    <Property label="event.keyCode" value={String(keyInfo.keyCode)} />
                    <Property label="event.which" value={String(keyInfo.which)} />
                    <Property label="event.repeat" value={String(keyInfo.repeat)} />
                    <Property
                      label="event.location"
                      value={t(getLocationLabelKey(keyInfo.location))}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_440px]">
        <Card className="min-h-[420px]">
          <CardHeader>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-base">
                  <ClipboardList className="h-4 w-4 text-[var(--primary)]" />
                  {t('app.social.keycode.recent_keys')}
                </CardTitle>
                <CardDescription>{t('app.social.keycode.history_hint')}</CardDescription>
              </div>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                icon={<Download className="h-4 w-4" />}
                disabled={!history.length}
                onClick={() =>
                  downloadText(exportJson, 'keycode-history.json', 'application/json;charset=utf-8')
                }
              >
                {t('app.social.keycode.download_history')}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-tertiary)]" />
              <Input
                value={search}
                onChange={event => setSearch(event.target.value.slice(0, SEARCH_LIMIT))}
                placeholder={t('app.social.keycode.search')}
                maxLength={SEARCH_LIMIT}
                className="pl-9"
              />
            </div>

            {filteredHistory.length ? (
              <div className="max-h-[460px] space-y-3 overflow-auto pr-1">
                {filteredHistory.map((item, index) => (
                  <div
                    key={`${item.code}-${item.keyCode}-${item.time}-${index}`}
                    className="group rounded-xl border border-[var(--border-subtle)] bg-[var(--glass-input-bg)] p-3 transition-colors hover:bg-[var(--glass-bg-hover)]"
                  >
                    <div className="flex items-center gap-3">
                      <span className="w-20 shrink-0 truncate font-mono text-base font-semibold text-[var(--text-primary)]">
                        {getKeyLabel(item)}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-mono text-xs text-[var(--primary)]">
                          {getShortcut(item)}
                        </p>
                        <p className="mt-1 truncate text-xs text-[var(--text-tertiary)]">
                          {item.eventType} · {item.code} ·{' '}
                          {new Date(item.time).toLocaleTimeString()}
                        </p>
                      </div>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
                        onClick={() => copy(buildEventJson(item))}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex min-h-48 items-center justify-center rounded-2xl border border-dashed border-[var(--border-subtle)] text-center text-sm text-[var(--text-secondary)]">
                {history.length ? t('app.social.keycode.no_match') : t('app.social.keycode.empty')}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="flex min-h-[420px] flex-col">
          <CardHeader>
            <div className="flex items-start justify-between gap-3">
              <div>
                <CardTitle className="flex items-center gap-2 text-base">
                  {snippetFormat === 'javascript' ? (
                    <TerminalSquare className="h-4 w-4 text-[var(--primary)]" />
                  ) : (
                    <Braces className="h-4 w-4 text-[var(--primary)]" />
                  )}
                  {t('app.social.keycode.output')}
                </CardTitle>
                <CardDescription>{t('app.social.keycode.output_hint')}</CardDescription>
              </div>
              <Button
                type="button"
                size="sm"
                icon={<Copy className="h-4 w-4" />}
                disabled={!snippetOutput}
                onClick={() => copy(snippetOutput)}
              >
                {t('public.copy')}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="flex min-h-0 flex-1 flex-col gap-4">
            <Textarea
              readOnly
              rows={16}
              value={snippetOutput}
              placeholder={t('app.social.keycode.output_empty')}
              className="min-h-[320px] flex-1 resize-none font-mono text-sm"
            />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

const Metric = ({ label, value }: { label: string; value: number }) => (
  <div className="glass-panel glass-clip rounded-2xl p-4">
    <div className="text-xs font-medium text-[var(--text-secondary)]">{label}</div>
    <div className="mt-2 font-mono text-xl font-semibold text-[var(--text-primary)]">{value}</div>
  </div>
)

const ModifierChip = ({ active, label }: { active: boolean; label: string }) => (
  <span
    className={`inline-flex items-center rounded-xl px-3 py-1 font-mono text-xs font-semibold transition-colors ${
      active
        ? 'bg-[var(--primary)] text-white shadow-sm'
        : 'bg-[var(--glass-input-bg)] text-[var(--text-tertiary)]'
    }`}
  >
    {label}
  </span>
)

const Property = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <div className="min-w-0">
    <p className="truncate text-[var(--text-tertiary)]">{label}</p>
    <p className="mt-1 truncate font-mono font-semibold text-[var(--text-primary)]">{value}</p>
  </div>
)

export default KeyCodeClient
