import {
  ArrowRightLeft,
  Clock3,
  FileCode2,
  FileSearch,
  Hash,
  Landmark,
  ShieldCheck,
  Sparkles
} from 'lucide-react'
import React from 'react'

export interface MenuConfig {
  path: string
  labelKey?: string
  icon?: React.ReactNode
  children?: MenuConfig[]
}

export const menus: MenuConfig[] = [
  {
    path: '/life',
    labelKey: 'app.menu.life',
    icon: <Landmark className="w-4 h-4" />,
    children: [
      { path: '/social/salary' },
      { path: '/social/housing-fund' },
      { path: '/social/pension' },
      { path: '/social/retires' }
    ]
  },
  {
    path: '/inspect',
    labelKey: 'app.menu.inspect',
    icon: <Clock3 className="w-4 h-4" />,
    children: [{ path: '/social/time' }, { path: '/social/keycode' }]
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
      { path: '/hash/pbkdf' },
      { path: '/hash/file' }
    ]
  },
  {
    path: '/encryption',
    icon: <ShieldCheck className="w-4 h-4" />,
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
    icon: <FileSearch className="w-4 h-4" />,
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
    icon: <Sparkles className="w-4 h-4" />,
    children: [
      { path: '/generation/uuid' },
      { path: '/generation/token' },
      { path: '/generation/qrcode' },
      { path: '/generation/password' },
      { path: '/generation/manifest' },
      { path: '/generation/og' },
      { path: '/generation/env' },
      { path: '/generation/docker-compose' },
      { path: '/generation/kubernetes' },
      { path: '/generation/nginx' },
      { path: '/generation/caddy' },
      { path: '/generation/github-actions' },
      { path: '/generation/vercel' },
      { path: '/generation/systemd' },
      { path: '/generation/robots' },
      { path: '/generation/security-txt' },
      { path: '/generation/trace-context' },
      { path: '/generation/utm' },
      { path: '/generation/cron' },
      { path: '/generation/grid' },
      { path: '/generation/clamp' },
      { path: '/generation/shadow' },
      { path: '/generation/lorem' },
      { path: '/generation/gradient' }
    ]
  },
  {
    path: '/format',
    icon: <FileCode2 className="w-4 h-4" />,
    children: [
      { path: '/format/json' },
      { path: '/format/json2ts' },
      { path: '/format/csv' },
      { path: '/format/markdown-toc' },
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
    icon: <ArrowRightLeft className="w-4 h-4" />,
    children: [
      { path: '/converter/color' },
      { path: '/converter/image' },
      { path: '/converter/timestamp' },
      { path: '/converter/base' },
      { path: '/converter/cidr' },
      { path: '/converter/dns-records' },
      { path: '/converter/tls-config' },
      { path: '/converter/uuid' },
      { path: '/converter/px-rem' },
      { path: '/converter/http-status' },
      { path: '/converter/rate-limit' },
      { path: '/converter/redirect-rules' },
      { path: '/converter/canonical-url' },
      { path: '/converter/robots-meta' },
      { path: '/converter/resource-hints' },
      { path: '/converter/preload-scanner' },
      { path: '/converter/render-blocking' },
      { path: '/converter/css-coverage' },
      { path: '/converter/font-loading' },
      { path: '/converter/priority-hints' },
      { path: '/converter/image-delivery' },
      { path: '/converter/performance-budget' },
      { path: '/converter/network-waterfall' },
      { path: '/converter/ttfb-breakdown' },
      { path: '/converter/lcp-breakdown' },
      { path: '/converter/inp-breakdown' },
      { path: '/converter/cls-breakdown' },
      { path: '/converter/web-vitals' },
      { path: '/converter/bfcache' },
      { path: '/converter/main-thread' },
      { path: '/converter/hydration-boundary' },
      { path: '/converter/third-party-scripts' },
      { path: '/converter/bundle-split' },
      { path: '/converter/early-hints' },
      { path: '/converter/speculation-rules' },
      { path: '/converter/client-hints' },
      { path: '/converter/server-timing' },
      { path: '/converter/edge-cache-debugger' },
      { path: '/converter/etag-revalidation' },
      { path: '/converter/http-headers' },
      { path: '/converter/security-headers-audit' },
      { path: '/converter/referrer-policy' },
      { path: '/converter/hsts' },
      { path: '/converter/cache-control' },
      { path: '/converter/compression-headers' },
      { path: '/converter/cors' },
      { path: '/converter/cross-origin-isolation' },
      { path: '/converter/csp' },
      { path: '/converter/sri' },
      { path: '/converter/permissions-policy' },
      { path: '/converter/cookie' },
      { path: '/converter/mime' },
      { path: '/converter/html' },
      { path: '/converter/unit' }
    ]
  }
]
