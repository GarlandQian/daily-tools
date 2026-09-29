'use client'

import { useCallback, useEffect, useState } from 'react'

import { readLocalStorage, writeLocalStorage } from '@/utils/storage'

import {
  parseRecentToolPaths,
  rememberRecentToolPath,
  UI_RECENT_TOOLS_STORAGE_KEY
} from '../preferences'

export function useRecentTools(searchableToolPaths: ReadonlySet<string>) {
  const [recentToolPaths, setRecentToolPaths] = useState<string[]>([])
  const [ready, setReady] = useState(false)

  useEffect(() => {
    // Read browser storage after hydration, then enable persistence.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRecentToolPaths(
      parseRecentToolPaths(readLocalStorage(UI_RECENT_TOOLS_STORAGE_KEY), searchableToolPaths)
    )
    setReady(true)
  }, [searchableToolPaths])

  useEffect(() => {
    if (ready) writeLocalStorage(UI_RECENT_TOOLS_STORAGE_KEY, JSON.stringify(recentToolPaths))
  }, [ready, recentToolPaths])

  const rememberToolPath = useCallback(
    (path: string) => {
      setRecentToolPaths(current => rememberRecentToolPath(current, path, searchableToolPaths))
    },
    [searchableToolPaths]
  )

  return { recentToolPaths, rememberToolPath }
}
