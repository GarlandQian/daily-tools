'use client'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowRightLeft, Copy } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/components/ui/toast'
import { useCopy } from '@/hooks/useCopy'

export default function URLEncodeClient() {
  const { t } = useTranslation()
  const toast = useToast()
  const { copy } = useCopy()

  const [mode, setMode] = useState<'encode' | 'decode'>('encode')
  const [text, setText] = useState('')
  const [result, setResult] = useState<string>()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (!text.trim()) {
      toast.warning(t('rules.msg.required', { msg: t('app.encryption.aes.str') }))
      return
    }

    try {
      if (mode === 'encode') {
        setResult(encodeURIComponent(text))
      } else {
        setResult(decodeURIComponent(text))
      }
    } catch {
      toast.error(t('app.encryption.aes.decrypt_failed'))
      setResult(undefined)
    }
  }

  return (
    <div className="flex flex-col gap-5 size-full">
      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        {/* Encode/Decode toggle */}
        <div className="space-y-3">
          <Label>{t('app.encryption.aes.action')}</Label>
          <RadioGroup
            value={mode}
            onValueChange={val => {
              setMode(val as 'encode' | 'decode')
              setResult(undefined)
            }}
            className="flex gap-4"
          >
            <div className="flex items-center gap-2">
              <RadioGroupItem value="encode" id="url-encode" />
              <Label htmlFor="url-encode" className="flex items-center gap-1 cursor-pointer">
                <ArrowRightLeft className="w-3.5 h-3.5" />
                {t('app.encryption.aes.encrypt')}
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <RadioGroupItem value="decode" id="url-decode" />
              <Label htmlFor="url-decode" className="flex items-center gap-1 cursor-pointer">
                <ArrowRightLeft className="w-3.5 h-3.5" />
                {t('app.encryption.aes.decrypt')}
              </Label>
            </div>
          </RadioGroup>
        </div>

        {/* Input */}
        <div className="space-y-3">
          <Label>{t('app.encryption.aes.str')}</Label>
          <Textarea
            rows={4}
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder={t('rules.msg.required', { msg: t('app.encryption.aes.str') })}
          />
        </div>

        {/* Submit */}
        <Button type="submit" variant="primary" className="w-fit">
          {mode === 'encode' ? t('app.encryption.aes.encrypt') : t('app.encryption.aes.decrypt')}
        </Button>
      </form>

      {/* Result */}
      <AnimatePresence>
        {result && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            transition={{ duration: 0.3 }}
            className="space-y-3"
          >
            <Label>{t('app.hash.result')}</Label>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
              <div className="glass-input flex-1 rounded-lg p-3 font-mono text-sm break-all min-h-[60px]">
                {result}
              </div>
              <Button type="button" variant="ghost" size="icon" onClick={() => copy(result)}>
                <Copy className="w-4 h-4" />
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
