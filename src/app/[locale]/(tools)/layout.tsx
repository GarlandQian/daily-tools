'use client'
import { createFromIconfontCN, UserOutlined } from '@ant-design/icons'
import type { MenuProps } from 'antd'
import { Breadcrumb, Flex, Layout, Menu, theme } from 'antd'
import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslation } from 'react-i18next'

const { Header, Content, Footer, Sider } = Layout

const IconFont = createFromIconfontCN({
  scriptUrl: ['//at.alicdn.com/t/c/font_4712729_7o5i1rmpsxi.js'],
})

type MenuItem = Required<MenuProps>['items'][number]

function getItem(label: React.ReactNode, key: React.Key, icon?: React.ReactNode, children?: MenuItem[]): MenuItem {
  return {
    key,
    icon,
    children,
    label,
  } as MenuItem
}

const ToolsLayout: React.FC = ({ children }: React.PropsWithChildren) => {
  const {
    t,
    i18n: { language, changeLanguage },
  } = useTranslation()
  const items: MenuItem[] = [
    getItem(t('app.social'), 'social', <UserOutlined />, [getItem(t('app.social.retires'), '/social/retires')]),
  ]
  const [collapsed, setCollapsed] = useState(false)
  const {
    token: { colorBgContainer, borderRadiusLG },
  } = theme.useToken()

  const router = useRouter()

  return (
    <Layout style={{ height: '100vh', overflow: 'hidden' }}>
      <Sider collapsible collapsed={collapsed} onCollapse={(value) => setCollapsed(value)}>
        <div className="demo-logo-vertical" />
        <Menu
          theme="dark"
          defaultSelectedKeys={['/social/retires']}
          defaultOpenKeys={['social']}
          mode="inline"
          items={items}
          onSelect={(info) => {
            router.push(info.selectedKeys[0])
          }}
        />
      </Sider>
      <Layout>
        <Header style={{ padding: '0 20px 0 0', background: colorBgContainer }}>
          <Flex justify="flex-end" align="center" className="h-full cursor-pointer">
            <div onClick={() => changeLanguage(language === 'en' ? 'cn' : 'en')}>
              {language === 'cn' ? (
                <IconFont type="icon-zhongyingwenqiehuan" style={{ fontSize: '32px' }} className="hover:" />
              ) : (
                <IconFont type="icon-zhongyingwenqiehuan1" style={{ fontSize: '32px' }} />
              )}
            </div>
          </Flex>
        </Header>
        <Content style={{ margin: '0 16px' }}>
          <Breadcrumb
            style={{ margin: '16px 0' }}
            items={[
              {
                title: 'Social',
              },
              {
                title: 'Retires',
              },
            ]}
          />
          <div
            style={{
              padding: 24,
              height: '100%',
              background: colorBgContainer,
              borderRadius: borderRadiusLG,
            }}
          >
            {children}
          </div>
        </Content>
        <Footer style={{ textAlign: 'center' }}>Ant Design ©{new Date().getFullYear()} Created by Ant UED</Footer>
      </Layout>
    </Layout>
  )
}

export default ToolsLayout
