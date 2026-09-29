interface ThemeViewTransition {
  finished: Promise<void>
  ready?: Promise<void>
  skipTransition?: () => void
}

type ThemeTransitionDocument = Document & {
  startViewTransition?: (callback: () => void) => ThemeViewTransition
}

/** Returns cleanup for both replacement transitions and component unmount. */
export function startThemeChange(applyTheme: () => void, x: number, y: number): () => void {
  const root = document.documentElement
  let timer: number | undefined
  let cancelled = false
  let transition: ThemeViewTransition | undefined

  const cleanup = () => {
    if (cancelled) return
    cancelled = true
    window.clearTimeout(timer)
    root.classList.remove('theme-view-transition', 'theme-transitioning')
    transition?.skipTransition?.()
  }

  root.style.setProperty('--theme-transition-x', `${x}px`)
  root.style.setProperty('--theme-transition-y', `${y}px`)

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    applyTheme()
    return cleanup
  }

  const transitionDocument = document as ThemeTransitionDocument
  const startViewTransition = transitionDocument.startViewTransition?.bind(document)

  if (startViewTransition) {
    root.classList.add('theme-view-transition')
    try {
      transition = startViewTransition(() => {
        if (!cancelled) applyTheme()
      })
      // A skipped native transition also rejects its ready promise.
      void transition.ready?.catch(() => {})
      // `finally` creates another rejected promise when the transition is skipped.
      // Handle both outcomes so interruption cannot become an unhandled rejection.
      void transition.finished.then(cleanup, cleanup)
      timer = window.setTimeout(cleanup, 900)
      return cleanup
    } catch {
      root.classList.remove('theme-view-transition')
    }
  }

  root.classList.add('theme-transitioning')
  applyTheme()
  timer = window.setTimeout(cleanup, 620)
  return cleanup
}
