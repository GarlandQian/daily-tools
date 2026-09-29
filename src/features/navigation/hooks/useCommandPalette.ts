'use client'

import { useCallback, useEffect, useState } from 'react'

const isCommandShortcutIgnored = (target: EventTarget | null) => {
  if (!(target instanceof HTMLElement)) return false
  return (
    target.isContentEditable || Boolean(target.closest('input, textarea, select, [role="textbox"]'))
  )
}

export function useCommandPalette(closeSidebar: () => void) {
  const [state, setState] = useState({ open: false, loaded: false })

  const setCommandOpen = useCallback((open: boolean) => {
    setState(current => ({ open, loaded: current.loaded || open }))
  }, [])

  const openCommandPalette = useCallback(() => {
    closeSidebar()
    setCommandOpen(true)
  }, [closeSidebar, setCommandOpen])

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        if (isCommandShortcutIgnored(event.target) && !state.open) return
        event.preventDefault()
        event.stopPropagation()
        closeSidebar()
        setState(current => ({ open: !current.open, loaded: current.loaded || !current.open }))
        return
      }

      if (
        event.key === '/' &&
        !event.altKey &&
        !event.ctrlKey &&
        !event.metaKey &&
        !event.shiftKey &&
        !isCommandShortcutIgnored(event.target)
      ) {
        event.preventDefault()
        event.stopPropagation()
        openCommandPalette()
      }
    }

    window.addEventListener('keydown', handleShortcut, true)
    return () => window.removeEventListener('keydown', handleShortcut, true)
  }, [closeSidebar, openCommandPalette, state.open])

  return {
    commandOpen: state.open,
    commandPaletteLoaded: state.loaded,
    openCommandPalette,
    setCommandOpen
  }
}
