'use client'

import { CheckCircle2, Code2, Copy, Minimize2, Paintbrush, Trash2, XCircle } from 'lucide-react'
import { useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import xmlFormat from 'xml-formatter'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/components/ui/toast'
import { useCopy } from '@/hooks/useCopy'

const XmlClient = () => {
  const { t } = useTranslation()
  const toast = useToast()
  const { copy } = useCopy()

  const [input, setInput] = useState('')
  const [output, setOutput] = useState('')
  const [error, setError] = useState<string | null>(null)

  // Live validity check (only when input present)
  const validity = useMemo<{ valid: boolean; message?: string } | null>(() => {
    if (!input.trim()) return null
    try {
      // Use xmlFormat in a permissive way to detect parse errors
      xmlFormat(input, { indentation: '  ', collapseContent: true, lineSeparator: '\n' })
      return { valid: true }
    } catch (e) {
      return { valid: false, message: (e as Error).message }
    }
  }, [input])

  const handleFormat = useCallback(() => {
    if (!input.trim()) {
      toast.warning(t('app.format.json.empty'))
      return
    }
    try {
      const formatted = xmlFormat(input, {
        indentation: '  ',
        collapseContent: true,
        lineSeparator: '\n'
      })
      setOutput(formatted)
      setError(null)
      toast.success(t('public.success'))
    } catch (e) {
      setError((e as Error).message)
      setOutput('')
    }
  }, [input, toast, t])

  const handleMinify = useCallback(() => {
    if (!input.trim()) {
      toast.warning(t('app.format.json.empty'))
      return
    }
    try {
      const minified = xmlFormat.minify(input, {
        collapseContent: true
      })
      setOutput(minified)
      setError(null)
      toast.success(t('public.success'))
    } catch (e) {
      setError((e as Error).message)
      setOutput('')
    }
  }, [input, toast, t])

  const handleClear = useCallback(() => {
    setInput('')
    setOutput('')
    setError(null)
  }, [])

  return (
    <div className="flex flex-col gap-5 size-full">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle className="flex items-center gap-2">
              <Code2 className="w-5 h-5 text-[var(--primary)]" />
              {t('app.format.xml')}
            </CardTitle>
            <div className="flex flex-wrap gap-2">
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
              <Button
                icon={<Copy className="w-4 h-4" />}
                onClick={() => copy(output)}
                disabled={!output}
              >
                {t('public.copy')}
              </Button>
              <Button icon={<Trash2 className="w-4 h-4" />} onClick={handleClear}>
                {t('public.clear')}
              </Button>
            </div>
          </div>
        </CardHeader>
        {(error || validity) && (
          <CardContent>
            {error && (
              <span className="text-[var(--error)] text-sm flex items-center gap-2">
                <XCircle className="w-4 h-4" />
                {t('app.format.json.error')}: {error}
              </span>
            )}
            {!error && validity?.valid && (
              <span className="text-[var(--success)] text-sm flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4" />
                {t('app.format.xml.valid')}
              </span>
            )}
            {!error && validity && !validity.valid && (
              <span className="text-[var(--warning)] text-sm flex items-center gap-2">
                <XCircle className="w-4 h-4" />
                {validity.message}
              </span>
            )}
          </CardContent>
        )}
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-1 min-h-0">
        <Card className="flex flex-col h-full min-h-[300px]">
          <CardHeader>
            <CardTitle>{t('app.format.json.input')}</CardTitle>
          </CardHeader>
          <CardContent className="flex-1 overflow-hidden">
            <Textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="<root><item>value</item></root>"
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

export default XmlClient
