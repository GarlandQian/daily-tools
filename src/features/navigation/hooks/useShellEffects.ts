'use client'

import React from 'react'

const RANDOM_EFFECT_MARKER = 'glassRandomized'
const RANDOM_EFFECT_SELECTOR =
  '.glass-panel, .glass-panel-strong, .glass-float, .glass-specular, .glass-caustic, .glass-prism, .glass-shimmer'

type IdleWindow = Window & {
  cancelIdleCallback?: (handle: number) => void
  requestIdleCallback?: (
    callback: (deadline: { didTimeout: boolean; timeRemaining: () => number }) => void,
    options?: { timeout: number }
  ) => number
}

const randomBetween = (min: number, max: number) => min + Math.random() * (max - min)

const setRandomEffectVars = (element: HTMLElement) => {
  const prismRotation = randomBetween(3, 8)

  element.style.cssText += `;${[
    `--fx-border-delay:-${randomBetween(0, 6).toFixed(2)}s`,
    `--fx-border-duration:${randomBetween(5.2, 8.6).toFixed(2)}s`,
    `--fx-border-direction:${Math.random() > 0.5 ? 'normal' : 'reverse'}`,
    `--fx-specular-delay:-${randomBetween(0, 4).toFixed(2)}s`,
    `--fx-specular-duration:${randomBetween(3.4, 5.8).toFixed(2)}s`,
    `--fx-specular-direction:${Math.random() > 0.5 ? 'normal' : 'alternate-reverse'}`,
    `--fx-caustic-delay:-${randomBetween(0, 8).toFixed(2)}s`,
    `--fx-caustic-duration:${randomBetween(7, 11).toFixed(2)}s`,
    `--fx-caustic-direction:${Math.random() > 0.5 ? 'normal' : 'reverse'}`,
    `--fx-prism-delay:-${randomBetween(0, 14).toFixed(2)}s`,
    `--fx-prism-duration:${randomBetween(11, 18).toFixed(2)}s`,
    `--fx-prism-x0:${randomBetween(-12, -4).toFixed(2)}%`,
    `--fx-prism-y0:${randomBetween(-10, -2).toFixed(2)}%`,
    `--fx-prism-x1:${randomBetween(4, 12).toFixed(2)}%`,
    `--fx-prism-y1:${randomBetween(1, 8).toFixed(2)}%`,
    `--fx-prism-x2:${randomBetween(-6, 4).toFixed(2)}%`,
    `--fx-prism-y2:${randomBetween(6, 14).toFixed(2)}%`,
    `--fx-prism-rotation:${prismRotation.toFixed(2)}deg`,
    `--fx-prism-rotation-reverse:${(-prismRotation * 0.8).toFixed(2)}deg`,
    `--fx-shimmer-delay:-${randomBetween(0, 10).toFixed(2)}s`,
    `--fx-shimmer-duration:${randomBetween(8, 14).toFixed(2)}s`,
    `--fx-shimmer-angle:${randomBetween(88, 122).toFixed(2)}deg`,
    `--fx-shimmer-direction:${Math.random() > 0.5 ? 'normal' : 'reverse'}`
  ].join(';')};`
}

export const useRandomizedGlassEffects = () => {
  React.useEffect(() => {
    const initialized = new WeakSet<HTMLElement>()
    const pending = new Set<HTMLElement>()
    const idleWindow = window as IdleWindow
    let idleHandle: number | null = null
    let timeoutHandle: number | null = null

    const applyElementNow = (element: HTMLElement) => {
      if (initialized.has(element) || element.dataset[RANDOM_EFFECT_MARKER] === 'true') return
      initialized.add(element)
      element.dataset[RANDOM_EFFECT_MARKER] = 'true'
      setRandomEffectVars(element)
    }

    const flushPending = (deadline?: { didTimeout: boolean; timeRemaining: () => number }) => {
      idleHandle = null
      timeoutHandle = null

      let processed = 0
      const hasBudget = () =>
        processed < 12 || !deadline || deadline.didTimeout || deadline.timeRemaining() > 2

      for (const element of pending) {
        if (!hasBudget()) break
        pending.delete(element)
        applyElementNow(element)
        processed += 1
      }

      if (pending.size > 0) scheduleFlush()
    }

    const scheduleFlush = () => {
      if (idleHandle !== null || timeoutHandle !== null) return

      if (typeof idleWindow.requestIdleCallback === 'function') {
        idleHandle = idleWindow.requestIdleCallback(flushPending, { timeout: 700 })
        return
      }

      timeoutHandle = window.setTimeout(() => flushPending(), 32)
    }

    const enqueueElement = (element: HTMLElement) => {
      if (initialized.has(element) || element.dataset[RANDOM_EFFECT_MARKER] === 'true') return
      pending.add(element)
      scheduleFlush()
    }

    const enqueueTree = (root: ParentNode) => {
      if (root instanceof HTMLElement && root.matches(RANDOM_EFFECT_SELECTOR)) {
        enqueueElement(root)
      }

      root.querySelectorAll<HTMLElement>(RANDOM_EFFECT_SELECTOR).forEach(enqueueElement)
    }

    enqueueTree(document.body)

    const observer = new MutationObserver(mutations => {
      mutations.forEach(mutation => {
        mutation.addedNodes.forEach(node => {
          if (!(node instanceof HTMLElement)) return
          enqueueTree(node)
        })
      })
    })

    observer.observe(document.body, { childList: true, subtree: true })
    return () => {
      observer.disconnect()
      pending.clear()
      if (idleHandle !== null && typeof idleWindow.cancelIdleCallback === 'function') {
        idleWindow.cancelIdleCallback(idleHandle)
      }
      if (timeoutHandle !== null) {
        window.clearTimeout(timeoutHandle)
      }
    }
  }, [])
}

export const usePageVisibilityClass = () => {
  React.useEffect(() => {
    const root = document.documentElement

    const updateVisibilityClass = () => {
      root.classList.toggle('page-hidden', document.visibilityState === 'hidden')
    }

    updateVisibilityClass()
    document.addEventListener('visibilitychange', updateVisibilityClass)
    return () => {
      document.removeEventListener('visibilitychange', updateVisibilityClass)
      root.classList.remove('page-hidden')
    }
  }, [])
}
