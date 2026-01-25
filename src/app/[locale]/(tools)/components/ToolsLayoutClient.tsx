'use client'
import {
  GithubOutlined,
  LaptopOutlined,
  MenuOutlined,
  MoonOutlined,
  SunOutlined
} from '@ant-design/icons'
import type { MenuProps } from 'antd'
import { Breadcrumb, Drawer, Dropdown, Flex, Grid, Layout, Menu, theme } from 'antd'
import { usePathname } from 'next/navigation'
import { useRouter } from 'nextjs-toploader/app'
import React, { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import IconFont from '@/components/IconFont'
import { useTheme } from '@/components/ThemeProvider'
import TransitionLayout from '@/components/TransitionLayout'
import { menus } from '@/config/menus'

const { Header, Content, Footer, Sider } = Layout

type MenuItem = Required<MenuProps>['items'][number]
function getItem(
  label: React.ReactNode,
  key: React.Key,
  icon?: React.ReactNode,
  children?: MenuItem[]
): MenuItem {
  return {
    key,
    icon,
    children,
    label
  } as MenuItem
}
interface LevelKeysProps {
  key?: string
  children?: LevelKeysProps[]
}
const getLevelKeys = (items1: LevelKeysProps[]) => {
  const key: Record<string, number> = {}
  const func = (items2: LevelKeysProps[], level = 1) => {
    items2.forEach(item => {
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

const ToolsLayoutClient = ({ children }: { children: React.ReactNode }) => {
  const { token } = theme.useToken()
  const { colorBgContainer, borderRadiusLG, colorTextSecondary } = token
  const { themeMode, setThemeMode } = useTheme()

  const router = useRouter()
  const pathname = usePathname()
  const {
    t,
    i18n: { language, changeLanguage }
  } = useTranslation()
  const items: MenuItem[] = useMemo(() => {
    return menus.map(item => {
      // /social -> app.social
      const key = `app${item.path.replaceAll('/', '.')}`

      const children = item.children?.map(child => {
        const childKey = `app${child.path.replaceAll('/', '.')}`
        return getItem(t(childKey), child.path)
      })

      return getItem(t(key), item.path, item.icon, children)
    })
  }, [t])
  const [collapsed, setCollapsed] = useState(false)
  const [stateOpenKeys, setStateOpenKeys] = useState([`/${pathname.split('/')[1]}`])
  const [selectKeys, setSelectKeys] = useState([pathname])
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const screens = Grid.useBreakpoint()
  const isMobile = !screens.md

  const onOpenChange: MenuProps['onOpenChange'] = openKeys => {
    const levelKeys = getLevelKeys(items as LevelKeysProps[])
    const currentOpenKey = openKeys.find(key => stateOpenKeys.indexOf(key) === -1)
    // open
    if (currentOpenKey !== undefined) {
      const repeatIndex = openKeys
        .filter(key => key !== currentOpenKey)
        .findIndex(key => levelKeys[key] === levelKeys[currentOpenKey])

      setStateOpenKeys(
        openKeys
          // remove repeat key
          .filter((_, index) => index !== repeatIndex)
          // remove current level all child
          .filter(key => levelKeys[key] <= levelKeys[currentOpenKey])
      )
    } else {
      // close
      setStateOpenKeys(openKeys)
    }
  }

  const onSelect = ({ selectedKeys }: { selectedKeys: string[] }) => {
    setSelectKeys(selectedKeys)
    router.push(selectedKeys[0])
    if (isMobile) {
      setMobileMenuOpen(false)
    }
  }

  const breadcrumbItems = useMemo(() => {
    const keyList = selectKeys[0].split('/').filter(Boolean)
    return keyList.map((_key, index) => ({
      title: t(`app.${[...new Array(index + 1)].map((_item, i) => `${keyList[i]}`).join('.')}`)
    }))
  }, [selectKeys, t])

  const menu = (
    <Menu
      theme="dark"
      selectedKeys={selectKeys}
      openKeys={stateOpenKeys}
      onOpenChange={onOpenChange}
      mode="inline"
      items={items}
      onSelect={onSelect}
    />
  )

  return (
    <Layout style={{ height: '100vh', overflow: 'hidden' }}>
      {!isMobile && (
        <Sider collapsible collapsed={collapsed} onCollapse={value => setCollapsed(value)}>
          {menu}
        </Sider>
      )}
      <Drawer
        placement="left"
        onClose={() => setMobileMenuOpen(false)}
        open={mobileMenuOpen}
        styles={{ body: { padding: 0 }, wrapper: { width: 200 } }}
      >
        <div style={{ height: '100%', background: '#001529' }}>{menu}</div>
      </Drawer>
      <Layout>
        <Header
          className="pr-5"
          style={{
            background: colorBgContainer,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          <Flex align="center" gap={10}>
            {isMobile && (
              <MenuOutlined
                className="cursor-pointer text-[20px] ml-4"
                onClick={() => setMobileMenuOpen(true)}
              />
            )}
          </Flex>
          <Flex align="center" gap={10} style={{ marginLeft: 'auto' }}>
            <GithubOutlined
              className="cursor-pointer text-[28px]"
              onClick={() => window.open(process.env.NEXT_PUBLIC_GITHUB_URL)}
            />
            <Dropdown
              menu={{
                items: [
                  {
                    key: 'light',
                    label: (
                      <Flex
                        align="center"
                        gap={8}
                        justify="space-between"
                        style={{ minWidth: 100 }}
                      >
                        {t('app.theme.light')}
                        <SunOutlined />
                      </Flex>
                    ),
                    onClick: () => setThemeMode('light')
                  },
                  {
                    key: 'dark',
                    label: (
                      <Flex
                        align="center"
                        gap={8}
                        justify="space-between"
                        style={{ minWidth: 100 }}
                      >
                        {t('app.theme.dark')}
                        <MoonOutlined />
                      </Flex>
                    ),
                    onClick: () => setThemeMode('dark')
                  },
                  {
                    key: 'system',
                    label: (
                      <Flex
                        align="center"
                        gap={8}
                        justify="space-between"
                        style={{ minWidth: 100 }}
                      >
                        {t('app.theme.system')}
                        <LaptopOutlined />
                      </Flex>
                    ),
                    onClick: () => setThemeMode('system')
                  }
                ],
                selectedKeys: [themeMode]
              }}
              trigger={['click']}
            >
              <div className="cursor-pointer text-[28px] flex items-center">
                {themeMode === 'light' && <SunOutlined />}
                {themeMode === 'dark' && <MoonOutlined />}
                {themeMode === 'system' && <LaptopOutlined />}
              </div>
            </Dropdown>
            <Flex
              align="center"
              gap={10}
              className="hover:text-[var(--hover-color)]"
              style={{ '--hover-color': token.colorPrimaryHover } as React.CSSProperties}
            >
              {language === 'cn' ? (
                <IconFont
                  className="cursor-pointer text-[32px]"
                  type="icon-chinese"
                  onClick={() => changeLanguage('en')}
                />
              ) : (
                <IconFont
                  className="cursor-pointer text-[32px]"
                  type="icon-english"
                  onClick={() => changeLanguage('cn')}
                />
              )}
            </Flex>
          </Flex>
        </Header>
        <Content style={{ margin: '0 16px' }}>
          <Flex vertical style={{ height: '100%', overflow: 'hidden' }}>
            <Breadcrumb style={{ margin: '16px 0' }} items={breadcrumbItems} />
            <TransitionLayout
              style={{
                padding: 24,
                background: colorBgContainer,
                borderRadius: borderRadiusLG,
                flex: 1,
                overflow: 'auto'
              }}
            >
              {children}
            </TransitionLayout>
          </Flex>
        </Content>
        <Footer style={{ textAlign: 'center', color: colorTextSecondary }}>
          Tools ©2024-{new Date().getFullYear()} Created by GarlandQian
        </Footer>
      </Layout>
    </Layout>
  )
}

export default ToolsLayoutClient
