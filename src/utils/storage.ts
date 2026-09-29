/** Preferences are optional: blocked storage must never prevent a tool from loading. */
export function readLocalStorage(key: string): string | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage.getItem(key)
  } catch {
    return null
  }
}

export function writeLocalStorage(key: string, value: string): void {
  try {
    if (typeof window !== 'undefined') window.localStorage.setItem(key, value)
  } catch {
    // Private browsing, browser policies, and exhausted quotas can deny writes.
  }
}
