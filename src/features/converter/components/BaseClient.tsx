'use client'

import { ClearOutlined, SwapOutlined } from '@ant-design/icons'
import { Button, Card, Col, Flex, Input, Row, Typography } from 'antd'
import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useCopy } from '@/hooks/useCopy'

interface BaseValues {
  binary: string
  octal: string
  decimal: string
  hex: string
}

const BaseClient = () => {
  const { t } = useTranslation()
  const { copy } = useCopy()

  const [values, setValues] = useState<BaseValues>({
    binary: '',
    octal: '',
    decimal: '',
    hex: ''
  })
  const [error, setError] = useState<string | null>(null)

  const updateAllBases = useCallback(
    (value: string, fromBase: number) => {
      if (!value.trim()) {
        setValues({ binary: '', octal: '', decimal: '', hex: '' })
        setError(null)
        return
      }

      try {
        // Parse the input value
        const decimal = parseInt(value, fromBase)
        if (isNaN(decimal) || decimal < 0) {
          setError(t('app.converter.base.invalid'))
          return
        }

        setValues({
          binary: decimal.toString(2),
          octal: decimal.toString(8),
          decimal: decimal.toString(10),
          hex: decimal.toString(16).toUpperCase()
        })
        setError(null)
      } catch {
        setError(t('app.converter.base.invalid'))
      }
    },
    [t]
  )

  const handleBinaryChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value.replace(/[^01]/g, '')
      setValues(prev => ({ ...prev, binary: value }))
      updateAllBases(value, 2)
    },
    [updateAllBases]
  )

  const handleOctalChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value.replace(/[^0-7]/g, '')
      setValues(prev => ({ ...prev, octal: value }))
      updateAllBases(value, 8)
    },
    [updateAllBases]
  )

  const handleDecimalChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value.replace(/[^0-9]/g, '')
      setValues(prev => ({ ...prev, decimal: value }))
      updateAllBases(value, 10)
    },
    [updateAllBases]
  )

  const handleHexChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value.replace(/[^0-9A-Fa-f]/g, '').toUpperCase()
      setValues(prev => ({ ...prev, hex: value }))
      updateAllBases(value, 16)
    },
    [updateAllBases]
  )

  const handleClear = useCallback(() => {
    setValues({ binary: '', octal: '', decimal: '', hex: '' })
    setError(null)
  }, [])

  const baseInputs = [
    {
      label: t('app.converter.base.binary'),
      prefix: '0b',
      value: values.binary,
      onChange: handleBinaryChange,
      placeholder: '1010'
    },
    {
      label: t('app.converter.base.octal'),
      prefix: '0o',
      value: values.octal,
      onChange: handleOctalChange,
      placeholder: '12'
    },
    {
      label: t('app.converter.base.decimal'),
      prefix: '',
      value: values.decimal,
      onChange: handleDecimalChange,
      placeholder: '10'
    },
    {
      label: t('app.converter.base.hex'),
      prefix: '0x',
      value: values.hex,
      onChange: handleHexChange,
      placeholder: 'A'
    }
  ]

  return (
    <Flex className="size-full" gap={20} vertical>
      <Card
        title={t('app.converter.base')}
        extra={
          <Button icon={<ClearOutlined />} onClick={handleClear}>
            {t('app.format.json.clear')}
          </Button>
        }
      >
        <Typography.Text type="secondary">{t('app.converter.base.hint')}</Typography.Text>
        {error && (
          <Typography.Text type="danger" style={{ display: 'block', marginTop: 8 }}>
            {error}
          </Typography.Text>
        )}
      </Card>

      <Row gutter={[16, 16]}>
        {baseInputs.map(item => (
          <Col xs={24} sm={12} key={item.label}>
            <Card title={item.label} size="small">
              <Flex gap={8}>
                <Input
                  prefix={item.prefix || <SwapOutlined />}
                  value={item.value}
                  onChange={item.onChange}
                  placeholder={item.placeholder}
                  style={{ fontFamily: 'monospace', flex: 1 }}
                  size="large"
                />
                <Button onClick={() => copy(item.value)} disabled={!item.value}>
                  {t('app.generation.uuid.copy')}
                </Button>
              </Flex>
            </Card>
          </Col>
        ))}
      </Row>
    </Flex>
  )
}

export default BaseClient
