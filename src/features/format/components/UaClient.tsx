'use client'

import { Cpu, Globe, Monitor, Smartphone, Trash2 } from 'lucide-react'
import { useMemo, useState, useSyncExternalStore } from 'react'
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
        title: 'Browser',
        items: [
          { label: 'Name', value: parsed.browser.name || 'Unknown' },
          { label: 'Version', value: parsed.browser.version || '-' }
        ]
      },
      {
        icon: <Cpu className="w-4 h-4" />,
        title: 'Engine',
        items: [
          { label: 'Name', value: parsed.engine.name || 'Unknown' },
          { label: 'Version', value: parsed.engine.version || '-' }
        ]
      },
      {
        icon: <Monitor className="w-4 h-4" />,
        title: 'OS',
        items: [
          { label: 'Name', value: parsed.os.name || 'Unknown' },
          { label: 'Version', value: parsed.os.version || '-' }
        ]
      },
      {
        icon: <Smartphone className="w-4 h-4" />,
        title: 'Device',
        items: [
          { label: 'Vendor', value: parsed.device.vendor || '-' },
          { label: 'Model', value: parsed.device.model || '-' },
          { label: 'Type', value: parsed.device.type || 'desktop' },
          { label: 'CPU Architecture', value: parsed.cpu.architecture || 'Unknown' }
        ]
      }
    ]
  }, [parsed])

  return (
    <div className="flex flex-col gap-5 size-full">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>User Agent String</CardTitle>
            <Button icon={<Trash2 className="w-4 h-4" />} onClick={() => setInputOverride('')}>
              Clear
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Textarea
            value={input}
            onChange={e => setInputOverride(e.target.value)}
            placeholder="Paste a User Agent string here..."
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
