'use client'

import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList
} from 'cmdk'
import { ArrowUpRight, Check, FolderOpen, History, Search } from 'lucide-react'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import type { ToolSearchItem } from '@/config/menu-utils'
import { isPathMatch } from '@/config/menu-utils'
import { cn } from '@/lib/utils'

interface ToolCommandPaletteProps {
  currentPath: string
  items: ToolSearchItem[]
  onOpenChange: (open: boolean) => void
  onSelect: (path: string) => void
  open: boolean
  recentPaths?: string[] | null
}

const groupItems = (items: ToolSearchItem[]) => {
  const groups = new Map<string, ToolSearchItem[]>()

  items.forEach(item => {
    const current = groups.get(item.category) ?? []
    current.push(item)
    groups.set(item.category, current)
  })

  return Array.from(groups.entries()).map(([category, categoryItems]) => ({
    category,
    items: categoryItems
  }))
}

export const ToolCommandPalette = ({
  currentPath,
  items,
  onOpenChange,
  onSelect,
  open,
  recentPaths
}: ToolCommandPaletteProps) => {
  const { t } = useTranslation()
  const safeRecentPaths = useMemo(
    () => (Array.isArray(recentPaths) ? recentPaths : []),
    [recentPaths]
  )
  const recentItems = useMemo(() => {
    if (!safeRecentPaths.length) return []

    const itemByPath = new Map(items.map(item => [item.path, item]))
    return safeRecentPaths.flatMap(path => {
      const item = itemByPath.get(path)
      return item && !item.isCategory ? [{ ...item, category: t('public.tool_search.recent') }] : []
    })
  }, [items, safeRecentPaths, t])
  const groupedItems = useMemo(() => groupItems([...recentItems, ...items]), [items, recentItems])
  const resultCount = items.length

  return (
    <CommandDialog
      open={open}
      onOpenChange={onOpenChange}
      label={t('public.tool_search.dialog_label')}
      loop
      vimBindings={false}
      overlayClassName="fixed inset-0 z-[70] bg-black/35 backdrop-blur-sm"
      contentClassName="glass-panel-strong fixed left-1/2 top-[12vh] z-[80] flex max-h-[min(36rem,calc(100vh-6rem))] w-[min(42rem,calc(100vw-1.5rem))] -translate-x-1/2 flex-col overflow-hidden rounded-2xl border border-[var(--glass-border-strong)] shadow-[0_24px_80px_rgba(0,0,0,0.22)]"
    >
      <div className="flex items-center gap-3 border-b border-[var(--glass-border)] px-4 py-3">
        <Search className="h-4 w-4 shrink-0 text-[var(--text-tertiary)]" aria-hidden="true" />
        <CommandInput
          aria-label={t('public.tool_search.placeholder')}
          placeholder={t('public.tool_search.placeholder')}
          className="h-10 min-w-0 flex-1 bg-transparent text-sm text-[var(--text-primary)] outline-none placeholder:text-[var(--text-tertiary)]"
        />
        <span className="hidden shrink-0 rounded-full bg-[var(--glass-input-bg)] px-2 py-0.5 text-xs text-[var(--text-tertiary)] sm:inline">
          {t('public.tool_search.result_count', { count: resultCount })}
        </span>
      </div>
      <CommandList
        aria-label={t('public.tool_search.list_label')}
        className="min-h-0 overflow-y-auto px-2 py-3"
      >
        <CommandEmpty className="px-3 py-8 text-center text-sm text-[var(--text-tertiary)]">
          {t('public.tool_search.empty')}
        </CommandEmpty>

        {groupedItems.map(group => (
          <CommandGroup
            key={group.category}
            heading={group.category}
            className="py-1 text-[var(--text-tertiary)] [&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:pb-1.5 [&_[cmdk-group-heading]]:pt-2 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-semibold"
          >
            {group.items.map(item => {
              const isCurrent = isPathMatch(currentPath, item.path)
              const isRecent = group.category === t('public.tool_search.recent')

              return (
                <CommandItem
                  key={isRecent ? `recent:${item.path}` : item.id}
                  value={isRecent ? `recent:${item.path}` : item.id}
                  keywords={item.keywords}
                  aria-current={isCurrent ? 'page' : undefined}
                  aria-label={t('public.tool_search.open_tool', {
                    category: item.category,
                    tool: item.label
                  })}
                  onSelect={() => onSelect(item.path)}
                  className={cn(
                    'flex min-h-12 cursor-pointer items-center gap-3 rounded-xl px-3 py-2 text-sm text-[var(--text-secondary)] outline-none transition-[background-color,color]',
                    'aria-selected:bg-[var(--glass-bg-hover)] aria-selected:text-[var(--text-primary)]',
                    isCurrent && 'bg-[var(--primary-subtle)] text-[var(--primary)]'
                  )}
                >
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-[var(--glass-input-bg)] text-[var(--text-tertiary)]">
                    {isCurrent ? (
                      <Check className="h-4 w-4" aria-hidden="true" />
                    ) : isRecent ? (
                      <History className="h-4 w-4" aria-hidden="true" />
                    ) : item.isCategory ? (
                      <FolderOpen className="h-4 w-4" aria-hidden="true" />
                    ) : (
                      <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium text-[var(--text-primary)]">
                      {item.label}
                    </span>
                    <span className="mt-0.5 block truncate text-xs text-[var(--text-tertiary)]">
                      {item.path}
                    </span>
                  </span>
                  <span className="flex shrink-0 flex-col items-end gap-1">
                    {item.isCategory && (
                      <span className="rounded-full bg-[var(--glass-input-bg)] px-2 py-0.5 text-xs text-[var(--text-tertiary)]">
                        {t('public.tool_search.category')}
                      </span>
                    )}
                    {isCurrent && (
                      <span className="rounded-full bg-[var(--glass-input-bg)] px-2 py-0.5 text-xs text-[var(--primary)]">
                        {t('public.tool_search.current')}
                      </span>
                    )}
                  </span>
                </CommandItem>
              )
            })}
          </CommandGroup>
        ))}
      </CommandList>
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--glass-border)] px-4 py-2 text-xs text-[var(--text-tertiary)]">
        <span>{t('public.tool_search.shortcut_hint')}</span>
        <span>{t('public.tool_search.navigate_hint')}</span>
      </div>
    </CommandDialog>
  )
}
