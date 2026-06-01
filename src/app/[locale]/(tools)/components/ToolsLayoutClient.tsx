'use client'

import { AnimatePresence, motion } from 'framer-motion'
import { ArrowLeftRight, ChevronRight, Github, Laptop, Menu, Moon, Sun } from 'lucide-react'
import { usePathname } from 'next/navigation'
import { useRouter } from 'nextjs-toploader/app'
import React, { useMemo, useState } from 'react'
import { flushSync } from 'react-dom'
import { useTranslation } from 'react-i18next'

import { MeshGradient } from '@/components/effects/MeshGradient'
import { type ThemeMode, useTheme } from '@/components/ThemeProvider'
import TransitionLayout from '@/components/TransitionLayout'
import { menus } from '@/config/menus'
import { cn } from '@/lib/utils'

type ViewTransitionDocument = Document & {
  startViewTransition?: (callback: () => void) => { finished: Promise<void> }
}

type DirectionMode = 'ltr' | 'rtl'

const UI_LANGUAGE_STORAGE_KEY = 'ui-language'
const UI_DIRECTION_STORAGE_KEY = 'ui-direction'
const RANDOM_EFFECT_SELECTOR =
  '.glass-panel, .glass-panel-strong, .glass-float, .glass-specular, .glass-caustic, .glass-prism, .glass-shimmer'

const randomBetween = (min: number, max: number) => min + Math.random() * (max - min)

const setRandomEffectVars = (element: HTMLElement) => {
  element.style.setProperty('--fx-border-delay', `-${randomBetween(0, 6).toFixed(2)}s`)
  element.style.setProperty('--fx-border-duration', `${randomBetween(5.2, 8.6).toFixed(2)}s`)
  element.style.setProperty('--fx-border-direction', Math.random() > 0.5 ? 'normal' : 'reverse')
  element.style.setProperty('--fx-specular-delay', `-${randomBetween(0, 4).toFixed(2)}s`)
  element.style.setProperty('--fx-specular-duration', `${randomBetween(3.4, 5.8).toFixed(2)}s`)
  element.style.setProperty(
    '--fx-specular-direction',
    Math.random() > 0.5 ? 'normal' : 'alternate-reverse'
  )
  element.style.setProperty('--fx-caustic-delay', `-${randomBetween(0, 8).toFixed(2)}s`)
  element.style.setProperty('--fx-caustic-duration', `${randomBetween(7, 11).toFixed(2)}s`)
  element.style.setProperty('--fx-caustic-direction', Math.random() > 0.5 ? 'normal' : 'reverse')
  element.style.setProperty('--fx-prism-delay', `-${randomBetween(0, 14).toFixed(2)}s`)
  element.style.setProperty('--fx-prism-duration', `${randomBetween(11, 18).toFixed(2)}s`)
  element.style.setProperty('--fx-prism-x0', `${randomBetween(-12, -4).toFixed(2)}%`)
  element.style.setProperty('--fx-prism-y0', `${randomBetween(-10, -2).toFixed(2)}%`)
  element.style.setProperty('--fx-prism-x1', `${randomBetween(4, 12).toFixed(2)}%`)
  element.style.setProperty('--fx-prism-y1', `${randomBetween(1, 8).toFixed(2)}%`)
  element.style.setProperty('--fx-prism-x2', `${randomBetween(-6, 4).toFixed(2)}%`)
  element.style.setProperty('--fx-prism-y2', `${randomBetween(6, 14).toFixed(2)}%`)
  const prismRotation = randomBetween(3, 8)
  element.style.setProperty('--fx-prism-rotation', `${prismRotation.toFixed(2)}deg`)
  element.style.setProperty(
    '--fx-prism-rotation-reverse',
    `${(-prismRotation * 0.8).toFixed(2)}deg`
  )
  element.style.setProperty('--fx-shimmer-delay', `-${randomBetween(0, 10).toFixed(2)}s`)
  element.style.setProperty('--fx-shimmer-duration', `${randomBetween(8, 14).toFixed(2)}s`)
  element.style.setProperty('--fx-shimmer-angle', `${randomBetween(88, 122).toFixed(2)}deg`)
  element.style.setProperty('--fx-shimmer-direction', Math.random() > 0.5 ? 'normal' : 'reverse')
}

const isDirectionMode = (value: string | null): value is DirectionMode =>
  value === 'ltr' || value === 'rtl'

const isSupportedLanguage = (value: string | null): value is 'cn' | 'en' =>
  value === 'cn' || value === 'en'

const useRandomizedGlassEffects = () => {
  React.useLayoutEffect(() => {
    const initialized = new WeakSet<HTMLElement>()

    const applyElement = (element: HTMLElement) => {
      if (initialized.has(element)) return
      initialized.add(element)
      setRandomEffectVars(element)
    }

    const applyTree = (root: ParentNode) => {
      root.querySelectorAll<HTMLElement>(RANDOM_EFFECT_SELECTOR).forEach(applyElement)
    }

    applyTree(document)

    const observer = new MutationObserver(mutations => {
      mutations.forEach(mutation => {
        mutation.addedNodes.forEach(node => {
          if (!(node instanceof HTMLElement)) return
          if (node.matches(RANDOM_EFFECT_SELECTOR)) {
            applyElement(node)
          }
          applyTree(node)
        })
      })
    })

    observer.observe(document.body, { childList: true, subtree: true })
    return () => observer.disconnect()
  }, [])
}

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
  const [direction, setDirection] = useState<DirectionMode>('ltr')

  useRandomizedGlassEffects()

  React.useLayoutEffect(() => {
    const savedDirection = window.localStorage.getItem(UI_DIRECTION_STORAGE_KEY)
    const nextDirection = isDirectionMode(savedDirection) ? savedDirection : 'ltr'
    document.documentElement.setAttribute('dir', nextDirection)

    if (nextDirection !== direction) {
      setDirection(nextDirection)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  React.useEffect(() => {
    document.documentElement.setAttribute('dir', direction)
    window.localStorage.setItem(UI_DIRECTION_STORAGE_KEY, direction)
  }, [direction])

  React.useEffect(() => {
    const savedLanguage = window.localStorage.getItem(UI_LANGUAGE_STORAGE_KEY)

    if (isSupportedLanguage(savedLanguage) && savedLanguage !== language) {
      void changeLanguage(savedLanguage)
    }
  }, [changeLanguage, language])

  React.useEffect(() => {
    document.documentElement.setAttribute('lang', language === 'cn' ? 'zh-CN' : 'en')
  }, [language])

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

  const handleLanguageChange = () => {
    const nextLanguage = language === 'cn' ? 'en' : 'cn'
    window.localStorage.setItem(UI_LANGUAGE_STORAGE_KEY, nextLanguage)
    void changeLanguage(nextLanguage)
  }

  const handleDirectionChange = () => {
    setDirection(current => (current === 'ltr' ? 'rtl' : 'ltr'))
  }

  const handleThemeChange = (mode: ThemeMode, event: React.MouseEvent<HTMLButtonElement>) => {
    if (mode === themeMode) return

    const root = document.documentElement
    root.style.setProperty('--theme-transition-x', `${event.clientX}px`)
    root.style.setProperty('--theme-transition-y', `${event.clientY}px`)

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const startViewTransition = (document as ViewTransitionDocument).startViewTransition?.bind(
      document
    )

    const runFallbackTransition = () => {
      root.classList.add('theme-transitioning')
      setThemeMode(mode)
      window.setTimeout(() => root.classList.remove('theme-transitioning'), 620)
    }

    if (startViewTransition && !prefersReducedMotion) {
      root.classList.add('theme-view-transition')

      try {
        const transition = startViewTransition(() => {
          flushSync(() => setThemeMode(mode))
        })
        const cleanup = () => root.classList.remove('theme-view-transition')

        transition.finished.finally(cleanup)
        window.setTimeout(cleanup, 900)
      } catch {
        root.classList.remove('theme-view-transition')
        runFallbackTransition()
      }
      return
    }

    runFallbackTransition()
  }

  const themeOptions: Array<{
    icon: React.ReactNode
    label: string
    mode: ThemeMode
  }> = [
    { mode: 'light', label: t('app.theme.light'), icon: <Sun className="h-4 w-4" /> },
    { mode: 'dark', label: t('app.theme.dark'), icon: <Moon className="h-4 w-4" /> },
    { mode: 'system', label: t('app.theme.system'), icon: <Laptop className="h-4 w-4" /> }
  ]

  return (
    <div className="relative isolate flex h-screen w-full overflow-hidden">
      {/* Animated mesh gradient background */}
      <MeshGradient />

      {/* Sidebar - Desktop */}
      <aside className="relative z-10 hidden w-64 flex-col border-r border-[var(--glass-border-strong)] glass-panel-strong lg:flex">
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
      <div className="relative z-10 flex flex-1 flex-col overflow-hidden">
        {/* Top Bar */}
        <header className="glass-panel border-b border-[var(--glass-border)] relative">
          <div className="glass-specular" />
          <div className="flex items-center justify-between h-14 px-4 lg:px-6">
            {/* Left: Mobile Menu + Breadcrumbs */}
            <div className="flex items-center gap-4">
              <button
                onClick={() => setSidebarOpen(true)}
                className="lg:hidden p-2 hover:bg-[var(--glass-bg-hover)] rounded-lg transition-colors"
                aria-label={t('public.open_navigation')}
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
                aria-label={t('public.open_github')}
              >
                <Github className="w-5 h-5" />
              </a>

              {/* Theme Toggle */}
              <div className="flex items-center glass-input rounded-lg p-1">
                {themeOptions.map(option => {
                  const isActive = themeMode === option.mode

                  return (
                    <button
                      key={option.mode}
                      onClick={event => handleThemeChange(option.mode, event)}
                      aria-label={option.label}
                      aria-pressed={isActive}
                      className={cn(
                        'relative grid h-8 w-8 place-items-center overflow-hidden rounded-md text-[var(--text-secondary)] transition-colors duration-300',
                        isActive
                          ? 'text-white'
                          : 'hover:bg-[var(--glass-bg-hover)] hover:text-[var(--text-primary)]'
                      )}
                    >
                      {isActive && (
                        <motion.span
                          layoutId="theme-toggle-indicator"
                          className="absolute inset-0 rounded-md bg-[var(--primary)] shadow-[0_8px_20px_rgba(0,113,227,0.26)]"
                          transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                        />
                      )}
                      <span className="relative z-10">{option.icon}</span>
                    </button>
                  )
                })}
              </div>

              {/* Language Toggle */}
              <button
                onClick={handleLanguageChange}
                className="px-3 py-1.5 glass-input rounded-lg text-sm font-medium hover:bg-[var(--glass-bg-hover)] transition-colors"
                aria-label={t('public.switch_language')}
              >
                {language === 'cn' ? '中' : 'EN'}
              </button>

              {/* Direction Toggle */}
              <button
                onClick={handleDirectionChange}
                className="flex items-center gap-1.5 px-3 py-1.5 glass-input rounded-lg text-sm font-medium hover:bg-[var(--glass-bg-hover)] transition-colors"
                aria-label={t('public.switch_direction')}
                aria-pressed={direction === 'rtl'}
              >
                <ArrowLeftRight className="h-4 w-4" />
                {direction.toUpperCase()}
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
