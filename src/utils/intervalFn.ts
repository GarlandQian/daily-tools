import { Fn, Pausable } from './type'

export interface IntervalFnOptions {
  /**
   * Start the timer immediately
   *
   * @default true
   */
  immediate?: boolean

  /**
   * Execute the callback immediately after calling `resume`
   *
   * @default false
   */
  immediateCallback?: boolean
}

/**
 * Wrapper for `setInterval` with controls
 *
 * @param cb
 * @param interval
 * @param options
 */
export function intervalFn(
  cb: Fn,
  interval: number = 1000,
  options: IntervalFnOptions = {}
): Pausable {
  const { immediate = true, immediateCallback = false } = options

  let timer: ReturnType<typeof setInterval> | null = null
  let isActive = false

  function clean() {
    if (timer) {
      clearInterval(timer)
      timer = null
    }
  }

  function pause() {
    isActive = false
    clean()
  }

  function resume() {
    const intervalValue = interval
    if (intervalValue <= 0) return
    isActive = true
    if (immediateCallback) cb()
    clean()
    if (isActive) timer = setInterval(cb, intervalValue)
  }

  if (immediate) resume()

  return {
    isActive,
    pause,
    resume
  }
}
