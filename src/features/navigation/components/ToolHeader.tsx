'use client'

import { motion } from 'framer-motion'
import { ArrowLeftRight, ChevronRight, Github, Laptop, Menu, Moon, Search, Sun } from 'lucide-react'
import React from 'react'
import { useTranslation } from 'react-i18next'

import { type ThemeMode } from '@/components/ThemeProvider'
import { resolveNavigableMenuPath } from '@/config/menu-utils'
import { cn } from '@/lib/utils'

import { useThemeTransition } from '../hooks/useThemeTransition'
import { type DirectionMode } from '../preferences'

interface ToolHeaderProps {
  breadcrumbs: { path: string; label: string }[]
  direction: DirectionMode
  language: string
  handleNavigate: (path: string) => void
  handleLanguageChange: () => void
  handleDirectionChange: () => void
  openCommandPalette: () => void
  onOpenSidebar: () => void
}

export function ToolHeader({
  breadcrumbs,
  direction,
  language,
  handleNavigate,
  handleLanguageChange,
  handleDirectionChange,
  openCommandPalette,
  onOpenSidebar
}: ToolHeaderProps) {
  const { t } = useTranslation()
  const { themeMode, handleThemeChange } = useThemeTransition()

  const themeOptions: Array<{
    icon: React.ReactNode
    label: string
    mode: ThemeMode
  }> = React.useMemo(
    () => [
      { mode: 'light', label: t('app.theme.light'), icon: <Sun className="h-4 w-4" /> },
      { mode: 'dark', label: t('app.theme.dark'), icon: <Moon className="h-4 w-4" /> },
      { mode: 'system', label: t('app.theme.system'), icon: <Laptop className="h-4 w-4" /> }
    ],
    [t]
  )

  const currentTitle = breadcrumbs[breadcrumbs.length - 1]?.label ?? 'Daily Tools'

  return (
    <header className="relative border-b border-[var(--glass-border)] glass-panel">
      <div className="glass-specular" />
      <div className="flex h-[var(--header-height)] items-center justify-between gap-3 px-4 sm:px-5 lg:px-7">
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            onClick={() => onOpenSidebar()}
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
  )
}
