'use client'

import { AnimatePresence, motion } from 'framer-motion'
import { ChevronRight } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { getMenuLabel, isPathMatch } from '@/config/menu-utils'
import { type MenuConfig, menus } from '@/config/menus'
import { cn } from '@/lib/utils'

export interface ToolNavigationProps {
  currentCategory: string | null
  expandedCategory: string | null
  menuLabelByPath: Map<string, string>
  pathname: string
  handleNavigate: (path: string) => void
  onToggleCategory: (path: string) => void
}

export function ToolNavigation({
  collapsedView = false,
  currentCategory,
  expandedCategory,
  menuLabelByPath,
  pathname,
  handleNavigate,
  onToggleCategory
}: ToolNavigationProps & { collapsedView?: boolean }) {
  const { t } = useTranslation()

  const handleCategoryAction = (category: MenuConfig, collapsedView: boolean) => {
    if (collapsedView && category.children?.[0]) {
      handleNavigate(category.children[0].path)
      return
    }

    if (category.children?.length) {
      onToggleCategory(category.path)
      return
    }

    handleNavigate(category.path)
  }

  return (
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
}
