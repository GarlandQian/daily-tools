interface VisibleIntervalOptions {
  immediate?: boolean
}

export function createVisibleInterval(
  callback: () => void,
  delay: number,
  options: VisibleIntervalOptions = {}
) {
  if (typeof window === 'undefined') return () => undefined

  const { immediate = true } = options
  let interval: number | null = null

  const stop = () => {
    if (interval === null) return
    window.clearInterval(interval)
    interval = null
  }

  const start = () => {
    if (document.visibilityState === 'hidden' || interval !== null) return
    if (immediate) callback()
    interval = window.setInterval(callback, delay)
  }

  const handleVisibilityChange = () => {
    if (document.visibilityState === 'hidden') {
      stop()
      return
    }

    start()
  }

  start()
  document.addEventListener('visibilitychange', handleVisibilityChange)

  return () => {
    stop()
    document.removeEventListener('visibilitychange', handleVisibilityChange)
  }
}
