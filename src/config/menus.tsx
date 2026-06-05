import { Barcode, FileText, Hash, Palette, Shield, User, Video } from 'lucide-react'
import React from 'react'

export interface MenuConfig {
  path: string
  icon?: React.ReactNode
  children?: MenuConfig[]
}

export const menus: MenuConfig[] = [
  {
    path: '/social',
    icon: <User className="w-4 h-4" />,
    children: [{ path: '/social/retires' }, { path: '/social/time' }, { path: '/social/keycode' }]
  },
  {
    path: '/hash',
    icon: <Hash className="w-4 h-4" />,
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
    icon: <Shield className="w-4 h-4" />,
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
    icon: <Video className="w-4 h-4" />,
    children: [
      { path: '/preview/docx' },
      { path: '/preview/excel' },
      { path: '/preview/pdf' },
      { path: '/preview/pptx' },
      { path: '/preview/markdown' }
    ]
  },
  {
    path: '/generation',
    icon: <Barcode className="w-4 h-4" />,
    children: [
      { path: '/generation/uuid' },
      { path: '/generation/token' },
      { path: '/generation/qrcode' },
      { path: '/generation/password' },
      { path: '/generation/cron' },
      { path: '/generation/clamp' },
      { path: '/generation/shadow' },
      { path: '/generation/lorem' },
      { path: '/generation/gradient' }
    ]
  },
  {
    path: '/format',
    icon: <FileText className="w-4 h-4" />,
    children: [
      { path: '/format/json' },
      { path: '/format/yaml' },
      { path: '/format/diff' },
      { path: '/format/regex' },
      { path: '/format/sql' },
      { path: '/format/url' },
      { path: '/format/case' },
      { path: '/format/text' },
      { path: '/format/xml' },
      { path: '/format/ua' }
    ]
  },
  {
    path: '/converter',
    icon: <Palette className="w-4 h-4" />,
    children: [
      { path: '/converter/color' },
      { path: '/converter/image' },
      { path: '/converter/timestamp' },
      { path: '/converter/base' },
      { path: '/converter/html' },
      { path: '/converter/unit' }
    ]
  }
]
