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
  Search,
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
import {
  buildMenuLabelMap,
  buildToolSearchItems,
  findMenuMatch,
  getMenuLabel,
  isPathMatch,
  resolveNavigableMenuPath
} from '@/config/menu-utils'
import { type MenuConfig, menus } from '@/config/menus'
import { cn } from '@/lib/utils'

import { ToolCommandPalette } from './ToolCommandPalette'

type ViewTransitionDocument = Document & {
  startViewTransition?: (callback: () => void) => { finished: Promise<void> }
}

type DirectionMode = 'ltr' | 'rtl'

const UI_LANGUAGE_STORAGE_KEY = 'ui-language'
const UI_DIRECTION_STORAGE_KEY = 'ui-direction'
const UI_SIDEBAR_COLLAPSED_STORAGE_KEY = 'ui-sidebar-collapsed'
const UI_RECENT_TOOLS_STORAGE_KEY = 'ui-recent-tools'
const MAX_RECENT_TOOLS = 6
const RANDOM_EFFECT_MARKER = 'glassRandomized'
const RANDOM_EFFECT_SELECTOR =
  '.glass-panel, .glass-panel-strong, .glass-float, .glass-specular, .glass-caustic, .glass-prism, .glass-shimmer'

type IdleWindow = Window & {
  cancelIdleCallback?: (handle: number) => void
  requestIdleCallback?: (
    callback: (deadline: { didTimeout: boolean; timeRemaining: () => number }) => void,
    options?: { timeout: number }
  ) => number
}

const randomBetween = (min: number, max: number) => min + Math.random() * (max - min)

const setRandomEffectVars = (element: HTMLElement) => {
  const prismRotation = randomBetween(3, 8)

  element.style.cssText += `;${[
    `--fx-border-delay:-${randomBetween(0, 6).toFixed(2)}s`,
    `--fx-border-duration:${randomBetween(5.2, 8.6).toFixed(2)}s`,
    `--fx-border-direction:${Math.random() > 0.5 ? 'normal' : 'reverse'}`,
    `--fx-specular-delay:-${randomBetween(0, 4).toFixed(2)}s`,
    `--fx-specular-duration:${randomBetween(3.4, 5.8).toFixed(2)}s`,
    `--fx-specular-direction:${Math.random() > 0.5 ? 'normal' : 'alternate-reverse'}`,
    `--fx-caustic-delay:-${randomBetween(0, 8).toFixed(2)}s`,
    `--fx-caustic-duration:${randomBetween(7, 11).toFixed(2)}s`,
    `--fx-caustic-direction:${Math.random() > 0.5 ? 'normal' : 'reverse'}`,
    `--fx-prism-delay:-${randomBetween(0, 14).toFixed(2)}s`,
    `--fx-prism-duration:${randomBetween(11, 18).toFixed(2)}s`,
    `--fx-prism-x0:${randomBetween(-12, -4).toFixed(2)}%`,
    `--fx-prism-y0:${randomBetween(-10, -2).toFixed(2)}%`,
    `--fx-prism-x1:${randomBetween(4, 12).toFixed(2)}%`,
    `--fx-prism-y1:${randomBetween(1, 8).toFixed(2)}%`,
    `--fx-prism-x2:${randomBetween(-6, 4).toFixed(2)}%`,
    `--fx-prism-y2:${randomBetween(6, 14).toFixed(2)}%`,
    `--fx-prism-rotation:${prismRotation.toFixed(2)}deg`,
    `--fx-prism-rotation-reverse:${(-prismRotation * 0.8).toFixed(2)}deg`,
    `--fx-shimmer-delay:-${randomBetween(0, 10).toFixed(2)}s`,
    `--fx-shimmer-duration:${randomBetween(8, 14).toFixed(2)}s`,
    `--fx-shimmer-angle:${randomBetween(88, 122).toFixed(2)}deg`,
    `--fx-shimmer-direction:${Math.random() > 0.5 ? 'normal' : 'reverse'}`
  ].join(';')};`
}

const isDirectionMode = (value: string | null): value is DirectionMode =>
  value === 'ltr' || value === 'rtl'

const isSupportedLanguage = (value: string | null): value is 'cn' | 'en' =>
  value === 'cn' || value === 'en'

const parseRecentToolPaths = (value: string | null) => {
  if (!value) return []

  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed)
      ? parsed.filter((path): path is string => typeof path === 'string')
      : []
  } catch {
    return []
  }
}

const isCommandShortcutIgnored = (target: EventTarget | null) => {
  if (!(target instanceof HTMLElement)) return false

  return Boolean(
    target.closest('input, textarea, select, [contenteditable="true"], [role="textbox"]')
  )
}

const useRandomizedGlassEffects = () => {
  React.useEffect(() => {
    const initialized = new WeakSet<HTMLElement>()
    const pending = new Set<HTMLElement>()
    const idleWindow = window as IdleWindow
    let idleHandle: number | null = null
    let timeoutHandle: number | null = null

    const applyElementNow = (element: HTMLElement) => {
      if (initialized.has(element) || element.dataset[RANDOM_EFFECT_MARKER] === 'true') return
      initialized.add(element)
      element.dataset[RANDOM_EFFECT_MARKER] = 'true'
      setRandomEffectVars(element)
    }

    const flushPending = (deadline?: { didTimeout: boolean; timeRemaining: () => number }) => {
      idleHandle = null
      timeoutHandle = null

      let processed = 0
      const hasBudget = () =>
        processed < 12 || !deadline || deadline.didTimeout || deadline.timeRemaining() > 2

      for (const element of pending) {
        if (!hasBudget()) break
        pending.delete(element)
        applyElementNow(element)
        processed += 1
      }

      if (pending.size > 0) scheduleFlush()
    }

    const scheduleFlush = () => {
      if (idleHandle !== null || timeoutHandle !== null) return

      if (typeof idleWindow.requestIdleCallback === 'function') {
        idleHandle = idleWindow.requestIdleCallback(flushPending, { timeout: 700 })
        return
      }

      timeoutHandle = window.setTimeout(() => flushPending(), 32)
    }

    const enqueueElement = (element: HTMLElement) => {
      if (initialized.has(element) || element.dataset[RANDOM_EFFECT_MARKER] === 'true') return
      pending.add(element)
      scheduleFlush()
    }

    const enqueueTree = (root: ParentNode) => {
      if (root instanceof HTMLElement && root.matches(RANDOM_EFFECT_SELECTOR)) {
        enqueueElement(root)
      }

      root.querySelectorAll<HTMLElement>(RANDOM_EFFECT_SELECTOR).forEach(enqueueElement)
    }

    enqueueTree(document.body)

    const observer = new MutationObserver(mutations => {
      mutations.forEach(mutation => {
        mutation.addedNodes.forEach(node => {
          if (!(node instanceof HTMLElement)) return
          enqueueTree(node)
        })
      })
    })

    observer.observe(document.body, { childList: true, subtree: true })
    return () => {
      observer.disconnect()
      pending.clear()
      if (idleHandle !== null && typeof idleWindow.cancelIdleCallback === 'function') {
        idleWindow.cancelIdleCallback(idleHandle)
      }
      if (timeoutHandle !== null) {
        window.clearTimeout(timeoutHandle)
      }
    }
  }, [])
}

const usePageVisibilityClass = () => {
  React.useEffect(() => {
    const root = document.documentElement

    const updateVisibilityClass = () => {
      root.classList.toggle('page-hidden', document.visibilityState === 'hidden')
    }

    updateVisibilityClass()
    document.addEventListener('visibilitychange', updateVisibilityClass)
    return () => {
      document.removeEventListener('visibilitychange', updateVisibilityClass)
      root.classList.remove('page-hidden')
    }
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
  const [commandOpen, setCommandOpen] = useState(false)
  const [recentToolPaths, setRecentToolPaths] = useState<string[]>([])

  useRandomizedGlassEffects()
  usePageVisibilityClass()

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

  const menuLabelByPath = useMemo(() => buildMenuLabelMap(t), [t])
  const toolSearchItems = useMemo(() => buildToolSearchItems(t), [t])
  const searchableToolPaths = useMemo(
    () => new Set(toolSearchItems.filter(item => !item.isCategory).map(item => item.path)),
    [toolSearchItems]
  )

  const { currentCategory, breadcrumbs } = useMemo(() => {
    const menuMatch = findMenuMatch(pathname)

    if (menuMatch) {
      const categoryCrumb = {
        path: menuMatch.category.path,
        label: menuLabelByPath.get(menuMatch.category.path) ?? getMenuLabel(menuMatch.category, t)
      }
      const crumbs = menuMatch.child
        ? [
            categoryCrumb,
            {
              path: menuMatch.child.path,
              label: menuLabelByPath.get(menuMatch.child.path) ?? getMenuLabel(menuMatch.child, t)
            }
          ]
        : [categoryCrumb]

      return { currentCategory: menuMatch.category.path, breadcrumbs: crumbs }
    }

    const pathParts = pathname.split('/').filter(Boolean)
    const category = pathParts.length > 0 ? `/${pathParts[0]}` : null
    const crumbs = pathParts.map((_part, index) => {
      const path = `/${pathParts.slice(0, index + 1).join('/')}`
      const key = `app.${pathParts.slice(0, index + 1).join('.')}`
      return { path, label: t(key) }
    })
    return { currentCategory: category, breadcrumbs: crumbs }
  }, [menuLabelByPath, pathname, t])

  React.useEffect(() => {
    if (currentCategory) {
      setExpandedCategory(currentCategory)
    }
  }, [currentCategory])

  React.useEffect(() => {
    setRecentToolPaths(
      parseRecentToolPaths(window.localStorage.getItem(UI_RECENT_TOOLS_STORAGE_KEY)).filter(path =>
        searchableToolPaths.has(path)
      )
    )
  }, [searchableToolPaths])

  const rememberToolPath = React.useCallback(
    (path: string) => {
      if (!searchableToolPaths.has(path)) return

      setRecentToolPaths(current => {
        const next = [path, ...current.filter(item => item !== path)].slice(0, MAX_RECENT_TOOLS)
        window.localStorage.setItem(UI_RECENT_TOOLS_STORAGE_KEY, JSON.stringify(next))
        return next
      })
    },
    [searchableToolPaths]
  )

  const handleNavigate = (path: string) => {
    rememberToolPath(path)
    router.push(path)
    setSidebarOpen(false)
    setCommandOpen(false)
  }

  const openCommandPalette = React.useCallback(() => {
    setSidebarOpen(false)
    setCommandOpen(true)
  }, [])

  React.useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase()

      if ((event.metaKey || event.ctrlKey) && key === 'k') {
        if (isCommandShortcutIgnored(event.target) && !commandOpen) return

        event.preventDefault()
        event.stopPropagation()
        setSidebarOpen(false)
        setCommandOpen(current => !current)
        return
      }

      if (
        event.key === '/' &&
        !event.altKey &&
        !event.ctrlKey &&
        !event.metaKey &&
        !event.shiftKey &&
        !isCommandShortcutIgnored(event.target)
      ) {
        event.preventDefault()
        event.stopPropagation()
        openCommandPalette()
      }
    }

    window.addEventListener('keydown', handleShortcut, true)
    return () => {
      window.removeEventListener('keydown', handleShortcut, true)
    }
  }, [commandOpen, openCommandPalette])

  const toggleCategory = (path: string) => {
    setExpandedCategory(current => (current === path ? null : path))
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
  }> = useMemo(
    () => [
      { mode: 'light', label: t('app.theme.light'), icon: <Sun className="h-4 w-4" /> },
      { mode: 'dark', label: t('app.theme.dark'), icon: <Moon className="h-4 w-4" /> },
      { mode: 'system', label: t('app.theme.system'), icon: <Laptop className="h-4 w-4" /> }
    ],
    [t]
  )

  const currentTitle = breadcrumbs[breadcrumbs.length - 1]?.label ?? 'Daily Tools'
  const collapseLabel = sidebarCollapsed ? t('public.expand_sidebar') : t('public.collapse_sidebar')

  const renderNavigation = (collapsedView = false) => (
    <nav
      className={cn('flex-1 overflow-y-auto py-4', collapsedView ? 'px-2' : 'px-3 sm:px-4')}
      aria-label={t('public.open_navigation')}
    >
      <div className={cn('flex flex-col', collapsedView ? 'gap-2.5' : 'gap-4')}>
        {menus.map(category => {
          const hasChildren = Boolean(category.children?.length)
          const isActiveCategory = currentCategory === category.path
          const isActiveLeaf = isActiveCategory && !hasChildren
          const isExpanded = !collapsedView && hasChildren && expandedCategory === category.path
          const categoryLabel = menuLabelByPath.get(category.path) ?? getMenuLabel(category, t)

          return (
            <div key={category.path} className="min-w-0">
              <button
                type="button"
                onClick={() => handleCategoryAction(category, collapsedView)}
                aria-expanded={!collapsedView && hasChildren ? isExpanded : undefined}
                aria-current={isActiveLeaf ? 'page' : undefined}
                aria-label={categoryLabel}
                title={categoryLabel}
                className={cn(
                  'group relative flex min-h-11 w-full items-center rounded-2xl text-sm font-medium transition-[background-color,color,box-shadow,transform] duration-200',
                  collapsedView ? 'justify-center px-0' : 'gap-3 px-3.5',
                  isActiveLeaf
                    ? 'bg-[var(--glass-bg-active)] text-[var(--primary)] shadow-[inset_0_1px_0_rgba(255,255,255,0.22),0_10px_28px_rgba(0,113,227,0.12)]'
                    : isActiveCategory
                      ? 'text-[var(--primary)] hover:bg-[var(--glass-bg-hover)]'
                      : 'text-[var(--text-secondary)] hover:bg-[var(--glass-bg-hover)] hover:text-[var(--text-primary)]'
                )}
              >
                <span
                  className={cn(
                    'grid h-8 w-8 shrink-0 place-items-center rounded-xl transition-colors',
                    isActiveCategory
                      ? 'bg-[var(--primary-subtle)] text-[var(--primary)]'
                      : 'bg-[var(--glass-input-bg)] text-[var(--text-tertiary)] group-hover:text-[var(--text-primary)]'
                  )}
                >
                  {category.icon}
                </span>

                {!collapsedView && (
                  <>
                    <span className="min-w-0 flex-1 truncate text-left">{categoryLabel}</span>
                    {hasChildren && (
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
                        const isChildActive = isPathMatch(pathname, child.path)
                        const childLabel = menuLabelByPath.get(child.path) ?? getMenuLabel(child, t)

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
      <ToolCommandPalette
        currentPath={pathname}
        items={toolSearchItems}
        open={commandOpen}
        recentPaths={recentToolPaths}
        onOpenChange={setCommandOpen}
        onSelect={handleNavigate}
      />

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
                        {index === breadcrumbs.length - 1 ? (
                          <span
                            className="min-w-0 truncate rounded-lg px-1.5 py-1 font-semibold text-[var(--text-primary)]"
                            aria-current="page"
                          >
                            {crumb.label}
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              const nextPath = resolveNavigableMenuPath(crumb.path) ?? crumb.path
                              handleNavigate(nextPath)
                            }}
                            className="hidden min-w-0 rounded-lg px-1.5 py-1 text-[var(--text-secondary)] transition-[background-color,color] hover:bg-[var(--glass-bg-hover)] hover:text-[var(--text-primary)] sm:block"
                          >
                            <span className="truncate">{crumb.label}</span>
                          </button>
                        )}
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
              <button
                type="button"
                onClick={openCommandPalette}
                className="grid h-9 w-9 place-items-center rounded-2xl text-[var(--text-secondary)] transition-[background-color,color] hover:bg-[var(--glass-bg-hover)] hover:text-[var(--text-primary)] glass-input"
                aria-label={t('public.tool_search.open')}
                aria-keyshortcuts="Meta+K Control+K /"
                title={t('public.tool_search.open')}
              >
                <Search className="h-4 w-4" aria-hidden="true" />
              </button>

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
