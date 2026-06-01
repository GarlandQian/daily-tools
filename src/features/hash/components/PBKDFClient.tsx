'use client'
import CryptoJS from 'crypto-js'
import { AnimatePresence, motion } from 'framer-motion'
import { CheckCircle2, Copy, Hash, Search, ShieldCheck, XCircle } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/components/ui/toast'
import { commonPasswords } from '@/const/common-passwords'
import { useCopy } from '@/hooks/useCopy'
import { cn } from '@/lib/utils'

type Mode = 'encrypt' | 'verify'
type KeySize = 128 | 256 | 512

export default function PBKDFClient() {
  const { t } = useTranslation()
  const toast = useToast()
  const { copy } = useCopy()

  const [mode, setMode] = useState<Mode>('encrypt')
  const [message, setMessage] = useState('')
  const [salt, setSalt] = useState('')
  const [keySize, setKeySize] = useState<KeySize>(128)
  const [iterations, setIterations] = useState<number>(1000)
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

    if (!salt.trim()) {
      setError(t('rules.msg.required', { msg: t('app.hash.pbkdf.salt') }))
      return
    }
    if (!iterations || iterations <= 0) {
      setError(t('rules.msg.required', { msg: t('app.hash.pbkdf.iterations') }))
      return
    }

    if (mode === 'encrypt') {
      if (!message.trim()) {
        setError(t('rules.msg.required', { msg: t('app.hash.message') }))
        return
      }
      const hash = CryptoJS.PBKDF2(message, salt, { keySize, iterations }).toString()
      setResult({ text: hash })
      return
    }

    if (!targetHash.trim()) {
      setError(t('rules.msg.required', { msg: t('app.hash.target') }))
      return
    }

    const target = targetHash.toLowerCase()
    const found = commonPasswords.find(
      pwd => CryptoJS.PBKDF2(pwd, salt, { keySize, iterations }).toString().toLowerCase() === target
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
            <ShieldCheck className="w-5 h-5 text-[var(--primary)]" />
            PBKDF2
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
                  <RadioGroupItem value="encrypt" id="pbkdf-encrypt" />
                  <Label htmlFor="pbkdf-encrypt" className="cursor-pointer">
                    {t('app.hash.generate')}
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="verify" id="pbkdf-verify" />
                  <Label htmlFor="pbkdf-verify" className="cursor-pointer">
                    {t('app.hash.verify')}
                  </Label>
                </div>
              </RadioGroup>
            </div>

            {mode === 'encrypt' && (
              <div className="space-y-3">
                <Label htmlFor="pbkdf-message">{t('app.hash.message')}</Label>
                <Textarea
                  id="pbkdf-message"
                  rows={4}
                  value={message}
                  onChange={e => setMessage(e.target.value)}
                  placeholder={t('app.hash.message')}
                />
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-3">
                <Label htmlFor="pbkdf-salt">{t('app.hash.pbkdf.salt')}</Label>
                <Input
                  id="pbkdf-salt"
                  value={salt}
                  onChange={e => setSalt(e.target.value)}
                  placeholder={t('app.hash.pbkdf.salt')}
                />
              </div>

              <div className="space-y-3">
                <Label htmlFor="pbkdf-keysize">{t('app.hash.pbkdf.keySize')}</Label>
                <Select
                  id="pbkdf-keysize"
                  value={String(keySize)}
                  onChange={e => setKeySize(Number(e.target.value) as KeySize)}
                >
                  <option value="128">128 byte</option>
                  <option value="256">256 byte</option>
                  <option value="512">512 byte</option>
                </Select>
              </div>

              <div className="space-y-3">
                <Label htmlFor="pbkdf-iterations">{t('app.hash.pbkdf.iterations')}</Label>
                <Input
                  id="pbkdf-iterations"
                  type="number"
                  min={1}
                  value={iterations}
                  onChange={e => setIterations(Math.max(1, parseInt(e.target.value) || 1))}
                  placeholder={t('app.hash.pbkdf.iterations')}
                />
              </div>
            </div>

            {mode === 'verify' && (
              <div className="space-y-3">
                <Label htmlFor="pbkdf-target">{t('app.hash.target')}</Label>
                <Input
                  id="pbkdf-target"
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
