import {
  BarcodeOutlined,
  BgColorsOutlined,
  FileTextOutlined,
  FundOutlined,
  RollbackOutlined,
  UserOutlined,
  VideoCameraOutlined
} from '@ant-design/icons'
import React from 'react'

export interface MenuConfig {
  path: string
  icon?: React.ReactNode
  children?: MenuConfig[]
}

export const menus: MenuConfig[] = [
  {
    path: '/social',
    icon: <UserOutlined />,
    children: [{ path: '/social/retires' }, { path: '/social/time' }]
  },
  {
    path: '/hash',
    icon: <FundOutlined />,
    children: [
      { path: '/hash/md5' },
      { path: '/hash/sha' },
      { path: '/hash/hmacMD5' },
      { path: '/hash/hmacSHA' },
      { path: '/hash/ripemd' },
      { path: '/hash/hmacRIPEMD' },
      { path: '/hash/pbkdf' }
    ]
  },
  {
    path: '/encryption',
    icon: <RollbackOutlined />,
    children: [
      { path: '/encryption/aes' },
      { path: '/encryption/des' },
      { path: '/encryption/tripleDes' },
      { path: '/encryption/base64' },
      { path: '/encryption/urlEncode' },
      { path: '/encryption/jwt' }
    ]
  },
  {
    path: '/preview',
    icon: <VideoCameraOutlined />,
    children: [
      { path: '/preview/docx' },
      { path: '/preview/excel' },
      { path: '/preview/pdf' },
      { path: '/preview/pptx' }
    ]
  },
  {
    path: '/generation',
    icon: <BarcodeOutlined />,
    children: [
      { path: '/generation/uuid' },
      { path: '/generation/qrcode' },
      { path: '/generation/password' },
      { path: '/generation/cron' },
      { path: '/generation/shadow' },
      { path: '/generation/lorem' }
    ]
  },
  {
    path: '/format',
    icon: <FileTextOutlined />,
    children: [
      { path: '/format/json' },
      { path: '/format/diff' },
      { path: '/format/regex' },
      { path: '/format/sql' }
    ]
  },
  {
    path: '/converter',
    icon: <BgColorsOutlined />,
    children: [
      { path: '/converter/color' },
      { path: '/converter/image' },
      { path: '/converter/timestamp' },
      { path: '/converter/base' }
    ]
  }
]
