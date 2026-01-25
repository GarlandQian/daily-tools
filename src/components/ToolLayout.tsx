'use client'

import { ClearOutlined, CopyOutlined, ReloadOutlined } from '@ant-design/icons'
import { Button, Card, Flex } from 'antd'
import React from 'react'
import { useTranslation } from 'react-i18next'

interface ToolLayoutProps {
  /** Tool title - uses i18n key */
  title: string
  /** Whether to show copy button */
  showCopy?: boolean
  /** Whether copy button is disabled */
  copyDisabled?: boolean
  /** Copy button click handler */
  onCopy?: () => void
  /** Whether to show clear button */
  showClear?: boolean
  /** Clear button click handler */
  onClear?: () => void
  /** Whether to show reset button */
  showReset?: boolean
  /** Reset button click handler */
  onReset?: () => void
  /** Additional extra content for card header */
  extra?: React.ReactNode
  /** Card body content */
  children: React.ReactNode
}

/**
 * Standardized layout wrapper for tool pages
 */
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
    <Flex gap={8} wrap>
      {extra}
      {showReset && (
        <Button icon={<ReloadOutlined />} onClick={onReset}>
          {t('app.generation.cron.reset')}
        </Button>
      )}
      {showCopy && (
        <Button icon={<CopyOutlined />} onClick={onCopy} disabled={copyDisabled}>
          {t('app.generation.uuid.copy')}
        </Button>
      )}
      {showClear && (
        <Button icon={<ClearOutlined />} onClick={onClear}>
          {t('app.format.json.clear')}
        </Button>
      )}
    </Flex>
  )

  return (
    <Card title={t(title)} extra={extraContent}>
      {children}
    </Card>
  )
}

export default ToolLayout
