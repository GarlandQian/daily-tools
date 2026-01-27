'use client'

import { Card, Col, ColorPicker, Flex, Input, Radio, Row, Slider, Typography } from 'antd'
import React, { useMemo, useState } from 'react'

import ToolLayout from '@/components/ToolLayout'
import { useCopy } from '@/hooks/useCopy'

type GradientType = 'linear' | 'radial'

const GradientClient = () => {
  const { copy } = useCopy()

  const [type, setType] = useState<GradientType>('linear')
  const [angle, setAngle] = useState(90)
  const [color1, setColor1] = useState('#667eea')
  const [color2, setColor2] = useState('#764ba2')

  const gradientCSS = useMemo(() => {
    if (type === 'linear') {
      return `linear-gradient(${angle}deg, ${color1}, ${color2})`
    }
    return `radial-gradient(circle, ${color1}, ${color2})`
  }, [type, angle, color1, color2])

  const fullCSS = `background: ${gradientCSS};`

  return (
    <ToolLayout title="app.generation.gradient" showCopy onCopy={() => copy(fullCSS)}>
      <Flex gap={20} vertical>
        <Row gutter={16}>
          <Col xs={24} lg={12}>
            <Card title="Settings">
              <Flex vertical gap={16}>
                <div>
                  <Typography.Text type="secondary">Type</Typography.Text>
                  <Radio.Group
                    value={type}
                    onChange={e => setType(e.target.value)}
                    buttonStyle="solid"
                    style={{ display: 'block', marginTop: 8 }}
                  >
                    <Radio.Button value="linear">Linear</Radio.Button>
                    <Radio.Button value="radial">Radial</Radio.Button>
                  </Radio.Group>
                </div>

                {type === 'linear' && (
                  <div>
                    <Typography.Text type="secondary">Angle: {angle}°</Typography.Text>
                    <Slider value={angle} onChange={setAngle} min={0} max={360} />
                  </div>
                )}

                <Flex gap={16}>
                  <div style={{ flex: 1 }}>
                    <Typography.Text type="secondary">Color 1</Typography.Text>
                    <div style={{ marginTop: 8 }}>
                      <ColorPicker
                        value={color1}
                        onChange={c => setColor1(c.toHexString())}
                        showText
                      />
                    </div>
                  </div>
                  <div style={{ flex: 1 }}>
                    <Typography.Text type="secondary">Color 2</Typography.Text>
                    <div style={{ marginTop: 8 }}>
                      <ColorPicker
                        value={color2}
                        onChange={c => setColor2(c.toHexString())}
                        showText
                      />
                    </div>
                  </div>
                </Flex>
              </Flex>
            </Card>
          </Col>
          <Col xs={24} lg={12}>
            <Card title="Preview" styles={{ body: { padding: 0 } }}>
              <div
                style={{
                  height: 250,
                  background: gradientCSS,
                  borderRadius: 8
                }}
              />
            </Card>
          </Col>
        </Row>

        <Card title="CSS Code">
          <Input.TextArea
            value={fullCSS}
            readOnly
            autoSize={{ minRows: 2 }}
            style={{ fontFamily: 'monospace' }}
          />
        </Card>
      </Flex>
    </ToolLayout>
  )
}

export default GradientClient
