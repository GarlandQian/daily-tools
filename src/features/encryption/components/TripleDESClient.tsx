'use client'
import { AnimatePresence, motion } from 'framer-motion'
import { Copy, Lock, Unlock } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/components/ui/toast'
import { useCopy } from '@/hooks/useCopy'

import {
  type AesCryptoOptions,
  aesEncodings,
  aesFormats,
  aesModes,
  aesPaddings,
  TripleDesCrypto
} from '../utils'

const TripleDESClient = () => {
  const { t } = useTranslation()
  const toast = useToast()
  const { copy } = useCopy()

  const [result, setResult] = useState<string>()
  const [isEncrypt, setIsEncrypt] = useState(true)
  const [str, setStr] = useState('')
  const [secret, setSecret] = useState('')
  const [mode, setMode] = useState<AesCryptoOptions['mode']>('ECB')
  const [padding, setPadding] = useState<AesCryptoOptions['padding']>('Pkcs7')
  const [format, setFormat] = useState<AesCryptoOptions['format']>('Hex')
  const [encoding, setEncoding] = useState<AesCryptoOptions['encoding']>('Utf8')
  const [iv, setIv] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (!str.trim()) {
      toast.warning(t('app.encryption.aes.content_required'))
      return
    }
    if (!secret.trim()) {
      toast.warning(t('app.encryption.aes.password_required'))
      return
    }

    const options: AesCryptoOptions = { mode, padding, format, encoding, iv }

    if (isEncrypt) {
      try {
        const res = TripleDesCrypto(str, secret, options, true)
        setResult(res)
      } catch (error) {
        if (error instanceof Error) {
          toast.error(t(error.message))
        } else {
          toast.error(t('app.encryption.aes.encrypt_failed'))
        }
      }
    } else {
      try {
        const res = TripleDesCrypto(str, secret, options, false)
        if (!res) {
          throw new Error(t('app.encryption.aes.decrypt_failed_empty'))
        }
        setResult(res)
      } catch {
        toast.warning(t('app.encryption.aes.decrypt_failed'))
        setResult(t('app.encryption.aes.decrypt_failed'))
      }
    }
  }

  return (
    <div className="flex flex-col gap-5 size-full">
      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        {/* Encrypt/Decrypt toggle */}
        <div className="space-y-3">
          <Label>{t('app.encryption.aes.action')}</Label>
          <RadioGroup
            value={isEncrypt ? 'encrypt' : 'decrypt'}
            onValueChange={val => {
              setIsEncrypt(val === 'encrypt')
              setResult(undefined)
            }}
            className="flex gap-4"
          >
            <div className="flex items-center gap-2">
              <RadioGroupItem value="encrypt" id="tripledes-encrypt" />
              <Label htmlFor="tripledes-encrypt" className="flex items-center gap-1 cursor-pointer">
                <Lock className="w-3.5 h-3.5" />
                {t('app.encryption.aes.encrypt')}
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <RadioGroupItem value="decrypt" id="tripledes-decrypt" />
              <Label htmlFor="tripledes-decrypt" className="flex items-center gap-1 cursor-pointer">
                <Unlock className="w-3.5 h-3.5" />
                {t('app.encryption.aes.decrypt')}
              </Label>
            </div>
          </RadioGroup>
        </div>

        {/* Content */}
        <div className="space-y-3">
          <Label>{t('app.encryption.aes.content')}</Label>
          <Textarea
            rows={4}
            value={str}
            onChange={e => setStr(e.target.value)}
            placeholder={t('app.encryption.aes.content_required')}
          />
        </div>

        {/* Password */}
        <div className="space-y-3">
          <Label>{t('app.encryption.aes.password')}</Label>
          <Input
            type="password"
            value={secret}
            onChange={e => setSecret(e.target.value)}
            placeholder={t('app.encryption.aes.password_required')}
          />
        </div>

        {/* Options grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-3">
            <Label>{t('app.encryption.aes.mode')}</Label>
            <Select
              value={mode}
              onChange={e => setMode(e.target.value as AesCryptoOptions['mode'])}
            >
              {aesModes.map(m => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-3">
            <Label>{t('app.encryption.aes.padding')}</Label>
            <Select
              value={padding}
              onChange={e => setPadding(e.target.value as AesCryptoOptions['padding'])}
            >
              {aesPaddings.map(p => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-3">
            <Label>{t('app.encryption.aes.format')}</Label>
            <Select
              value={format}
              onChange={e => setFormat(e.target.value as AesCryptoOptions['format'])}
            >
              {aesFormats.map(f => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-3">
            <Label>{t('app.encryption.aes.encoding')}</Label>
            <Select
              value={encoding}
              onChange={e => setEncoding(e.target.value as AesCryptoOptions['encoding'])}
            >
              {aesEncodings.map(enc => (
                <option key={enc.value} value={enc.value}>
                  {enc.label}
                </option>
              ))}
            </Select>
          </div>
        </div>

        {/* IV */}
        <div className="space-y-3">
          <Label>{t('app.encryption.aes.iv')}</Label>
          <Input
            value={iv}
            onChange={e => setIv(e.target.value)}
            placeholder={t('app.encryption.aes.iv_placeholder')}
          />
        </div>

        {/* Submit */}
        <Button type="submit" variant="primary" className="w-fit">
          {isEncrypt ? t('app.encryption.aes.encrypt') : t('app.encryption.aes.decrypt')}
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

export default TripleDESClient
