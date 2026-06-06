'use client'

import { Copy, Eraser, Paintbrush } from 'lucide-react'
import dynamic from 'next/dynamic'
import { useDeferredValue, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { useCopy } from '@/hooks/useCopy'

const MarkdownRenderer = dynamic(() => import('./MarkdownRenderer'), {
  ssr: false,
  loading: () => <div className="h-28 rounded-lg bg-[var(--glass-input-bg)]" aria-hidden="true" />
})

const MarkdownClient = () => {
  const { t } = useTranslation()
  const { copy } = useCopy()
  const defaultMarkdown = t('app.preview.markdown.sample')
  const [input, setInput] = useState(defaultMarkdown)
  const deferredInput = useDeferredValue(input)

  useEffect(() => {
    setInput(defaultMarkdown)
  }, [defaultMarkdown])

  return (
    <div className="flex flex-col gap-5 size-full">
      <Card>
        <CardHeader>
          <CardTitle>{t('app.preview.markdown')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            <Button
              icon={<Paintbrush className="w-4 h-4" />}
              onClick={() => setInput(defaultMarkdown)}
            >
              {t('app.format.json.format')}
            </Button>
            <Button
              icon={<Copy className="w-4 h-4" />}
              onClick={() => copy(input)}
              disabled={!input}
            >
              {t('public.copy')}
            </Button>
            <Button icon={<Eraser className="w-4 h-4" />} onClick={() => setInput('')}>
              {t('public.clear')}
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-1 min-h-0">
        <Card className="flex flex-col h-full min-h-[400px]">
          <CardHeader>
            <CardTitle>{t('app.preview.markdown.editor')}</CardTitle>
          </CardHeader>
          <CardContent className="flex-1 overflow-hidden">
            <Textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              className="h-full resize-none font-mono text-sm"
              placeholder={t('app.preview.markdown.placeholder')}
            />
          </CardContent>
        </Card>
        <Card className="flex flex-col h-full min-h-[400px]">
          <CardHeader>
            <CardTitle>{t('app.preview.markdown.preview')}</CardTitle>
          </CardHeader>
          <CardContent className="flex-1 overflow-auto">
            <div className="markdown-preview text-[var(--text-primary)] text-sm leading-relaxed [&_h1]:text-2xl [&_h1]:font-bold [&_h1]:mb-4 [&_h1]:mt-2 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:mb-3 [&_h2]:mt-4 [&_h3]:text-lg [&_h3]:font-semibold [&_h3]:mb-2 [&_h3]:mt-3 [&_p]:mb-3 [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:mb-3 [&_ol]:list-decimal [&_ol]:pl-6 [&_ol]:mb-3 [&_li]:mb-1 [&_a]:text-[var(--primary)] [&_a]:underline [&_code]:bg-[var(--bg-muted)] [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-xs [&_code]:font-mono [&_pre]:bg-[var(--bg-muted)] [&_pre]:p-4 [&_pre]:rounded-lg [&_pre]:mb-3 [&_pre]:overflow-x-auto [&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_blockquote]:border-l-4 [&_blockquote]:border-[var(--primary)] [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:text-[var(--text-secondary)] [&_table]:w-full [&_table]:border-collapse [&_table]:mb-3 [&_th]:border [&_th]:border-[var(--border-base)] [&_th]:px-3 [&_th]:py-2 [&_th]:text-left [&_th]:bg-[var(--bg-muted)] [&_td]:border [&_td]:border-[var(--border-base)] [&_td]:px-3 [&_td]:py-2 [&_strong]:font-bold [&_em]:italic [&_hr]:border-[var(--border-base)] [&_hr]:my-4">
              <MarkdownRenderer content={deferredInput} />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default MarkdownClient
