'use client'

import { Copy, RotateCcw } from 'lucide-react'
import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { v1, v3, v4, v5 } from 'uuid'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/components/ui/toast'

interface UUIDForm {
  version: 'v1' | 'v3' | 'v4' | 'v5'
  quantity: number
  namespace?: string
  name?: string
}

const UuidClient = () => {
  const { t } = useTranslation()
  const toast = useToast()
  const [result, setResult] = useState<string>('')
  const [version, setVersion] = useState<'v1' | 'v3' | 'v4' | 'v5'>('v4')
  const [quantity, setQuantity] = useState<number>(5)
  const [namespace, setNamespace] = useState<string>(v4())
  const [name, setName] = useState<string>('')

  const generateUUID = () => {
    try {
      const uuids: string[] = []

      for (let i = 0; i < quantity; i++) {
        let uuid = ''
        switch (version) {
          case 'v1':
            uuid = v1()
            break
          case 'v3':
            if (namespace && name) {
              uuid = v3(name, namespace)
            }
            break
          case 'v4':
            uuid = v4()
            break
          case 'v5':
            if (namespace && name) {
              uuid = v5(name, namespace)
            }
            break
        }
        if (uuid) {
          uuids.push(uuid)
        }
      }

      const res = uuids.join('\n')
      setResult(res)

      toast.success(t('public.success'))
    } catch (error) {
      console.error(error)
      toast.error(t('public.generate_failed'))
    }
  }

  const handleCopy = () => {
    if (!result) return
    navigator.clipboard.writeText(result)
    toast.success(t('app.social.retires.copy_success'))
  }

  return (
    <div className="flex flex-col gap-5 h-full">
      <Card>
        <CardHeader>
          <CardTitle>{t('app.generation.uuid')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label>{t('app.generation.uuid.version')}</Label>
              <Select value={version} onChange={(e) => setVersion(e.target.value as any)}>
                <option value="v1">{t('app.generation.uuid.v1')}</option>
                <option value="v3">{t('app.generation.uuid.v3')}</option>
                <option value="v4">{t('app.generation.uuid.v4')}</option>
                <option value="v5">{t('app.generation.uuid.v5')}</option>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t('app.generation.uuid.quantity')}</Label>
              <Input
                type="number"
                min={1}
                max={1000}
                value={quantity}
                onChange={(e) => setQuantity(Number(e.target.value))}
              />
            </div>
            {(version === 'v3' || version === 'v5') && (
              <>
                <div className="space-y-2">
                  <Label>{t('app.generation.uuid.namespace')}</Label>
                  <Input
                    value={namespace}
                    onChange={(e) => setNamespace(e.target.value)}
                    placeholder={t('app.generation.uuid.ns_placeholder')}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t('app.generation.uuid.name')}</Label>
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={t('app.generation.uuid.name_placeholder')}
                  />
                </div>
              </>
            )}
          </div>
          <div className="flex gap-2 mt-4">
            <Button variant="primary" icon={<RotateCcw className="w-4 h-4" />} onClick={generateUUID}>
              {t('public.generate')}
            </Button>
            <Button icon={<Copy className="w-4 h-4" />} onClick={handleCopy} disabled={!result}>
              {t('app.generation.uuid.copy')}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="flex-1 flex flex-col overflow-hidden">
        <CardHeader>
          <CardTitle>{t('app.generation.uuid.result')}</CardTitle>
        </CardHeader>
        <CardContent className="flex-1 overflow-hidden">
          <Textarea
            value={result}
            className="h-full resize-none"
            readOnly
          />
        </CardContent>
      </Card>
    </div>
  )
}

export default UuidClient
