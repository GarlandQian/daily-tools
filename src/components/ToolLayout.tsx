'use client'

import { Copy, RotateCcw, Trash2 } from 'lucide-react'
import React from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface ToolLayoutProps {
  title: string
  showCopy?: boolean
  copyDisabled?: boolean
  onCopy?: () => void
  showClear?: boolean
  onClear?: () => void
  showReset?: boolean
  onReset?: () => void
  extra?: React.ReactNode
  children: React.ReactNode
}

const ToolLayout: React.FC<ToolLayoutProps> = ({
  title,
  showCopy,
  copyDisabled,
  onCopy,
  showClear,
  onClear,
  showReset,
  onReset,
  extra,
  children
}) => {
  const { t } = useTranslation()

  const extraContent = (
    <div className="flex gap-2 flex-wrap">
      {extra}
      {showReset && (
        <Button
          variant="ghost"
          size="sm"
          icon={<RotateCcw className="w-4 h-4" />}
          onClick={onReset}
        >
          {t('public.reset')}
        </Button>
      )}
      {showCopy && (
        <Button
          variant="ghost"
          size="sm"
          icon={<Copy className="w-4 h-4" />}
          onClick={onCopy}
          disabled={copyDisabled}
        >
          {t('public.copy')}
        </Button>
      )}
      {showClear && (
        <Button variant="ghost" size="sm" icon={<Trash2 className="w-4 h-4" />} onClick={onClear}>
          {t('public.clear')}
        </Button>
      )}
    </div>
  )

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>{t(title)}</CardTitle>
          {extraContent}
        </div>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  )
}

export default ToolLayout
