'use client'

import { CopyOutlined, ReloadOutlined } from '@ant-design/icons'
import {
  App,
  Button,
  Card,
  Checkbox,
  Col,
  ColorPicker,
  Flex,
  Input,
  Row,
  Slider,
  theme as antTheme,
  Typography
} from 'antd'
import { useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

interface ShadowConfig {
  offsetX: number
  offsetY: number
  blur: number
  spread: number
  color: string
  opacity: number
  inset: boolean
}

// Move sliderConfigs outside component to prevent recreation on each render
const sliderConfigs = [
  { key: 'offsetX' as const, label: 'X Offset', min: -100, max: 100, suffix: 'px' },
  { key: 'offsetY' as const, label: 'Y Offset', min: -100, max: 100, suffix: 'px' },
  { key: 'blur' as const, label: 'Blur', min: 0, max: 100, suffix: 'px' },
  { key: 'spread' as const, label: 'Spread', min: -50, max: 50, suffix: 'px' },
  { key: 'opacity' as const, label: 'Opacity', min: 0, max: 100, suffix: '%' }
]

const ShadowClient = () => {
  const { t } = useTranslation()
  const { message } = App.useApp()
  const { token: theme } = antTheme.useToken()

  // Detect dark mode from theme
  const isDarkMode = theme.colorBgContainer !== '#ffffff'

  // Default config adapts to current theme
  const getDefaultConfig = useCallback(
    (): ShadowConfig => ({
      offsetX: 5,
      offsetY: 5,
      blur: 15,
      spread: 0,
      color: isDarkMode ? '#ffffff' : '#000000',
      opacity: isDarkMode ? 20 : 30,
      inset: false
    }),
    [isDarkMode]
  )

  const [config, setConfig] = useState<ShadowConfig>(getDefaultConfig)

  const cssCode = useMemo(() => {
    const { offsetX, offsetY, blur, spread, color, opacity, inset } = config
    // Convert hex to rgba
    const r = parseInt(color.slice(1, 3), 16)
    const g = parseInt(color.slice(3, 5), 16)
    const b = parseInt(color.slice(5, 7), 16)
    const a = opacity / 100

    const shadow = `${inset ? 'inset ' : ''}${offsetX}px ${offsetY}px ${blur}px ${spread}px rgba(${r}, ${g}, ${b}, ${a})`
    return `box-shadow: ${shadow};`
  }, [config])

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(cssCode)
    message.success(t('app.social.retires.copy_success'))
  }, [cssCode, message, t])

  const handleReset = useCallback(() => {
    setConfig(getDefaultConfig())
  }, [getDefaultConfig])

  const handleSliderChange = useCallback((key: keyof ShadowConfig, value: number) => {
    setConfig(prev => ({ ...prev, [key]: value }))
  }, [])

  const handleColorChange = useCallback((hexString: string) => {
    setConfig(prev => ({ ...prev, color: hexString }))
  }, [])

  const handleInsetChange = useCallback((checked: boolean) => {
    setConfig(prev => ({ ...prev, inset: checked }))
  }, [])

  return (
    <Flex className="size-full" gap={20} vertical>
      <Row gutter={16} style={{ flex: 1 }}>
        {/* Controls */}
        <Col xs={24} md={12}>
          <Card
            title={t('app.generation.shadow')}
            style={{ height: '100%' }}
            extra={
              <Button icon={<ReloadOutlined />} onClick={handleReset}>
                {t('app.generation.cron.reset')}
              </Button>
            }
          >
            <Flex vertical gap={16}>
              {sliderConfigs.map(item => (
                <div key={item.key}>
                  <Flex justify="space-between" style={{ marginBottom: 4 }}>
                    <Typography.Text>{item.label}</Typography.Text>
                    <Typography.Text code>
                      {config[item.key]}
                      {item.suffix}
                    </Typography.Text>
                  </Flex>
                  <Slider
                    min={item.min}
                    max={item.max}
                    value={config[item.key] as number}
                    onChange={v => handleSliderChange(item.key, v)}
                  />
                </div>
              ))}

              <Flex align="center" gap={16}>
                <Typography.Text>{t('app.generation.shadow.color')}</Typography.Text>
                <ColorPicker
                  value={config.color}
                  onChange={c => handleColorChange(c.toHexString())}
                />
                <Checkbox
                  checked={config.inset}
                  onChange={e => handleInsetChange(e.target.checked)}
                >
                  Inset
                </Checkbox>
              </Flex>
            </Flex>
          </Card>
        </Col>

        {/* Preview */}
        <Col xs={24} md={12}>
          <Card title={t('app.generation.shadow.preview')} style={{ height: '100%' }}>
            <Flex
              justify="center"
              align="center"
              style={{
                height: 300,
                background: theme.colorBgLayout,
                borderRadius: 8
              }}
            >
              <div
                style={{
                  width: 150,
                  height: 150,
                  background: theme.colorBgContainer,
                  borderRadius: 12,
                  boxShadow: cssCode.replace('box-shadow: ', '').replace(';', '')
                }}
              />
            </Flex>
          </Card>
        </Col>
      </Row>

      {/* CSS Code */}
      <Card
        title={t('app.generation.shadow.code')}
        extra={
          <Button icon={<CopyOutlined />} onClick={handleCopy}>
            {t('app.generation.uuid.copy')}
          </Button>
        }
      >
        <Input
          value={cssCode}
          readOnly
          style={{ fontFamily: 'monospace', fontSize: 16 }}
          size="large"
        />
      </Card>
    </Flex>
  )
}

export default ShadowClient
