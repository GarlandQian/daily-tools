/** Match public tool URLs and Next's locale-prefixed prerender paths identically. */
export function getToolPathname(pathname: string, locales: readonly string[]): string {
  const firstSegment = pathname.split('/')[1]
  if (!locales.includes(firstSegment)) return pathname
  return pathname.slice(firstSegment.length + 1) || '/'
}
