'use client'

import { Download } from 'lucide-react'
import { QRCodeCanvas } from 'qrcode.react'
import { useCallback, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ColorPicker } from '@/components/ui/color-picker'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/components/ui/toast'

interface QrcodeFormData {
  content: string
  size: number
  fgColor: string
  bgColor: string
}

const QrcodeClient = () => {
  const { t } = useTranslation()
  const toast = useToast()
  const qrRef = useRef<HTMLDivElement>(null)
  const [formData, setFormData] = useState<QrcodeFormData>({
    content: 'https://github.com',
    size: 256,
    fgColor: '#000000',
    bgColor: '#ffffff'
  })

  const handleDownload = useCallback(() => {
    const canvas = qrRef.current?.querySelector('canvas')
    if (!canvas) {
      toast.error(t('public.generate_failed'))
      return
    }
    const url = canvas.toDataURL('image/png')
    const link = document.createElement('a')
    link.download = 'qrcode.png'
    link.href = url
    link.click()
    toast.success(t('public.success'))
  }, [toast, t])

  return (
    <div className="size-full flex flex-col gap-5">
      <Card>
        <CardHeader>
          <CardTitle>{t('app.generation.qrcode')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-3">
              <Label htmlFor="content">{t('app.generation.qrcode.content')}</Label>
              <Textarea
                id="content"
                rows={3}
                value={formData.content}
                onChange={e => setFormData(prev => ({ ...prev, content: e.target.value }))}
                placeholder={t('app.generation.qrcode.content_placeholder')}
              />
            </div>
            <div className="space-y-4">
              <div className="space-y-3">
                <Label>
                  {t('app.generation.qrcode.size')}: {formData.size}px
                </Label>
                <Slider
                  value={formData.size}
                  min={128}
                  max={512}
                  step={8}
                  onChange={value => setFormData(prev => ({ ...prev, size: value }))}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-3">
                  <Label htmlFor="fgColor">{t('app.generation.qrcode.fgColor')}</Label>
                  <ColorPicker
                    id="fgColor"
                    value={formData.fgColor}
                    onChange={value => setFormData(prev => ({ ...prev, fgColor: value }))}
                  />
                </div>
                <div className="space-y-3">
                  <Label htmlFor="bgColor">{t('app.generation.qrcode.bgColor')}</Label>
                  <ColorPicker
                    id="bgColor"
                    value={formData.bgColor}
                    onChange={value => setFormData(prev => ({ ...prev, bgColor: value }))}
                  />
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="flex-1">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>{t('app.generation.qrcode.preview')}</CardTitle>
          <Button
            variant="primary"
            icon={<Download className="w-4 h-4" />}
            onClick={handleDownload}
          >
            {t('app.generation.qrcode.download')}
          </Button>
        </CardHeader>
        <CardContent>
          <div className="flex justify-center items-center p-6">
            <div ref={qrRef}>
              <QRCodeCanvas
                value={formData.content || ' '}
                size={formData.size}
                fgColor={formData.fgColor}
                bgColor={formData.bgColor}
                level="H"
              />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

export default QrcodeClient
