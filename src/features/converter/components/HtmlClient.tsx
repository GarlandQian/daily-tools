'use client'

import he from 'he'
import { ArrowRightLeft, Code, Copy, Trash2 } from 'lucide-react'
import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Textarea } from '@/components/ui/textarea'
import { useCopy } from '@/hooks/useCopy'

type Mode = 'encode' | 'decode'

const entityLegend = [
  { char: '<', entity: '&lt;' },
  { char: '>', entity: '&gt;' },
  { char: '&', entity: '&amp;' },
  { char: '"', entity: '&quot;' },
  { char: "'", entity: '&#x27;' }
]

const HtmlClient = () => {
  const { t } = useTranslation()
  const { copy } = useCopy()

  const [input, setInput] = useState('')
  const [mode, setMode] = useState<Mode>('encode')
  const [output, setOutput] = useState('')

  const handleConvert = useCallback(() => {
    if (!input) {
      setOutput('')
      return
    }

    try {
      const result =
        mode === 'encode' ? he.encode(input, { useNamedReferences: true }) : he.decode(input)
      setOutput(result)
    } catch (e) {
      console.error(e)
    }
  }, [input, mode])

  const handleSwap = () => {
    setInput(output)
    setOutput('')
    setMode(prev => (prev === 'encode' ? 'decode' : 'encode'))
  }

  const handleClear = () => {
    setInput('')
    setOutput('')
  }

  return (
    <div className="flex flex-col gap-5 size-full">
      {/* Toolbar */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-4">
            <RadioGroup value={mode} onValueChange={v => setMode(v as Mode)} className="flex gap-0">
              <label className="flex items-center gap-2 cursor-pointer select-none px-3 py-1.5 rounded-l-lg border border-[var(--border-base)] data-[state=checked]:bg-[var(--primary)] data-[state=checked]:text-white transition-colors">
                <RadioGroupItem value="encode" className="sr-only" />
                <span
                  className={`text-sm font-medium ${mode === 'encode' ? 'text-[var(--primary)]' : ''}`}
                >
                  {t('app.converter.html.encode')}
                </span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer select-none px-3 py-1.5 rounded-r-lg border border-l-0 border-[var(--border-base)] transition-colors">
                <RadioGroupItem value="decode" className="sr-only" />
                <span
                  className={`text-sm font-medium ${mode === 'decode' ? 'text-[var(--primary)]' : ''}`}
                >
                  {t('app.converter.html.decode')}
                </span>
              </label>
            </RadioGroup>

            <Button icon={<ArrowRightLeft className="w-4 h-4" />} onClick={handleSwap}>
              {t('public.swap')}
            </Button>
            <Button variant="primary" icon={<Code className="w-4 h-4" />} onClick={handleConvert}>
              {t('public.convert')}
            </Button>
            <Button
              icon={<Copy className="w-4 h-4" />}
              onClick={() => copy(output)}
              disabled={!output}
            >
              {t('public.copy')}
            </Button>
            <Button variant="ghost" icon={<Trash2 className="w-4 h-4" />} onClick={handleClear}>
              {t('public.clear')}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Entity legend hints */}
      <div className="flex flex-wrap gap-2 px-1">
        {entityLegend.map(({ char, entity }) => (
          <span
            key={char}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono glass-panel border border-[var(--border-base)]"
          >
            <span className="text-[var(--text-primary)] font-semibold">{char}</span>
            <span className="text-[var(--text-tertiary)]">&rarr;</span>
            <span className="text-[var(--primary)]">{entity}</span>
          </span>
        ))}
      </div>

      {/* Input / Output columns */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-1 min-h-0">
        <Card className="flex flex-col h-full min-h-[300px]">
          <CardHeader>
            <CardTitle className="text-base">{t('app.converter.html.input')}</CardTitle>
          </CardHeader>
          <CardContent className="flex-1 overflow-hidden">
            <Textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder={
                mode === 'encode'
                  ? t('app.converter.html.encode_placeholder')
                  : t('app.converter.html.decode_placeholder')
              }
              className="h-full resize-none font-mono"
            />
          </CardContent>
        </Card>
        <Card className="flex flex-col h-full min-h-[300px]">
          <CardHeader>
            <CardTitle className="text-base">{t('app.converter.html.output')}</CardTitle>
          </CardHeader>
          <CardContent className="flex-1 overflow-hidden">
            <Textarea
              value={output}
              readOnly
              placeholder={t('app.converter.html.result_placeholder')}
              className="h-full resize-none font-mono"
            />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default HtmlClient
