'use client'

import { Copy, RotateCcw } from 'lucide-react'
import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import { useToast } from '@/components/ui/toast'

interface PasswordFormData {
  length: number
  count: number
  uppercase: boolean
  lowercase: boolean
  numbers: boolean
  symbols: boolean
}

const CHAR_SETS = {
  uppercase: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  lowercase: 'abcdefghijklmnopqrstuvwxyz',
  numbers: '0123456789',
  symbols: '!@#$%^&*()_+-=[]{}|;:,.<>?'
}

const generatePassword = (length: number, charset: string): string => {
  let password = ''
  const array = new Uint32Array(length)
  crypto.getRandomValues(array)
  for (let i = 0; i < length; i++) {
    password += charset[array[i] % charset.length]
  }
  return password
}

const PasswordClient = () => {
  const { t } = useTranslation()
  const toast = useToast()
  const [passwords, setPasswords] = useState<string[]>([])
  const [formData, setFormData] = useState<PasswordFormData>({
    length: 16,
    count: 5,
    uppercase: true,
    lowercase: true,
    numbers: true,
    symbols: true
  })

  const handleGenerate = useCallback(() => {
    const { length, count, uppercase, lowercase, numbers, symbols } = formData

    let charset = ''
    if (uppercase) charset += CHAR_SETS.uppercase
    if (lowercase) charset += CHAR_SETS.lowercase
    if (numbers) charset += CHAR_SETS.numbers
    if (symbols) charset += CHAR_SETS.symbols

    if (!charset) {
      toast.warning(t('app.generation.password.no_charset'))
      return
    }

    const newPasswords: string[] = []
    for (let i = 0; i < count; i++) {
      newPasswords.push(generatePassword(length, charset))
    }
    setPasswords(newPasswords)
    toast.success(t('public.success'))
  }, [formData, toast, t])

  const handleCopyAll = useCallback(() => {
    if (!passwords.length) return
    navigator.clipboard.writeText(passwords.join('\n'))
    toast.success(t('app.social.retires.copy_success'))
  }, [passwords, toast, t])

  const handleCopySingle = useCallback(
    (pwd: string) => {
      navigator.clipboard.writeText(pwd)
      toast.success(t('app.social.retires.copy_success'))
    },
    [toast, t]
  )

  return (
    <div className="size-full flex flex-col gap-5">
      <Card>
        <CardHeader>
          <CardTitle>{t('app.generation.password')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{t('app.generation.password.length')}: {formData.length}</Label>
              <Slider
                value={formData.length}
                min={8}
                max={128}
                onChange={(value) => setFormData(prev => ({ ...prev, length: value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="count">{t('app.generation.password.count')}</Label>
              <Input
                id="count"
                type="number"
                min={1}
                max={100}
                value={formData.count}
                onChange={(e) => setFormData(prev => ({ ...prev, count: Number(e.target.value) }))}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>{t('app.generation.password.charset')}</Label>
            <div className="flex flex-wrap gap-4">
              <Checkbox
                checked={formData.uppercase}
                onChange={(e) => setFormData(prev => ({ ...prev, uppercase: e.target.checked }))}
                label={t('app.generation.password.uppercase')}
              />
              <Checkbox
                checked={formData.lowercase}
                onChange={(e) => setFormData(prev => ({ ...prev, lowercase: e.target.checked }))}
                label={t('app.generation.password.lowercase')}
              />
              <Checkbox
                checked={formData.numbers}
                onChange={(e) => setFormData(prev => ({ ...prev, numbers: e.target.checked }))}
                label={t('app.generation.password.numbers')}
              />
              <Checkbox
                checked={formData.symbols}
                onChange={(e) => setFormData(prev => ({ ...prev, symbols: e.target.checked }))}
                label={t('app.generation.password.symbols')}
              />
            </div>
          </div>

          <div className="flex gap-2">
            <Button variant="primary" icon={<RotateCcw className="w-4 h-4" />} onClick={handleGenerate}>
              {t('public.generate')}
            </Button>
            <Button icon={<Copy className="w-4 h-4" />} onClick={handleCopyAll} disabled={!passwords.length}>
              {t('app.generation.uuid.copy')}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="flex-1 overflow-hidden flex flex-col">
        <CardHeader>
          <CardTitle>{t('app.generation.password.result')}</CardTitle>
        </CardHeader>
        <CardContent className="flex-1 overflow-auto">
          <div className="flex flex-col gap-2">
            {passwords.map((pwd, index) => (
              <div key={index} className="flex items-center gap-3">
                <code className="flex-1 font-mono text-sm break-all text-[var(--text-primary)]">
                  {pwd}
                </code>
                <Button
                  variant="ghost"
                  size="sm"
                  icon={<Copy className="w-4 h-4" />}
                  onClick={() => handleCopySingle(pwd)}
                />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default PasswordClient
