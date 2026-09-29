export type DirectionMode = 'ltr' | 'rtl'

// Keep the existing keys so the shell retains preferences across upgrades.
export const UI_LANGUAGE_STORAGE_KEY = 'ui-language'
export const UI_DIRECTION_STORAGE_KEY = 'ui-direction'
export const UI_SIDEBAR_COLLAPSED_STORAGE_KEY = 'ui-sidebar-collapsed'
export const UI_RECENT_TOOLS_STORAGE_KEY = 'ui-recent-tools'
export const MAX_RECENT_TOOLS = 6

export const isDirectionMode = (value: string | null): value is DirectionMode =>
  value === 'ltr' || value === 'rtl'

export const isSupportedLanguage = (value: string | null): value is 'cn' | 'en' =>
  value === 'cn' || value === 'en'

export function parseRecentToolPaths(
  value: string | null,
  allowedPaths: ReadonlySet<string>
): string[] {
  if (!value) return []

  try {
    const parsed: unknown = JSON.parse(value)
    if (!Array.isArray(parsed)) return []

    return Array.from(
      new Set(
        parsed.filter((path): path is string => typeof path === 'string' && allowedPaths.has(path))
      )
    ).slice(0, MAX_RECENT_TOOLS)
  } catch {
    return []
  }
}

export function rememberRecentToolPath(
  current: string[],
  path: string,
  allowedPaths: ReadonlySet<string>
): string[] {
  if (!allowedPaths.has(path)) return current
  return [path, ...current.filter(item => item !== path)].slice(0, MAX_RECENT_TOOLS)
}
