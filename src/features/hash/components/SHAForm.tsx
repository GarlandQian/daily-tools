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

import { type HashLookupAlgorithm, lookupHash } from '../utils/lookup'

type Action = 'encrypt' | 'verify'
type Algorithm = 'SHA1' | 'SHA224' | 'SHA256' | 'SHA3' | 'SHA384' | 'SHA512'

const ALGORITHMS: Algorithm[] = ['SHA1', 'SHA224', 'SHA256', 'SHA3', 'SHA384', 'SHA512']

const LOOKUP_ALGORITHM_MAP: Record<Algorithm, HashLookupAlgorithm> = {
  SHA1: 'sha1',
  SHA224: 'sha224',
  SHA256: 'sha256',
  SHA3: 'sha3_512',
  SHA384: 'sha384',
  SHA512: 'sha512'
}

function calculateHash(algorithm: Algorithm, msg: string): string {
  switch (algorithm) {
    case 'SHA1':
      return CryptoJS.SHA1(msg).toString()
    case 'SHA224':
      return CryptoJS.SHA224(msg).toString()
    case 'SHA256':
      return CryptoJS.SHA256(msg).toString()
    case 'SHA3':
      return CryptoJS.SHA3(msg).toString()
    case 'SHA384':
      return CryptoJS.SHA384(msg).toString()
    case 'SHA512':
      return CryptoJS.SHA512(msg).toString()
  }
}

export default function SHAForm() {
  const { t } = useTranslation()
  const toast = useToast()
  const { copy } = useCopy()

  const [action, setAction] = useState<Action>('encrypt')
  const [algorithm, setAlgorithm] = useState<Algorithm>('SHA1')
  const [message, setMessage] = useState('')
  const [targetHash, setTargetHash] = useState('')
  const [result, setResult] = useState<{ text: string; success?: boolean } | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleActionChange = (next: string) => {
    setAction(next as Action)
    setResult(null)
    setError(null)
  }

  const handleAlgorithmChange = (next: Algorithm) => {
    setAlgorithm(next)
    setResult(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (action === 'encrypt') {
      if (!message.trim()) {
        setError(t('rules.msg.required', { msg: t('app.hash.message') }))
        return
      }
      const hash = calculateHash(algorithm, message)
      setResult({ text: hash })
      return
    }

    if (!targetHash.trim()) {
      setError(t('rules.msg.required', { msg: t('app.hash.target') }))
      return
    }

    const target = targetHash.toLowerCase()
    const found = commonPasswords.find(
      pwd => calculateHash(algorithm, pwd).toLowerCase() === target
    )

    if (found) {
      setResult({ text: found, success: true })
      toast.success(t('app.hash.verify.success'))
      return
    }

    const apiResult = await lookupHash(LOOKUP_ALGORITHM_MAP[algorithm], target)
    if (apiResult) {
      setResult({ text: apiResult, success: true })
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
            <Hash className="w-5 h-5 text-[var(--primary)]" />
            SHA
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="space-y-2">
                <Label>{t('app.hash.mode')}</Label>
                <RadioGroup
                  value={action}
                  onValueChange={handleActionChange}
                  className="flex flex-wrap gap-6"
                >
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="encrypt" id="sha-encrypt" />
                    <Label htmlFor="sha-encrypt" className="cursor-pointer">
                      {t('app.hash.generate')}
                    </Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="verify" id="sha-verify" />
                    <Label htmlFor="sha-verify" className="cursor-pointer">
                      {t('app.hash.verify')}
                    </Label>
                  </div>
                </RadioGroup>
              </div>

              <div className="space-y-2">
                <Label htmlFor="sha-alg">{t('app.hash.alg')}</Label>
                <Select
                  id="sha-alg"
                  value={algorithm}
                  onChange={e => handleAlgorithmChange(e.target.value as Algorithm)}
                >
                  {ALGORITHMS.map(alg => (
                    <option key={alg} value={alg}>
                      {alg}
                    </option>
                  ))}
                </Select>
              </div>
            </div>

            {action === 'encrypt' && (
              <div className="space-y-2">
                <Label htmlFor="sha-message">{t('app.hash.message')}</Label>
                <Textarea
                  id="sha-message"
                  rows={4}
                  value={message}
                  onChange={e => setMessage(e.target.value)}
                  placeholder={t('app.hash.message')}
                />
              </div>
            )}

            {action === 'verify' && (
              <div className="space-y-2">
                <Label htmlFor="sha-target">{t('app.hash.target')}</Label>
                <Input
                  id="sha-target"
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
                  action === 'encrypt' ? (
                    <Hash className="w-4 h-4" />
                  ) : (
                    <Search className="w-4 h-4" />
                  )
                }
              >
                {action === 'encrypt' ? t('public.generate') : t('public.verify')}
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
                <div className="flex items-start gap-2">
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
