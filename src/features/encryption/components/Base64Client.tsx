'use client'
import { Copy } from 'lucide-react'
import CryptoJS from 'crypto-js'
import { AnimatePresence, motion } from 'framer-motion'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/components/ui/toast'

interface Base64Params {
  text: string
  mode: 'encode' | 'decode'
}

export default function Base64Client() {
  const { t } = useTranslation()
  const toast = useToast()

  const [text, setText] = useState('')
  const [mode, setMode] = useState<'encode' | 'decode'>('encode')
  const [result, setResult] = useState<{ text: string; success?: boolean } | null>(null)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (!text.trim()) {
      toast.warning(t('rules.msg.required', { msg: t('app.encryption.aes.str') }))
      return
    }

    try {
      if (mode === 'encode') {
        const encoded = CryptoJS.enc.Base64.stringify(CryptoJS.enc.Utf8.parse(text))
        setResult({ text: encoded, success: true })
      } else {
        const decoded = CryptoJS.enc.Base64.parse(text).toString(CryptoJS.enc.Utf8)
        if (decoded) {
          setResult({ text: decoded, success: true })
        } else {
          setResult({ text: '', success: true })
        }
      }
    } catch {
      setResult({ text: t('app.encryption.aes.decrypt_failed'), success: false })
      toast.error(t('app.encryption.aes.decrypt_failed'))
    }
  }

  return (
    <div className="flex justify-center">
      <div className="w-full max-w-[700px]">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-[200px_1fr] gap-4 items-start">
            <Label className="sm:pt-3">{t('app.encryption.aes.action')}</Label>
            <RadioGroup value={mode} onValueChange={(v) => setMode(v as 'encode' | 'decode')}>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="encode" id="encode" />
                <Label htmlFor="encode" className="cursor-pointer">
                  {t('app.encryption.aes.encrypt')}
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="decode" id="decode" />
                <Label htmlFor="decode" className="cursor-pointer">
                  {t('app.encryption.aes.decrypt')}
                </Label>
              </div>
            </RadioGroup>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-[200px_1fr] gap-4 items-start">
            <Label className="sm:pt-3">{t('app.encryption.aes.str')}</Label>
            <Textarea
              rows={4}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={t('app.encryption.aes.str')}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-[200px_1fr] gap-4">
            <div />
            <Button type="submit" variant="primary" className="w-full sm:w-auto">
              {mode === 'encode' ? t('app.encryption.aes.encrypt') : t('app.encryption.aes.decrypt')}
            </Button>
          </div>
        </form>

        <AnimatePresence>
          {result && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              transition={{ type: 'spring', stiffness: 260, damping: 20 }}
              className="mt-10"
            >
              <div className="glass-panel rounded-3xl p-8 relative overflow-hidden">
                <div className="glass-specular" />

                <div className="grid grid-cols-1 sm:grid-cols-[200px_1fr] gap-4 items-start">
                  <Label className="sm:pt-3">{t('app.hash.result')}</Label>
                  <div className="flex items-start gap-2">
                    <Textarea
                      rows={4}
                      value={result.text}
                      readOnly
                      className="flex-1"
                    />
                    <Button
                      variant="default"
                      size="icon"
                      onClick={() => {
                        navigator.clipboard.writeText(result.text)
                        toast.success(t('public.copy.success'))
                      }}
                    >
                      <Copy className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
