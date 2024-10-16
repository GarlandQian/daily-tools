import { i18nRouter } from 'next-i18n-router'
import i18nConfig from '@/locales/i18nConfig' // 引入配置文件
import { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  return i18nRouter(request, i18nConfig)
}

// 配置只适用于中间件的路由
export const config = {
  matcher: '/((?!api|static|.*\\..*|_next).*)',
}
