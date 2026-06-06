'use client'

import { useSyncExternalStore } from 'react'

import { createVisibleInterval } from '@/utils/visibleInterval'

let currentNow = Date.now()
let stopClock: (() => void) | null = null
const subscribers = new Set<() => void>()

const tick = () => {
  currentNow = Date.now()
  subscribers.forEach(listener => listener())
}

const subscribe = (listener: () => void) => {
  subscribers.add(listener)
  currentNow = Date.now()

  if (!stopClock) {
    stopClock = createVisibleInterval(tick, 1000)
  }

  return () => {
    subscribers.delete(listener)

    if (subscribers.size === 0) {
      stopClock?.()
      stopClock = null
    }
  }
}

const getSnapshot = () => currentNow
const getServerSnapshot = () => 0
const subscribeDisabled = () => () => {}
const getDisabledSnapshot = () => 0

export const useVisibleNow = (enabled = true) =>
  useSyncExternalStore(
    enabled ? subscribe : subscribeDisabled,
    enabled ? getSnapshot : getDisabledSnapshot,
    getServerSnapshot
  )
