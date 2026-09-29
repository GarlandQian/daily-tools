'use client'

import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { buildMenuLabelMap, findMenuMatch, getMenuLabel } from '@/config/menu-utils'

export function useToolNavigation(pathname: string) {
  const { t } = useTranslation()
  const menuLabelByPath = useMemo(() => buildMenuLabelMap(t), [t])

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

  // Reset expansion when entering a different category, including browser back.
  // Adjusting the prior category during render avoids committing a stale menu.
  const [expansion, setExpansion] = useState<{
    category: string | null
    expanded: string | null
  }>({ category: currentCategory, expanded: currentCategory })
  if (expansion.category !== currentCategory) {
    setExpansion({ category: currentCategory, expanded: currentCategory })
  }
  const expandedCategory =
    expansion.category === currentCategory ? expansion.expanded : currentCategory

  const toggleCategory = (path: string) => {
    setExpansion(current => {
      const expanded = current.category === currentCategory ? current.expanded : currentCategory
      return { category: currentCategory, expanded: expanded === path ? null : path }
    })
  }

  return { menuLabelByPath, currentCategory, breadcrumbs, expandedCategory, toggleCategory }
}
