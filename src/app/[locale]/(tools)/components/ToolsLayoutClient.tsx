'use client'

import { AnimatePresence, motion } from 'framer-motion'
import {
  ArrowLeftRight,
  ChevronRight,
  Github,
  Laptop,
  Menu,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  Sun
} from 'lucide-react'
import { usePathname } from 'next/navigation'
import { useRouter } from 'nextjs-toploader/app'
import React, { useMemo, useState } from 'react'
import { flushSync } from 'react-dom'
import { useTranslation } from 'react-i18next'

import { MeshGradient } from '@/components/effects/MeshGradient'
import { type ThemeMode, useTheme } from '@/components/ThemeProvider'
import TransitionLayout from '@/components/TransitionLayout'
import { type MenuConfig, menus } from '@/config/menus'
import { cn } from '@/lib/utils'

type ViewTransitionDocument = Document & {
  startViewTransition?: (callback: () => void) => { finished: Promise<void> }
}

type DirectionMode = 'ltr' | 'rtl'

const UI_LANGUAGE_STORAGE_KEY = 'ui-language'
const UI_DIRECTION_STORAGE_KEY = 'ui-direction'
const UI_SIDEBAR_COLLAPSED_STORAGE_KEY = 'ui-sidebar-collapsed'
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
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
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

  React.useLayoutEffect(() => {
    const savedSidebarState = window.localStorage.getItem(UI_SIDEBAR_COLLAPSED_STORAGE_KEY)

    if (savedSidebarState === 'true') {
      setSidebarCollapsed(true)
    }
  }, [])

  React.useEffect(() => {
    document.documentElement.setAttribute('dir', direction)
    window.localStorage.setItem(UI_DIRECTION_STORAGE_KEY, direction)
  }, [direction])

  React.useEffect(() => {
    window.localStorage.setItem(
      UI_SIDEBAR_COLLAPSED_STORAGE_KEY,
      sidebarCollapsed ? 'true' : 'false'
    )
  }, [sidebarCollapsed])

  React.useEffect(() => {
    const savedLanguage = window.localStorage.getItem(UI_LANGUAGE_STORAGE_KEY)

    if (isSupportedLanguage(savedLanguage) && savedLanguage !== language) {
      void changeLanguage(savedLanguage)
    }
  }, [changeLanguage, language])

  React.useEffect(() => {
    document.documentElement.setAttribute('lang', language === 'cn' ? 'zh-CN' : 'en')
  }, [language])

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

  const handleCategoryAction = (category: MenuConfig, collapsedView: boolean) => {
    if (collapsedView && category.children?.[0]) {
      handleNavigate(category.children[0].path)
      return
    }

    if (category.children?.length) {
      toggleCategory(category.path)
      return
    }

    handleNavigate(category.path)
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

  const currentTitle = breadcrumbs[breadcrumbs.length - 1]?.label ?? 'Daily Tools'
  const collapseLabel = sidebarCollapsed ? t('public.expand_sidebar') : t('public.collapse_sidebar')

  const renderNavigation = (collapsedView = false) => (
    <nav
      className={cn('flex-1 overflow-y-auto py-4', collapsedView ? 'px-2' : 'px-3 sm:px-4')}
      aria-label={t('public.open_navigation')}
    >
      <div className={cn('flex flex-col', collapsedView ? 'gap-2.5' : 'gap-4')}>
        {menus.map(category => {
          const isExpanded = expandedCategory === category.path
          const isActive = currentCategory === category.path
          const categoryLabel = t(`app${category.path.replaceAll('/', '.')}`)

          return (
            <div key={category.path} className="min-w-0">
              <button
                type="button"
                onClick={() => handleCategoryAction(category, collapsedView)}
                aria-expanded={!collapsedView && category.children ? isExpanded : undefined}
                aria-current={isActive ? 'page' : undefined}
                aria-label={categoryLabel}
                title={categoryLabel}
                className={cn(
                  'group relative flex min-h-11 w-full items-center rounded-2xl text-sm font-medium transition-[background-color,color,box-shadow,transform] duration-200',
                  collapsedView ? 'justify-center px-0' : 'gap-3 px-3.5',
                  isActive
                    ? 'bg-[var(--glass-bg-active)] text-[var(--primary)] shadow-[inset_0_1px_0_rgba(255,255,255,0.22),0_10px_28px_rgba(0,113,227,0.12)]'
                    : 'text-[var(--text-secondary)] hover:bg-[var(--glass-bg-hover)] hover:text-[var(--text-primary)]'
                )}
              >
                <span
                  className={cn(
                    'grid h-8 w-8 shrink-0 place-items-center rounded-xl transition-colors',
                    isActive
                      ? 'bg-[var(--primary-subtle)] text-[var(--primary)]'
                      : 'bg-[var(--glass-input-bg)] text-[var(--text-tertiary)] group-hover:text-[var(--text-primary)]'
                  )}
                >
                  {category.icon}
                </span>

                {!collapsedView && (
                  <>
                    <span className="min-w-0 flex-1 truncate text-left">{categoryLabel}</span>
                    {category.children && (
                      <ChevronRight
                        className={cn(
                          'h-4 w-4 shrink-0 text-[var(--text-tertiary)] transition-transform',
                          isExpanded && 'rotate-90'
                        )}
                        aria-hidden="true"
                      />
                    )}
                  </>
                )}
              </button>

              <AnimatePresence initial={false}>
                {!collapsedView && isExpanded && category.children && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
                    className="overflow-hidden"
                  >
                    <div className="ml-6 mt-2 space-y-1 border-l border-[var(--border-subtle)] pl-3">
                      {category.children.map(child => {
                        const isChildActive = pathname === child.path
                        const childLabel = t(`app${child.path.replaceAll('/', '.')}`)

                        return (
                          <button
                            key={child.path}
                            type="button"
                            onClick={() => handleNavigate(child.path)}
                            aria-current={isChildActive ? 'page' : undefined}
                            title={childLabel}
                            className={cn(
                              'flex min-h-9 w-full min-w-0 items-center rounded-xl px-3 text-left text-sm transition-[background-color,color,transform]',
                              isChildActive
                                ? 'bg-[var(--primary-subtle)] font-medium text-[var(--primary)]'
                                : 'text-[var(--text-secondary)] hover:bg-[var(--glass-bg-hover)] hover:text-[var(--text-primary)]'
                            )}
                          >
                            <span className="truncate">{childLabel}</span>
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
      </div>
    </nav>
  )

  return (
    <div className="relative isolate flex h-screen w-full overflow-hidden">
      <MeshGradient />

      <aside
        className="relative z-10 hidden h-full shrink-0 flex-col overflow-hidden border-r border-[var(--glass-border-strong)] glass-panel-strong transition-[width] duration-300 ease-out lg:flex"
        style={{
          width: sidebarCollapsed ? 'var(--sidebar-collapsed)' : 'var(--sidebar-width)'
        }}
      >
        <div className="glass-specular" />

        <div
          className={cn(
            'flex h-20 shrink-0 items-center border-b border-[var(--glass-border)] px-3',
            sidebarCollapsed ? 'justify-center' : 'gap-3 px-4'
          )}
        >
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl border border-[var(--glass-border-strong)] bg-[var(--primary)] text-sm font-semibold text-white shadow-[0_14px_34px_rgba(0,113,227,0.22)]">
            DT
          </div>
          {!sidebarCollapsed && (
            <div className="min-w-0">
              <h1
                className="truncate text-[15px] font-semibold leading-tight text-[var(--text-primary)]"
                translate="no"
              >
                Daily Tools
              </h1>
              <p className="mt-1 truncate text-xs text-[var(--text-tertiary)]" translate="no">
                GarlandQian
              </p>
            </div>
          )}
        </div>

        {renderNavigation(sidebarCollapsed)}

        <div className={cn('shrink-0 border-t border-[var(--glass-border)] p-3')}>
          <button
            type="button"
            onClick={() => setSidebarCollapsed(current => !current)}
            aria-label={collapseLabel}
            title={collapseLabel}
            className={cn(
              'flex h-10 w-full items-center rounded-2xl text-sm font-medium text-[var(--text-secondary)] transition-[background-color,color] hover:bg-[var(--glass-bg-hover)] hover:text-[var(--text-primary)]',
              sidebarCollapsed ? 'justify-center px-0' : 'gap-2.5 px-3'
            )}
          >
            {sidebarCollapsed ? (
              <PanelLeftOpen className="h-4 w-4" aria-hidden="true" />
            ) : (
              <PanelLeftClose className="h-4 w-4" aria-hidden="true" />
            )}
            {!sidebarCollapsed && <span className="truncate">{collapseLabel}</span>}
          </button>
        </div>
      </aside>

      <AnimatePresence>
        {sidebarOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSidebarOpen(false)}
              className="fixed inset-0 z-40 bg-black/45 backdrop-blur-sm lg:hidden"
            />
            <motion.aside
              initial={{ x: -308 }}
              animate={{ x: 0 }}
              exit={{ x: -308 }}
              transition={{ type: 'spring', damping: 28, stiffness: 230 }}
              className="fixed bottom-0 left-0 top-0 z-50 flex w-[19.25rem] max-w-[calc(100vw-1.5rem)] flex-col overflow-hidden border-r border-[var(--glass-border-strong)] glass-panel-strong lg:hidden"
            >
              <div className="glass-specular" />

              <div className="flex h-20 shrink-0 items-center gap-3 border-b border-[var(--glass-border)] px-5">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl border border-[var(--glass-border-strong)] bg-[var(--primary)] text-sm font-semibold text-white">
                  DT
                </div>
                <div className="min-w-0">
                  <h1
                    className="truncate text-[15px] font-semibold leading-tight text-[var(--text-primary)]"
                    translate="no"
                  >
                    Daily Tools
                  </h1>
                  <p className="mt-1 truncate text-xs text-[var(--text-tertiary)]" translate="no">
                    GarlandQian
                  </p>
                </div>
              </div>

              {renderNavigation(false)}
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      <div className="relative z-10 flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="relative border-b border-[var(--glass-border)] glass-panel">
          <div className="glass-specular" />
          <div className="flex h-[var(--header-height)] items-center justify-between gap-3 px-4 sm:px-5 lg:px-7">
            <div className="flex min-w-0 items-center gap-3">
              <button
                type="button"
                onClick={() => setSidebarOpen(true)}
                className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl text-[var(--text-secondary)] transition-[background-color,color] hover:bg-[var(--glass-bg-hover)] hover:text-[var(--text-primary)] lg:hidden"
                aria-label={t('public.open_navigation')}
              >
                <Menu className="h-5 w-5" aria-hidden="true" />
              </button>

              <div className="min-w-0">
                <div className="hidden text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--text-tertiary)] sm:block">
                  Daily Tools
                </div>
                <div className="mt-0.5 flex min-w-0 items-center gap-1.5 text-sm">
                  {breadcrumbs.length > 0 ? (
                    breadcrumbs.map((crumb, index) => (
                      <React.Fragment key={crumb.path}>
                        {index > 0 && (
                          <ChevronRight
                            className="h-3.5 w-3.5 shrink-0 text-[var(--text-tertiary)]"
                            aria-hidden="true"
                          />
                        )}
                        <button
                          type="button"
                          onClick={() => handleNavigate(crumb.path)}
                          className={cn(
                            'min-w-0 rounded-lg px-1.5 py-1 transition-[background-color,color] hover:bg-[var(--glass-bg-hover)]',
                            index === breadcrumbs.length - 1
                              ? 'truncate font-semibold text-[var(--text-primary)]'
                              : 'hidden text-[var(--text-secondary)] sm:block'
                          )}
                        >
                          <span className="truncate">{crumb.label}</span>
                        </button>
                      </React.Fragment>
                    ))
                  ) : (
                    <span className="truncate font-semibold text-[var(--text-primary)]">
                      {currentTitle}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
              <a
                href={process.env.NEXT_PUBLIC_GITHUB_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="hidden h-9 w-9 place-items-center rounded-2xl text-[var(--text-secondary)] transition-[background-color,color] hover:bg-[var(--glass-bg-hover)] hover:text-[var(--text-primary)] sm:grid"
                aria-label={t('public.open_github')}
              >
                <Github className="h-4 w-4" aria-hidden="true" />
              </a>

              <div className="flex items-center rounded-2xl p-1 glass-input">
                {themeOptions.map(option => {
                  const isActive = themeMode === option.mode

                  return (
                    <button
                      key={option.mode}
                      type="button"
                      onClick={event => handleThemeChange(option.mode, event)}
                      aria-label={option.label}
                      aria-pressed={isActive}
                      title={option.label}
                      className={cn(
                        'relative grid h-8 w-8 place-items-center overflow-hidden rounded-xl text-[var(--text-secondary)] transition-[color,background-color] duration-300',
                        isActive
                          ? 'text-white'
                          : 'hover:bg-[var(--glass-bg-hover)] hover:text-[var(--text-primary)]'
                      )}
                    >
                      {isActive && (
                        <motion.span
                          layoutId="theme-toggle-indicator"
                          className="absolute inset-0 rounded-xl bg-[var(--primary)] shadow-[0_8px_20px_rgba(0,113,227,0.26)]"
                          transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                        />
                      )}
                      <span className="relative z-10">{option.icon}</span>
                    </button>
                  )
                })}
              </div>

              <button
                type="button"
                onClick={handleLanguageChange}
                className="h-9 rounded-2xl px-3 text-sm font-semibold transition-[background-color,color] hover:bg-[var(--glass-bg-hover)] glass-input"
                aria-label={t('public.switch_language')}
              >
                {language === 'cn' ? '中' : 'EN'}
              </button>

              <button
                type="button"
                onClick={handleDirectionChange}
                className="flex h-9 items-center gap-1.5 rounded-2xl px-3 text-sm font-semibold transition-[background-color,color] hover:bg-[var(--glass-bg-hover)] glass-input"
                aria-label={t('public.switch_direction')}
                aria-pressed={direction === 'rtl'}
                title={t('public.switch_direction')}
              >
                <ArrowLeftRight className="h-4 w-4" aria-hidden="true" />
                <span className="hidden sm:inline">{direction.toUpperCase()}</span>
              </button>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-x-hidden overflow-y-auto bg-transparent px-4 py-5 sm:px-6 lg:px-8 lg:py-7">
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
      </div>
    </div>
  )
}

export default ToolsLayoutClient
