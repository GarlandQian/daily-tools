'use client'

import { AnimatePresence, motion } from 'framer-motion'
import { Copy, Lock, Unlock } from 'lucide-react'
import { type FormEvent, useState } from 'react'
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
  aesCrypto,
  type AesCryptoOptions,
  aesEncodings,
  aesFormats,
  aesModes,
  aesPaddings
} from '../utils'

const AESClient = () => {
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

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()

    if (!str.trim()) {
      toast.warning(t('app.encryption.aes.content_required'))
      return
    }
    if (!secret.trim()) {
      toast.warning(t('app.encryption.aes.password_required'))
      return
    }

    const values: AesCryptoOptions = { mode, padding, format, encoding, iv }

    try {
      const nextResult = aesCrypto(str, secret, values, isEncrypt)
      if (!isEncrypt && !nextResult) {
        throw new Error(t('app.encryption.aes.decrypt_failed_empty'))
      }
      setResult(nextResult)
    } catch (error) {
      if (isEncrypt) {
        toast.error(
          error instanceof Error ? t(error.message) : t('app.encryption.aes.encrypt_failed')
        )
      } else {
        toast.warning(t('app.encryption.aes.decrypt_failed'))
        setResult(t('app.encryption.aes.decrypt_failed'))
      }
    }
  }

  return (
    <div className="flex size-full flex-col gap-5">
      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <div className="space-y-3">
          <Label>{t('app.encryption.aes.action')}</Label>
          <RadioGroup
            value={isEncrypt ? 'encrypt' : 'decrypt'}
            onValueChange={value => {
              setIsEncrypt(value === 'encrypt')
              setResult(undefined)
            }}
            className="flex flex-wrap gap-4"
          >
            <div className="flex items-center gap-2">
              <RadioGroupItem value="encrypt" id="aes-encrypt" />
              <Label htmlFor="aes-encrypt" className="flex cursor-pointer items-center gap-1">
                <Lock className="h-3.5 w-3.5" />
                {t('app.encryption.aes.encrypt')}
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <RadioGroupItem value="decrypt" id="aes-decrypt" />
              <Label htmlFor="aes-decrypt" className="flex cursor-pointer items-center gap-1">
                <Unlock className="h-3.5 w-3.5" />
                {t('app.encryption.aes.decrypt')}
              </Label>
            </div>
          </RadioGroup>
        </div>

        <div className="space-y-3">
          <Label htmlFor="aes-content">{t('app.encryption.aes.content')}</Label>
          <Textarea
            id="aes-content"
            rows={4}
            value={str}
            onChange={event => setStr(event.target.value)}
            placeholder={t('app.encryption.aes.content_required')}
          />
        </div>

        <div className="space-y-3">
          <Label htmlFor="aes-secret">{t('app.encryption.aes.password')}</Label>
          <Input
            id="aes-secret"
            type="password"
            value={secret}
            onChange={event => setSecret(event.target.value)}
            placeholder={t('app.encryption.aes.password_required')}
          />
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-3">
            <Label htmlFor="aes-mode">{t('app.encryption.aes.mode')}</Label>
            <Select
              id="aes-mode"
              value={mode}
              onChange={event => setMode(event.target.value as AesCryptoOptions['mode'])}
            >
              {aesModes.map(item => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-3">
            <Label htmlFor="aes-padding">{t('app.encryption.aes.padding')}</Label>
            <Select
              id="aes-padding"
              value={padding}
              onChange={event => setPadding(event.target.value as AesCryptoOptions['padding'])}
            >
              {aesPaddings.map(item => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-3">
            <Label htmlFor="aes-format">{t('app.encryption.aes.format')}</Label>
            <Select
              id="aes-format"
              value={format}
              onChange={event => setFormat(event.target.value as AesCryptoOptions['format'])}
            >
              {aesFormats.map(item => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-3">
            <Label htmlFor="aes-encoding">{t('app.encryption.aes.encoding')}</Label>
            <Select
              id="aes-encoding"
              value={encoding}
              onChange={event => setEncoding(event.target.value as AesCryptoOptions['encoding'])}
            >
              {aesEncodings.map(item => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </Select>
          </div>
        </div>

        <div className="space-y-3">
          <Label htmlFor="aes-iv">{t('app.encryption.aes.iv')}</Label>
          <Input
            id="aes-iv"
            value={iv}
            onChange={event => setIv(event.target.value)}
            placeholder={t('app.encryption.aes.iv_placeholder')}
          />
        </div>

        <Button type="submit" variant="primary" className="w-fit">
          {isEncrypt ? t('app.encryption.aes.encrypt') : t('app.encryption.aes.decrypt')}
        </Button>
      </form>

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
              <div className="glass-input min-h-[60px] flex-1 break-all rounded-lg p-3 font-mono text-sm">
                {result}
              </div>
              <Button type="button" variant="ghost" size="icon" onClick={() => copy(result)}>
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default AESClient
