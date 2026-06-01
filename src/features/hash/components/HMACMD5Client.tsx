'use client'
import CryptoJS from 'crypto-js'
import { AnimatePresence, motion } from 'framer-motion'
import { CheckCircle2, Copy, Hash, Key, Search, ShieldCheck, XCircle } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/components/ui/toast'
import { commonPasswords } from '@/const/common-passwords'
import { useCopy } from '@/hooks/useCopy'
import { cn } from '@/lib/utils'

type Mode = 'encrypt' | 'verify'

export default function HMACMD5Client() {
  const { t } = useTranslation()
  const toast = useToast()
  const { copy } = useCopy()

  const [mode, setMode] = useState<Mode>('encrypt')
  const [message, setMessage] = useState('')
  const [key, setKey] = useState('')
  const [targetHash, setTargetHash] = useState('')
  const [result, setResult] = useState<{ text: string; success?: boolean } | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleModeChange = (next: string) => {
    setMode(next as Mode)
    setResult(null)
    setError(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!key.trim()) {
      setError(t('rules.msg.required', { msg: t('app.hash.key') }))
      return
    }

    if (mode === 'encrypt') {
      if (!message.trim()) {
        setError(t('rules.msg.required', { msg: t('app.hash.message') }))
        return
      }
      const hash = CryptoJS.HmacMD5(message, key).toString()
      setResult({ text: hash })
      return
    }

    if (!targetHash.trim()) {
      setError(t('rules.msg.required', { msg: t('app.hash.target') }))
      return
    }

    const target = targetHash.toLowerCase()
    const found = commonPasswords.find(
      pwd => CryptoJS.HmacMD5(pwd, key).toString().toLowerCase() === target
    )

    if (found) {
      setResult({ text: found, success: true })
      toast.success(t('app.hash.verify.success'))
      return
    }

    toast.warning(t('app.hash.verify.fail'))
    setResult({ text: t('app.hash.verify.fail'), success: false })
  }

  return (
    <div className="flex flex-col gap-5 size-full">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Key className="w-5 h-5 text-[var(--primary)]" />
            HMAC-MD5
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <div className="space-y-3">
              <Label>{t('app.hash.mode')}</Label>
              <RadioGroup
                value={mode}
                onValueChange={handleModeChange}
                className="flex flex-wrap gap-6"
              >
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="encrypt" id="hmacmd5-encrypt" />
                  <Label htmlFor="hmacmd5-encrypt" className="cursor-pointer">
                    {t('app.hash.generate')}
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="verify" id="hmacmd5-verify" />
                  <Label htmlFor="hmacmd5-verify" className="cursor-pointer">
                    {t('app.hash.verify')}
                  </Label>
                </div>
              </RadioGroup>
            </div>

            {mode === 'encrypt' && (
              <div className="space-y-3">
                <Label htmlFor="hmacmd5-message">{t('app.hash.message')}</Label>
                <Textarea
                  id="hmacmd5-message"
                  rows={4}
                  value={message}
                  onChange={e => setMessage(e.target.value)}
                  placeholder={t('app.hash.message')}
                />
              </div>
            )}

            <div className="space-y-3">
              <Label htmlFor="hmacmd5-key">{t('app.hash.key')}</Label>
              <Input
                id="hmacmd5-key"
                value={key}
                onChange={e => setKey(e.target.value)}
                placeholder={t('app.hash.key')}
              />
            </div>

            {mode === 'verify' && (
              <div className="space-y-3">
                <Label htmlFor="hmacmd5-target">{t('app.hash.target')}</Label>
                <Input
                  id="hmacmd5-target"
                  value={targetHash}
                  onChange={e => setTargetHash(e.target.value)}
                  placeholder={t('app.hash.target')}
                  className="font-mono"
                />
              </div>
            )}

            {error && <p className="text-sm text-[var(--error)]">{error}</p>}

            <div>
              <Button
                type="submit"
                variant="primary"
                icon={
                  mode === 'encrypt' ? <Hash className="w-4 h-4" /> : <Search className="w-4 h-4" />
                }
              >
                {mode === 'encrypt' ? t('public.generate') : t('public.verify')}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <AnimatePresence>
        {result && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            transition={{ duration: 0.3 }}
          >
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  {result.success === false ? (
                    <XCircle className="w-5 h-5 text-[var(--error)]" />
                  ) : result.success ? (
                    <CheckCircle2 className="w-5 h-5 text-[var(--success)]" />
                  ) : (
                    <ShieldCheck className="w-5 h-5 text-[var(--primary)]" />
                  )}
                  {t('app.hash.result')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
                  <Textarea
                    readOnly
                    value={result.text}
                    rows={Math.min(10, Math.max(2, Math.ceil(result.text.length / 60)))}
                    className={cn(
                      'flex-1 font-mono text-sm',
                      result.success === false && 'text-[var(--error)]'
                    )}
                  />
                  <Button
                    type="button"
                    size="icon"
                    onClick={() => copy(result.text)}
                    aria-label={t('public.copy.success')}
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
