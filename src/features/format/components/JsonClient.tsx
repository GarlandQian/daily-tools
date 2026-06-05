'use client'

import { Copy, Minimize2, Paintbrush, Trash2 } from 'lucide-react'
import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/components/ui/toast'

const JsonClient = () => {
  const { t } = useTranslation()
  const toast = useToast()
  const [input, setInput] = useState('')
  const [output, setOutput] = useState('')
  const [error, setError] = useState<string | null>(null)

  const parseJson = useCallback((text: string): unknown | null => {
    try {
      setError(null)
      return JSON.parse(text)
    } catch (e) {
      const err = e as SyntaxError
      setError(err.message)
      return null
    }
  }, [])

  const handleFormat = useCallback(() => {
    if (!input.trim()) {
      toast.warning(t('app.format.json.empty'))
      return
    }
    const parsed = parseJson(input)
    if (parsed !== null) {
      setOutput(JSON.stringify(parsed, null, 2))
      toast.success(t('public.success'))
    }
  }, [input, parseJson, toast, t])

  const handleMinify = useCallback(() => {
    if (!input.trim()) {
      toast.warning(t('app.format.json.empty'))
      return
    }
    const parsed = parseJson(input)
    if (parsed !== null) {
      setOutput(JSON.stringify(parsed))
      toast.success(t('public.success'))
    }
  }, [input, parseJson, toast, t])

  const handleValidate = useCallback(() => {
    if (!input.trim()) {
      toast.warning(t('app.format.json.empty'))
      return
    }
    const parsed = parseJson(input)
    if (parsed !== null) {
      setError(null)
      toast.success(t('app.format.json.valid'))
    }
  }, [input, parseJson, toast, t])

  const handleCopy = useCallback(() => {
    if (!output) return
    navigator.clipboard.writeText(output)
    toast.success(t('public.copy.success'))
  }, [output, toast, t])

  const handleClear = useCallback(() => {
    setInput('')
    setOutput('')
    setError(null)
  }, [])

  return (
    <div className="flex flex-col gap-5 size-full">
      <Card>
        <CardHeader>
          <CardTitle>{t('app.format.json')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            <Button
              variant="primary"
              icon={<Paintbrush className="w-4 h-4" />}
              onClick={handleFormat}
            >
              {t('app.format.json.format')}
            </Button>
            <Button icon={<Minimize2 className="w-4 h-4" />} onClick={handleMinify}>
              {t('app.format.json.minify')}
            </Button>
            <Button onClick={handleValidate}>{t('app.format.json.validate')}</Button>
            <Button icon={<Copy className="w-4 h-4" />} onClick={handleCopy} disabled={!output}>
              {t('public.copy')}
            </Button>
            <Button icon={<Trash2 className="w-4 h-4" />} onClick={handleClear}>
              {t('app.format.json.clear')}
            </Button>
          </div>
        </CardContent>
      </Card>

      {error && (
        <span className="text-[var(--error)] px-2 text-sm">
          {t('app.format.json.error')}: {error}
        </span>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-1 min-h-0">
        <Card className="flex flex-col h-full min-h-[300px]">
          <CardHeader>
            <CardTitle>{t('app.format.json.input')}</CardTitle>
          </CardHeader>
          <CardContent className="flex-1 overflow-hidden">
            <Textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder={t('app.format.json.input_placeholder')}
              className="h-full resize-none font-mono"
            />
          </CardContent>
        </Card>
        <Card className="flex flex-col h-full min-h-[300px]">
          <CardHeader>
            <CardTitle>{t('app.format.json.output')}</CardTitle>
          </CardHeader>
          <CardContent className="flex-1 overflow-hidden">
            <Textarea value={output} readOnly className="h-full resize-none font-mono" />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default JsonClient
