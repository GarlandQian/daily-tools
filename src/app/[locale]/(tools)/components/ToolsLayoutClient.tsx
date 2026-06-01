'use client'

import { AnimatePresence, motion } from 'framer-motion'
import { ChevronRight, Github, Laptop, Menu, Moon, Sun } from 'lucide-react'
import { usePathname } from 'next/navigation'
import { useRouter } from 'nextjs-toploader/app'
import React, { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { MeshGradient } from '@/components/effects/MeshGradient'
import { useTheme } from '@/components/ThemeProvider'
import TransitionLayout from '@/components/TransitionLayout'
import { menus } from '@/config/menus'
import { cn } from '@/lib/utils'

const ToolsLayoutClient = ({ children }: { children: React.ReactNode }) => {
  const { themeMode, setThemeMode } = useTheme()
  const router = useRouter()
  const pathname = usePathname()
  const {
    t,
    i18n: { language, changeLanguage }
  } = useTranslation()

  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null)

  // Get current category and breadcrumbs
  const { currentCategory, breadcrumbs } = useMemo(() => {
    const pathParts = pathname.split('/').filter(Boolean)
    const category = pathParts.length > 0 ? `/${pathParts[0]}` : null
    const crumbs = pathParts.map((_part, index) => {
      const path = `/${pathParts.slice(0, index + 1).join('/')}`
      const key = `app.${pathParts.slice(0, index + 1).join('.')}`
      return { path, label: t(key) }
    })
    return { currentCategory: category, breadcrumbs: crumbs }
  }, [pathname, t])

  // Auto-expand current category
  React.useEffect(() => {
    if (currentCategory && !expandedCategory) {
      setExpandedCategory(currentCategory)
    }
  }, [currentCategory, expandedCategory])

  const handleNavigate = (path: string) => {
    router.push(path)
    setSidebarOpen(false)
  }

  const toggleCategory = (path: string) => {
    setExpandedCategory(expandedCategory === path ? null : path)
  }

  return (
    <div className="flex h-screen w-full overflow-hidden">
      {/* Animated mesh gradient background */}
      <MeshGradient />

      {/* Sidebar - Desktop */}
      <aside className="hidden lg:flex w-64 flex-col glass-panel-strong border-r border-[var(--glass-border-strong)] relative">
        <div className="glass-specular" />

        {/* Logo */}
        <div className="p-6 border-b border-[var(--glass-border)]">
          <h1 className="text-xl font-semibold text-[var(--text-primary)]">Daily Tools</h1>
          <p className="text-xs text-[var(--text-tertiary)] mt-1">by GarlandQian</p>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto p-4 space-y-1">
          {menus.map(category => {
            const isExpanded = expandedCategory === category.path
            const isActive = currentCategory === category.path

            return (
              <div key={category.path}>
                <button
                  onClick={() => toggleCategory(category.path)}
                  className={cn(
                    'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                    'hover:bg-[var(--glass-bg-hover)]',
                    isActive && 'bg-[var(--glass-bg-active)] text-[var(--primary)]'
                  )}
                >
                  {category.icon}
                  <span className="flex-1 text-left">
                    {t(`app${category.path.replaceAll('/', '.')}`)}
                  </span>
                  <ChevronRight
                    className={cn('w-4 h-4 transition-transform', isExpanded && 'rotate-90')}
                  />
                </button>

                <AnimatePresence>
                  {isExpanded && category.children && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="ml-7 mt-1 space-y-0.5 border-l border-[var(--border-subtle)] pl-3">
                        {category.children.map(child => {
                          const isChildActive = pathname === child.path
                          return (
                            <button
                              key={child.path}
                              onClick={() => handleNavigate(child.path)}
                              className={cn(
                                'w-full text-left px-3 py-1.5 rounded-md text-sm transition-colors',
                                'hover:bg-[var(--glass-bg-hover)]',
                                isChildActive
                                  ? 'text-[var(--primary)] font-medium bg-[var(--primary-subtle)]'
                                  : 'text-[var(--text-secondary)]'
                              )}
                            >
                              {t(`app${child.path.replaceAll('/', '.')}`)}
                            </button>
                          )
                        })}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )
          })}
        </nav>
      </aside>

      {/* Mobile Sidebar Overlay */}
      <AnimatePresence>
        {sidebarOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSidebarOpen(false)}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 lg:hidden"
            />
            <motion.aside
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed left-0 top-0 bottom-0 w-64 glass-panel-strong border-r border-[var(--glass-border-strong)] z-50 lg:hidden flex flex-col"
            >
              <div className="glass-specular" />

              <div className="p-6 border-b border-[var(--glass-border)]">
                <h1 className="text-xl font-semibold text-[var(--text-primary)]">Daily Tools</h1>
                <p className="text-xs text-[var(--text-tertiary)] mt-1">by GarlandQian</p>
              </div>

              <nav className="flex-1 overflow-y-auto p-4 space-y-1">
                {menus.map(category => {
                  const isExpanded = expandedCategory === category.path
                  const isActive = currentCategory === category.path

                  return (
                    <div key={category.path}>
                      <button
                        onClick={() => toggleCategory(category.path)}
                        className={cn(
                          'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                          'hover:bg-[var(--glass-bg-hover)]',
                          isActive && 'bg-[var(--glass-bg-active)] text-[var(--primary)]'
                        )}
                      >
                        {category.icon}
                        <span className="flex-1 text-left">
                          {t(`app${category.path.replaceAll('/', '.')}`)}
                        </span>
                        <ChevronRight
                          className={cn('w-4 h-4 transition-transform', isExpanded && 'rotate-90')}
                        />
                      </button>

                      <AnimatePresence>
                        {isExpanded && category.children && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="overflow-hidden"
                          >
                            <div className="ml-7 mt-1 space-y-0.5 border-l border-[var(--border-subtle)] pl-3">
                              {category.children.map(child => {
                                const isChildActive = pathname === child.path
                                return (
                                  <button
                                    key={child.path}
                                    onClick={() => handleNavigate(child.path)}
                                    className={cn(
                                      'w-full text-left px-3 py-1.5 rounded-md text-sm transition-colors',
                                      'hover:bg-[var(--glass-bg-hover)]',
                                      isChildActive
                                        ? 'text-[var(--primary)] font-medium bg-[var(--primary-subtle)]'
                                        : 'text-[var(--text-secondary)]'
                                    )}
                                  >
                                    {t(`app${child.path.replaceAll('/', '.')}`)}
                                  </button>
                                )
                              })}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  )
                })}
              </nav>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Bar */}
        <header className="glass-panel border-b border-[var(--glass-border)] relative">
          <div className="glass-specular" />
          <div className="flex items-center justify-between h-14 px-4 lg:px-6">
            {/* Left: Mobile Menu + Breadcrumbs */}
            <div className="flex items-center gap-4">
              <button
                onClick={() => setSidebarOpen(true)}
                className="lg:hidden p-2 hover:bg-[var(--glass-bg-hover)] rounded-lg transition-colors"
                aria-label="Open navigation"
              >
                <Menu className="w-5 h-5" />
              </button>

              {/* Breadcrumbs */}
              <div className="hidden sm:flex items-center gap-2 text-sm">
                {breadcrumbs.map((crumb, index) => (
                  <React.Fragment key={crumb.path}>
                    {index > 0 && <ChevronRight className="w-4 h-4 text-[var(--text-tertiary)]" />}
                    <button
                      onClick={() => handleNavigate(crumb.path)}
                      className={cn(
                        'px-2 py-1 rounded-md transition-colors hover:bg-[var(--glass-bg-hover)]',
                        index === breadcrumbs.length - 1
                          ? 'text-[var(--text-primary)] font-medium'
                          : 'text-[var(--text-secondary)]'
                      )}
                    >
                      {crumb.label}
                    </button>
                  </React.Fragment>
                ))}
              </div>
            </div>

            {/* Right: Actions */}
            <div className="flex items-center gap-2">
              {/* GitHub */}
              <a
                href={process.env.NEXT_PUBLIC_GITHUB_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 hover:bg-[var(--glass-bg-hover)] rounded-lg transition-colors"
                aria-label="Open GitHub repository"
              >
                <Github className="w-5 h-5" />
              </a>

              {/* Theme Toggle */}
              <div className="flex items-center glass-input rounded-lg p-1">
                <button
                  onClick={() => setThemeMode('light')}
                  aria-label={t('app.theme.light')}
                  className={cn(
                    'p-1.5 rounded-md transition-colors',
                    themeMode === 'light' && 'bg-[var(--primary)] text-white'
                  )}
                >
                  <Sun className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setThemeMode('dark')}
                  aria-label={t('app.theme.dark')}
                  className={cn(
                    'p-1.5 rounded-md transition-colors',
                    themeMode === 'dark' && 'bg-[var(--primary)] text-white'
                  )}
                >
                  <Moon className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setThemeMode('system')}
                  aria-label={t('app.theme.system')}
                  className={cn(
                    'p-1.5 rounded-md transition-colors',
                    themeMode === 'system' && 'bg-[var(--primary)] text-white'
                  )}
                >
                  <Laptop className="w-4 h-4" />
                </button>
              </div>

              {/* Language Toggle */}
              <button
                onClick={() => changeLanguage(language === 'cn' ? 'en' : 'cn')}
                className="px-3 py-1.5 glass-input rounded-lg text-sm font-medium hover:bg-[var(--glass-bg-hover)] transition-colors"
                aria-label="Switch language"
              >
                {language === 'cn' ? '中' : 'EN'}
              </button>
            </div>
          </div>
        </header>

        {/* Content Area */}
        <main className="flex-1 overflow-auto p-4 lg:p-6 bg-transparent">
          <TransitionLayout
            style={{
              maxWidth: 'var(--content-max)',
              margin: '0 auto',
              width: '100%'
            }}
          >
            {children}
          </TransitionLayout>
        </main>

        {/* Footer */}
        <footer className="glass-panel border-t border-[var(--glass-border)] py-4 px-6 text-center text-sm text-[var(--text-tertiary)]">
          Tools ©2024-{new Date().getFullYear()} Created by GarlandQian
        </footer>
      </div>
    </div>
  )
}

export default ToolsLayoutClient
