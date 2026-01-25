'use client'

import { CopyOutlined, ReloadOutlined } from '@ant-design/icons'
import { Button, Card, Flex, Form, InputNumber, Radio, theme as antTheme } from 'antd'
import { LoremIpsum } from 'lorem-ipsum'
import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useCopy } from '@/hooks/useCopy'

type LoremUnit = 'paragraphs' | 'sentences' | 'words'

interface LoremForm {
  count: number
  unit: LoremUnit
}

const lorem = new LoremIpsum({
  sentencesPerParagraph: { max: 8, min: 4 },
  wordsPerSentence: { max: 16, min: 4 }
})

const LoremClient = () => {
  const { t } = useTranslation()
  const { token: theme } = antTheme.useToken()
  const { copy } = useCopy()
  const [form] = Form.useForm<LoremForm>()

  const [output, setOutput] = useState('')

  const handleGenerate = useCallback((values: LoremForm) => {
    const { count, unit } = values
    let text = ''

    switch (unit) {
      case 'paragraphs':
        text = lorem.generateParagraphs(count)
        break
      case 'sentences':
        text = lorem.generateSentences(count)
        break
      case 'words':
        text = lorem.generateWords(count)
        break
    }

    setOutput(text)
  }, [])

  return (
    <Flex className="size-full" gap={20} vertical>
      <Card title={t('app.generation.lorem')}>
        <Form
          form={form}
          layout="inline"
          initialValues={{ count: 3, unit: 'paragraphs' }}
          onFinish={handleGenerate}
        >
          <Form.Item label={t('app.generation.lorem.count')} name="count">
            <InputNumber min={1} max={100} style={{ width: 80 }} />
          </Form.Item>
          <Form.Item name="unit">
            <Radio.Group>
              <Radio.Button value="paragraphs">{t('app.generation.lorem.paragraphs')}</Radio.Button>
              <Radio.Button value="sentences">{t('app.generation.lorem.sentences')}</Radio.Button>
              <Radio.Button value="words">{t('app.generation.lorem.words')}</Radio.Button>
            </Radio.Group>
          </Form.Item>
          <Form.Item>
            <Flex gap={8}>
              <Button type="primary" htmlType="submit" icon={<ReloadOutlined />}>
                {t('public.generate')}
              </Button>
              <Button icon={<CopyOutlined />} onClick={() => copy(output)} disabled={!output}>
                {t('app.generation.uuid.copy')}
              </Button>
            </Flex>
          </Form.Item>
        </Form>
      </Card>

      <Card
        title={t('app.generation.lorem.output')}
        style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}
        styles={{ body: { flex: 1, overflow: 'auto' } }}
      >
        <div
          style={{
            whiteSpace: 'pre-wrap',
            lineHeight: 1.8,
            fontSize: 14,
            padding: 16,
            background: theme.colorBgLayout,
            borderRadius: 8,
            minHeight: 200
          }}
        >
          {output || t('app.generation.lorem.placeholder')}
        </div>
      </Card>
    </Flex>
  )
}

export default LoremClient
