'use client'
import { createFromIconfontCN, FundOutlined, UserOutlined } from '@ant-design/icons'
import type { MenuProps } from 'antd'
import { Breadcrumb, Layout, Menu, theme } from 'antd'
import { createStyles } from 'antd-style'
import { usePathname, useRouter } from 'next/navigation'
import React, { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

const { Header, Content, Footer, Sider } = Layout

const IconFont = createFromIconfontCN({
  scriptUrl: ['//at.alicdn.com/t/c/font_4712729_kzdtt63fp9k.js'],
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
interface LevelKeysProps {
  key?: string
  children?: LevelKeysProps[]
}
const getLevelKeys = (items1: LevelKeysProps[]) => {
  const key: Record<string, number> = {}
  const func = (items2: LevelKeysProps[], level = 1) => {
    items2.forEach((item) => {
      if (item.key) {
        key[item.key] = level
      }
      if (item.children) {
        func(item.children, level + 1)
      }
    })
  }
  func(items1)
  return key
}

const useStyles = createStyles(({ token, css }) => ({
  languageIcon: css`
    display: flex;
    align-items: center;
    justify-content: flex-end;
    height: 100%;
    &:hover {
      color: ${token.colorPrimaryHover};
    }
  `,
}))

const ToolsLayout: React.FC = ({ children }: React.PropsWithChildren) => {
  const {
    token: { colorBgContainer, borderRadiusLG },
  } = theme.useToken()
  const { styles, cx } = useStyles()
  const router = useRouter()
  const pathname = usePathname()
  const {
    t,
    i18n: { language, changeLanguage },
  } = useTranslation()
  const items: MenuItem[] = [
    getItem(t('app.social'), '/social', <UserOutlined />, [getItem(t('app.social.retires'), '/social/retires')]),
    getItem(t('app.translate'), '/translate', <FundOutlined />, [
      getItem(t('app.translate.hash'), '/translate/hash'),
      getItem(t('app.translate.encryption'), '/translate/encryption'),
    ]),
  ]
  const [collapsed, setCollapsed] = useState(false)
  const [stateOpenKeys, setStateOpenKeys] = useState([`/${pathname.split('/')[1]}`])
  const [selectKeys, setSelectKeys] = useState([pathname])

  const onOpenChange: MenuProps['onOpenChange'] = (openKeys) => {
    const levelKeys = getLevelKeys(items as LevelKeysProps[])
    const currentOpenKey = openKeys.find((key) => stateOpenKeys.indexOf(key) === -1)
    // open
    if (currentOpenKey !== undefined) {
      const repeatIndex = openKeys
        .filter((key) => key !== currentOpenKey)
        .findIndex((key) => levelKeys[key] === levelKeys[currentOpenKey])

      setStateOpenKeys(
        openKeys
          // remove repeat key
          .filter((_, index) => index !== repeatIndex)
          // remove current level all child
          .filter((key) => levelKeys[key] <= levelKeys[currentOpenKey])
      )
    } else {
      // close
      setStateOpenKeys(openKeys)
    }
  }

  const onSelect = ({ selectedKeys }: { selectedKeys: string[] }) => {
    setSelectKeys(selectedKeys)
    router.push(selectedKeys[0])
  }

  const breadcrumbItems = useMemo(() => {
    const keyList = selectKeys[0].split('/').filter(Boolean)
    return keyList.map((key, index) => ({
      title: t(`app.${[...new Array(index + 1)].map((_item, i) => `${keyList[i]}`).join('.')}`),
    }))
  }, [selectKeys, t])

  return (
    <Layout style={{ height: '100vh', overflow: 'hidden' }}>
      <Sider collapsible collapsed={collapsed} onCollapse={(value) => setCollapsed(value)}>
        <div className="demo-logo-vertical" />
        <Menu
          theme="dark"
          selectedKeys={selectKeys}
          openKeys={stateOpenKeys}
          onOpenChange={onOpenChange}
          mode="inline"
          items={items}
          onSelect={onSelect}
        />
      </Sider>
      <Layout>
        <Header style={{ padding: '0 20px 0 0', background: colorBgContainer }}>
          <div
            className={cx('cursor-pointer', styles.languageIcon)}
            onClick={() => changeLanguage(language === 'en' ? 'cn' : 'en')}
          >
            {language === 'cn' ? (
              <IconFont type="icon-zhongyingwenqiehuan" style={{ fontSize: '32px' }} />
            ) : (
              <IconFont type="icon-zhongyingwenqiehuan1" style={{ fontSize: '32px' }} />
            )}
          </div>
        </Header>
        <Content style={{ margin: '0 16px' }}>
          <Breadcrumb style={{ margin: '16px 0' }} items={breadcrumbItems} />
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
        <Footer style={{ textAlign: 'center' }}>Tools ©2024-{new Date().getFullYear()} Created by GarlandQian</Footer>
      </Layout>
    </Layout>
  )
}

export default ToolsLayout
