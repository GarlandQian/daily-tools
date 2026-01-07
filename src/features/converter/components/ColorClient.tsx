'use client'

import { CopyOutlined, SwapOutlined } from '@ant-design/icons'
import {
  App,
  Button,
  Card,
  Col,
  ColorPicker,
  Flex,
  Input,
  Row,
  Space,
  theme as antTheme,
  Typography
} from 'antd'
import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'

interface ColorValues {
  hex: string
  rgb: { r: number; g: number; b: number }
  hsl: { h: number; s: number; l: number }
}

const hexToRgb = (hex: string): { r: number; g: number; b: number } | null => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
      }
    : null
}

const rgbToHsl = (r: number, g: number, b: number): { h: number; s: number; l: number } => {
  r /= 255
  g /= 255
  b /= 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  let h = 0
  let s = 0
  const l = (max + min) / 2

  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6
        break
      case g:
        h = ((b - r) / d + 2) / 6
        break
      case b:
        h = ((r - g) / d + 4) / 6
        break
    }
  }

  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100)
  }
}

const rgbToHex = (r: number, g: number, b: number): string => {
  return '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('')
}

const hslToRgb = (h: number, s: number, l: number): { r: number; g: number; b: number } => {
  h /= 360
  s /= 100
  l /= 100
  let r, g, b

  if (s === 0) {
    r = g = b = l
  } else {
    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0) t += 1
      if (t > 1) t -= 1
      if (t < 1 / 6) return p + (q - p) * 6 * t
      if (t < 1 / 2) return q
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6
      return p
    }
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s
    const p = 2 * l - q
    r = hue2rgb(p, q, h + 1 / 3)
    g = hue2rgb(p, q, h)
    b = hue2rgb(p, q, h - 1 / 3)
  }

  return {
    r: Math.round(r * 255),
    g: Math.round(g * 255),
    b: Math.round(b * 255)
  }
}

const ColorClient = () => {
  const { t } = useTranslation()
  const { message } = App.useApp()
  const { token: theme } = antTheme.useToken()

  const [colors, setColors] = useState<ColorValues>({
    hex: '#1677ff',
    rgb: { r: 22, g: 119, b: 255 },
    hsl: { h: 215, s: 100, l: 54 }
  })

  const handleHexChange = useCallback((value: string) => {
    const hex = value.startsWith('#') ? value : `#${value}`
    const rgb = hexToRgb(hex)
    if (rgb) {
      const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b)
      setColors({ hex, rgb, hsl })
    }
  }, [])

  const handleRgbChange = useCallback(
    (key: 'r' | 'g' | 'b', value: string) => {
      const num = parseInt(value) || 0
      const clamped = Math.max(0, Math.min(255, num))
      const newRgb = { ...colors.rgb, [key]: clamped }
      const hex = rgbToHex(newRgb.r, newRgb.g, newRgb.b)
      const hsl = rgbToHsl(newRgb.r, newRgb.g, newRgb.b)
      setColors({ hex, rgb: newRgb, hsl })
    },
    [colors.rgb]
  )

  const handleHslChange = useCallback(
    (key: 'h' | 's' | 'l', value: string) => {
      const num = parseInt(value) || 0
      const max = key === 'h' ? 360 : 100
      const clamped = Math.max(0, Math.min(max, num))
      const newHsl = { ...colors.hsl, [key]: clamped }
      const rgb = hslToRgb(newHsl.h, newHsl.s, newHsl.l)
      const hex = rgbToHex(rgb.r, rgb.g, rgb.b)
      setColors({ hex, rgb, hsl: newHsl })
    },
    [colors.hsl]
  )

  const handleColorPickerChange = useCallback(
    (color: { toHexString: () => string }) => {
      handleHexChange(color.toHexString())
    },
    [handleHexChange]
  )

  const copyToClipboard = useCallback(
    (text: string) => {
      navigator.clipboard.writeText(text)
      message.success(t('app.social.retires.copy_success'))
    },
    [message, t]
  )

  const hexStr = colors.hex.toUpperCase()
  const rgbStr = `rgb(${colors.rgb.r}, ${colors.rgb.g}, ${colors.rgb.b})`
  const hslStr = `hsl(${colors.hsl.h}, ${colors.hsl.s}%, ${colors.hsl.l}%)`

  return (
    <Flex className="size-full" gap={20} vertical>
      <Card title={t('app.converter.color')}>
        <Row gutter={[16, 16]} align="middle">
          <Col xs={24} sm={8} md={6}>
            <Flex align="center" gap={12}>
              <ColorPicker
                value={colors.hex}
                onChange={handleColorPickerChange}
                showText
                size="large"
              />
              <div
                style={{
                  width: 60,
                  height: 60,
                  borderRadius: 8,
                  backgroundColor: colors.hex,
                  border: `1px solid ${theme.colorBorderSecondary}`
                }}
              />
            </Flex>
          </Col>
        </Row>
      </Card>

      <Row gutter={16} style={{ flex: 1 }}>
        <Col xs={24} md={8}>
          <Card title="HEX" style={{ height: '100%' }}>
            <Flex vertical gap={12}>
              <Input
                value={colors.hex}
                onChange={e => handleHexChange(e.target.value)}
                prefix={<SwapOutlined />}
                style={{ fontFamily: 'monospace' }}
              />
              <Flex align="center" justify="space-between">
                <Typography.Text code>{hexStr}</Typography.Text>
                <Button
                  type="text"
                  icon={<CopyOutlined />}
                  onClick={() => copyToClipboard(hexStr)}
                />
              </Flex>
            </Flex>
          </Card>
        </Col>

        <Col xs={24} md={8}>
          <Card title="RGB" style={{ height: '100%' }}>
            <Flex vertical gap={12}>
              <Space.Compact style={{ width: '100%' }}>
                <Input
                  prefix="R"
                  value={colors.rgb.r}
                  onChange={e => handleRgbChange('r', e.target.value)}
                  style={{ fontFamily: 'monospace', flex: 1 }}
                />
                <Input
                  prefix="G"
                  value={colors.rgb.g}
                  onChange={e => handleRgbChange('g', e.target.value)}
                  style={{ fontFamily: 'monospace', flex: 1 }}
                />
                <Input
                  prefix="B"
                  value={colors.rgb.b}
                  onChange={e => handleRgbChange('b', e.target.value)}
                  style={{ fontFamily: 'monospace', flex: 1 }}
                />
              </Space.Compact>
              <Flex align="center" justify="space-between">
                <Typography.Text code>{rgbStr}</Typography.Text>
                <Button
                  type="text"
                  icon={<CopyOutlined />}
                  onClick={() => copyToClipboard(rgbStr)}
                />
              </Flex>
            </Flex>
          </Card>
        </Col>

        <Col xs={24} md={8}>
          <Card title="HSL" style={{ height: '100%' }}>
            <Flex vertical gap={12}>
              <Space.Compact style={{ width: '100%' }}>
                <Input
                  prefix="H"
                  value={colors.hsl.h}
                  onChange={e => handleHslChange('h', e.target.value)}
                  style={{ fontFamily: 'monospace', flex: 1 }}
                />
                <Input
                  prefix="S"
                  value={colors.hsl.s}
                  onChange={e => handleHslChange('s', e.target.value)}
                  suffix="%"
                  style={{ fontFamily: 'monospace', flex: 1 }}
                />
                <Input
                  prefix="L"
                  value={colors.hsl.l}
                  onChange={e => handleHslChange('l', e.target.value)}
                  suffix="%"
                  style={{ fontFamily: 'monospace', flex: 1 }}
                />
              </Space.Compact>
              <Flex align="center" justify="space-between">
                <Typography.Text code>{hslStr}</Typography.Text>
                <Button
                  type="text"
                  icon={<CopyOutlined />}
                  onClick={() => copyToClipboard(hslStr)}
                />
              </Flex>
            </Flex>
          </Card>
        </Col>
      </Row>
    </Flex>
  )
}

export default ColorClient
