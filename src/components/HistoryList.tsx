
'use client'

import { CopyOutlined,DeleteOutlined } from '@ant-design/icons'
import { Button, Card,List, Popconfirm, Typography } from 'antd'
import { useTranslation } from 'react-i18next'

interface HistoryItem {
  id: string
  content: string
  result: string
  options?: any
  createdAt: Date | string
}

interface HistoryListProps {
  data: HistoryItem[]
  onClear: () => void
  loading?: boolean
}

export const HistoryList = ({ data, onClear, loading }: HistoryListProps) => {
  const { t } = useTranslation()

  if (!data?.length && !loading) {
    return null
  }

  return (
    <Card
      title={t('app.history.title')}
      extra={
        data.length > 0 && (
          <Popconfirm title={t('public.confirm')} onConfirm={onClear}>
            <Button type="link" danger icon={<DeleteOutlined />}>
              {t('app.history.clear')}
            </Button>
          </Popconfirm>
        )
      }
      style={{ marginTop: 24 }}
    >
      <List
        loading={loading}
        itemLayout="vertical"
        dataSource={data}
        renderItem={(item) => (
          <List.Item
            key={item.id}
            extra={
              <Button
                type="text"
                icon={<CopyOutlined />}
                onClick={() => navigator.clipboard.writeText(item.result)}
              >
                {t('app.social.retires.copy')}
              </Button>
            }
          >
            <List.Item.Meta
              title={
                <Typography.Text ellipsis style={{ maxWidth: 400 }}>
                  {item.content}
                </Typography.Text>
              }
              description={new Date(item.createdAt).toLocaleString()}
            />
            <Typography.Paragraph ellipsis={{ rows: 2, expandable: true, symbol: 'more' }}>
              {item.result}
            </Typography.Paragraph>
          </List.Item>
        )}
      />
    </Card>
  )
}
