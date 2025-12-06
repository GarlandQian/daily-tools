'use client'
import {
  FundOutlined,
  GithubOutlined,
  MenuOutlined,
  RollbackOutlined,
  UserOutlined,
  VideoCameraOutlined
} from '@ant-design/icons'
import type { MenuProps } from 'antd'
import { Breadcrumb, Drawer, Flex, Grid, Layout, Menu, theme } from 'antd'
import { createStyles } from 'antd-style'
import { usePathname } from 'next/navigation'
import { useRouter } from 'nextjs-toploader/app'
import React, { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import IconFont from '@/components/IconFont'
import TransitionLayout from '@/components/TransitionLayout'

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

const useStyles = createStyles(({ token, css }) => ({
  header: css`
    padding: '0 20px 0 0';
    background: ${token.colorBgContainer};
  `,
  transformIcon: css`
    &:hover {
      color: ${token.colorPrimaryHover};
    }
  `
}))

const ToolsLayoutClient = ({ children }: { children: React.ReactNode }) => {
  const {
    token: { colorBgContainer, borderRadiusLG }
  } = theme.useToken()
  const { styles } = useStyles()
  const router = useRouter()
  const pathname = usePathname()
  const {
    t,
    i18n: { language, changeLanguage }
  } = useTranslation()
  const items: MenuItem[] = [
    getItem(t('app.social'), '/social', <UserOutlined />, [
      getItem(t('app.social.retires'), '/social/retires'),
      getItem(t('app.social.time'), '/social/time')
    ]),
    getItem(t('app.hash'), '/hash', <FundOutlined />, [
      getItem(t('app.hash.md5'), '/hash/md5'),
      getItem(t('app.hash.sha'), '/hash/sha'),
      getItem(t('app.hash.hmacMD5'), '/hash/hmacMD5'),
      getItem(t('app.hash.hmacSHA'), '/hash/hmacSHA'),
      getItem(t('app.hash.ripemd'), '/hash/ripemd'),
      getItem(t('app.hash.hmacRIPEMD'), '/hash/hmacRIPEMD'),
      getItem(t('app.hash.pbkdf'), '/hash/pbkdf')
    ]),
    getItem(t('app.encryption'), '/encryption', <RollbackOutlined />, [
      getItem(t('app.encryption.aes'), '/encryption/aes'),
      getItem(t('app.encryption.des'), '/encryption/des'),
      getItem(t('app.encryption.tripleDes'), '/encryption/tripleDes')
    ]),
    getItem(t('app.preview'), '/preview', <VideoCameraOutlined />, [
      getItem(t('app.preview.docx'), '/preview/docx'),
      getItem(t('app.preview.excel'), '/preview/excel'),
      getItem(t('app.preview.pdf'), '/preview/pdf'),
      getItem(t('app.preview.pptx'), '/preview/pptx')
    ])
  ]
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
        <Header className={styles.header}>
          <Flex className="h-full" align="center" justify="space-between">
            <Flex align="center" gap={10}>
              {isMobile && (
                <MenuOutlined
                  className="cursor-pointer text-[20px] ml-4"
                  onClick={() => setMobileMenuOpen(true)}
                />
              )}
            </Flex>
            <Flex align="center" gap={10}>
              <GithubOutlined
                className="cursor-pointer text-[28px]"
                onClick={() => window.open(process.env.NEXT_PUBLIC_GITHUB_URL)}
              />
              <Flex align="center" gap={10} className={styles.transformIcon}>
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
                overflow: 'hidden'
              }}
            >
              {children}
            </TransitionLayout>
          </Flex>
        </Content>
        <Footer style={{ textAlign: 'center' }}>
          Tools ©2024-{new Date().getFullYear()} Created by GarlandQian
        </Footer>
      </Layout>
    </Layout>
  )
}

export default ToolsLayoutClient
