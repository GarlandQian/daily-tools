'use client'

import { AnimatePresence, motion } from 'framer-motion'
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { cn } from '@/lib/utils'

import { ToolNavigation, type ToolNavigationProps } from './ToolNavigation'

interface ToolSidebarProps {
  sidebarCollapsed: boolean
  sidebarOpen: boolean
  onToggleCollapsed: () => void
  onClose: () => void
  navigation: ToolNavigationProps
}

export function ToolSidebar({
  sidebarCollapsed,
  sidebarOpen,
  onToggleCollapsed,
  onClose,
  navigation
}: ToolSidebarProps) {
  const { t } = useTranslation()
  const collapseLabel = sidebarCollapsed ? t('public.expand_sidebar') : t('public.collapse_sidebar')

  return (
    <>
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

        <ToolNavigation {...navigation} collapsedView={sidebarCollapsed} />

        <div className={cn('shrink-0 border-t border-[var(--glass-border)] p-3')}>
          <button
            type="button"
            onClick={() => onToggleCollapsed()}
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
              onClick={() => onClose()}
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

              <ToolNavigation {...navigation} />
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  )
}
