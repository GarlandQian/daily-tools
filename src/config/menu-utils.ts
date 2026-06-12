import { type MenuConfig, menus } from './menus'

type Translate = (key: string, options?: Record<string, unknown>) => string

export interface ToolSearchItem {
  category: string
  categoryPath: string
  id: string
  isCategory?: boolean
  keywords: string[]
  label: string
  path: string
}

export const getMenuLabelKeys = (item: MenuConfig) => {
  if (item.labelKey) return [item.labelKey]

  const pathKey = `app${item.path.replaceAll('/', '.')}`
  const normalizedKey = pathKey.replaceAll('-', '_')

  return normalizedKey === pathKey ? [pathKey] : [pathKey, normalizedKey]
}

export const getMenuLabel = (item: MenuConfig, translate: Translate) => {
  const keys = getMenuLabelKeys(item)

  for (const key of keys) {
    const label = translate(key)
    if (label !== key) return label
  }

  return translate(keys[0])
}

export const isPathMatch = (pathname: string, path: string) =>
  pathname === path || pathname.startsWith(`${path}/`)

export const findMenuMatch = (pathname: string) => {
  for (const category of menus) {
    const child = category.children?.find(item => isPathMatch(pathname, item.path))
    if (child) {
      return { category, child }
    }

    if (isPathMatch(pathname, category.path)) {
      return { category, child: undefined }
    }
  }

  return null
}

export const resolveNavigableMenuPath = (path: string) => {
  const visit = (items: MenuConfig[]): string | null => {
    for (const item of items) {
      if (item.path === path) {
        return item.children?.[0]?.path ?? item.path
      }

      if (item.children) {
        const childPath = visit(item.children)
        if (childPath) return childPath
      }
    }

    return null
  }

  return visit(menus)
}

export const buildSearchableToolPathSet = () => {
  const paths = new Set<string>()

  menus.forEach(category => {
    category.children?.forEach(child => {
      paths.add(child.path)
    })
  })

  return paths
}

export const buildMenuLabelMap = (translate: Translate) => {
  const labelMap = new Map<string, string>()

  const visit = (items: MenuConfig[]) => {
    items.forEach(item => {
      labelMap.set(item.path, getMenuLabel(item, translate))
      if (item.children) visit(item.children)
    })
  }

  visit(menus)
  return labelMap
}

export const buildToolSearchItems = (translate: Translate): ToolSearchItem[] =>
  menus.flatMap(category => {
    const categoryLabel = getMenuLabel(category, translate)
    const categoryPath = resolveNavigableMenuPath(category.path) ?? category.path
    const categoryItem: ToolSearchItem = {
      category: translate('public.tool_search.categories'),
      categoryPath: category.path,
      id: `category:${category.path}`,
      isCategory: true,
      keywords: [categoryLabel, category.path],
      label: categoryLabel,
      path: categoryPath
    }

    return [
      categoryItem,
      ...(category.children?.map(child => {
        const label = getMenuLabel(child, translate)
        const routeSegments = child.path
          .split('/')
          .filter(Boolean)
          .flatMap(segment => [segment, segment.replaceAll('-', ' ')])

        return {
          category: categoryLabel,
          categoryPath: category.path,
          id: `tool:${child.path}`,
          keywords: [label, categoryLabel, child.path, ...routeSegments],
          label,
          path: child.path
        }
      }) ?? [])
    ]
  })
