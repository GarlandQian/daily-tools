'use client'

import { Cpu, Globe, Monitor, Smartphone, Trash2 } from 'lucide-react'
import { useMemo, useState, useSyncExternalStore } from 'react'
import { useTranslation } from 'react-i18next'
import { UAParser } from 'ua-parser-js'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'

interface Section {
  icon: React.ReactNode
  title: string
  items: { label: string; value: string }[]
}

const subscribeToUserAgent = () => () => {}
const getClientUserAgent = () => navigator.userAgent
const getServerUserAgent = () => ''

const UaClient = () => {
  const { t } = useTranslation()
  const userAgent = useSyncExternalStore(
    subscribeToUserAgent,
    getClientUserAgent,
    getServerUserAgent
  )
  const [inputOverride, setInputOverride] = useState<string | null>(null)
  const input = inputOverride ?? userAgent

  const parsed = useMemo(() => {
    if (!input.trim()) return null
    const parser = new UAParser(input)
    return parser.getResult()
  }, [input])

  const sections = useMemo<Section[]>(() => {
    if (!parsed) return []
    return [
      {
        icon: <Globe className="w-4 h-4" />,
        title: t('app.format.ua.browser'),
        items: [
          { label: t('app.format.ua.name'), value: parsed.browser.name || t('public.unknown') },
          { label: t('app.format.ua.version'), value: parsed.browser.version || '-' }
        ]
      },
      {
        icon: <Cpu className="w-4 h-4" />,
        title: t('app.format.ua.engine'),
        items: [
          { label: t('app.format.ua.name'), value: parsed.engine.name || t('public.unknown') },
          { label: t('app.format.ua.version'), value: parsed.engine.version || '-' }
        ]
      },
      {
        icon: <Monitor className="w-4 h-4" />,
        title: t('app.format.ua.os'),
        items: [
          { label: t('app.format.ua.name'), value: parsed.os.name || t('public.unknown') },
          { label: t('app.format.ua.version'), value: parsed.os.version || '-' }
        ]
      },
      {
        icon: <Smartphone className="w-4 h-4" />,
        title: t('app.format.ua.device'),
        items: [
          { label: t('app.format.ua.vendor'), value: parsed.device.vendor || '-' },
          { label: t('app.format.ua.model'), value: parsed.device.model || '-' },
          {
            label: t('app.format.ua.type'),
            value: parsed.device.type || t('app.format.ua.desktop')
          },
          {
            label: t('app.format.ua.cpu_arch'),
            value: parsed.cpu.architecture || t('public.unknown')
          }
        ]
      }
    ]
  }, [parsed, t])

  return (
    <div className="flex flex-col gap-5 size-full">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>{t('app.format.ua.string')}</CardTitle>
            <Button icon={<Trash2 className="w-4 h-4" />} onClick={() => setInputOverride('')}>
              {t('public.clear')}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Textarea
            value={input}
            onChange={e => setInputOverride(e.target.value)}
            placeholder={t('app.format.ua.placeholder')}
            rows={3}
            className="font-mono"
          />
        </CardContent>
      </Card>

      {sections.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {sections.map(section => (
            <Card key={section.title}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-[var(--primary-subtle)] text-[var(--primary)]">
                    {section.icon}
                  </span>
                  {section.title}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
                  {section.items.map(item => (
                    <div key={item.label} className="contents">
                      <dt className="text-[var(--text-secondary)]">{item.label}</dt>
                      <dd
                        className="font-mono text-[var(--text-primary)] truncate"
                        title={item.value}
                      >
                        {item.value}
                      </dd>
                    </div>
                  ))}
                </dl>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

export default UaClient
