'use client'

import { AnimatePresence, motion } from 'framer-motion'
import { Keyboard } from 'lucide-react'
import React, { useCallback, useEffect, useRef, useState } from 'react'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useCopy } from '@/hooks/useCopy'

interface KeyInfo {
  key: string
  code: string
  keyCode: number
  which: number
  altKey: boolean
  ctrlKey: boolean
  shiftKey: boolean
  metaKey: boolean
}

const KeyCodeClient = () => {
  const [keyInfo, setKeyInfo] = useState<KeyInfo | null>(null)
  const [history, setHistory] = useState<KeyInfo[]>([])
  const pressAreaRef = useRef<HTMLDivElement>(null)
  const { copy } = useCopy()

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // Allow browser shortcuts (Cmd+R, Cmd+W, etc.) to pass through
    if (e.metaKey && ['r', 'w', 't', 'q'].includes(e.key.toLowerCase())) return

    e.preventDefault()
    const info: KeyInfo = {
      key: e.key,
      code: e.code,
      keyCode: e.keyCode,
      which: e.which,
      altKey: e.altKey,
      ctrlKey: e.ctrlKey,
      shiftKey: e.shiftKey,
      metaKey: e.metaKey
    }
    setKeyInfo(info)
    setHistory(prev => [info, ...prev].slice(0, 10))
  }, [])

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  const modifierChips = keyInfo
    ? [
        { label: 'Ctrl', active: keyInfo.ctrlKey },
        { label: 'Shift', active: keyInfo.shiftKey },
        { label: 'Alt', active: keyInfo.altKey },
        { label: 'Meta', active: keyInfo.metaKey }
      ]
    : []

  const codeChipClass = (active: boolean) =>
    `inline-flex items-center px-3 py-1 rounded-md text-xs font-semibold font-mono transition-colors ${
      active
        ? 'bg-[var(--primary)] text-white shadow-sm'
        : 'bg-[var(--bg-muted)] text-[var(--text-tertiary)]'
    }`

  return (
    <div className="flex flex-col gap-5 size-full">
      {/* Press area */}
      <div
        ref={pressAreaRef}
        tabIndex={0}
        className="glass-panel rounded-2xl relative overflow-hidden flex flex-col items-center justify-center min-h-[200px] cursor-pointer outline-none transition-shadow focus:ring-2 focus:ring-[var(--primary)] focus:ring-offset-2 hover:shadow-lg"
      >
        <div className="glass-specular" />
        <AnimatePresence mode="wait">
          {keyInfo ? (
            <motion.div
              key={keyInfo.code + keyInfo.keyCode}
              initial={{ opacity: 0, scale: 0.7, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ type: 'spring', stiffness: 300, damping: 20 }}
              className="flex flex-col items-center gap-4 z-10"
            >
              <span className="text-5xl md:text-6xl font-mono font-semibold tabular-nums text-[var(--text-primary)]">
                {keyInfo.key.length === 1 ? keyInfo.key : keyInfo.code}
              </span>
              <div className="flex flex-wrap items-center gap-2">
                {modifierChips.map(chip => (
                  <span key={chip.label} className={codeChipClass(chip.active)}>
                    {chip.label}
                  </span>
                ))}
              </div>
            </motion.div>
          ) : (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center gap-3 z-10"
            >
              <Keyboard className="w-10 h-10 text-[var(--text-tertiary)]" />
              <span className="text-lg font-medium text-[var(--text-secondary)]">
                Press any key...
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Detail card */}
      <AnimatePresence>
        {keyInfo && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ type: 'spring', stiffness: 260, damping: 20 }}
          >
            <Card>
              <CardHeader>
                <CardTitle>Event Properties</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { label: 'event.key', value: keyInfo.key },
                    { label: 'event.code', value: keyInfo.code },
                    { label: 'event.keyCode', value: String(keyInfo.keyCode) },
                    { label: 'event.which', value: String(keyInfo.which) }
                  ].map(item => (
                    <div
                      key={item.label}
                      className="glass-input rounded-lg p-3 flex flex-col gap-1"
                    >
                      <span className="text-xs text-[var(--text-tertiary)]">{item.label}</span>
                      <span className="font-mono text-sm font-medium text-[var(--text-primary)] break-all">
                        {item.value}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* History */}
      {history.length > 0 && (
        <Card className="flex-1 flex flex-col overflow-hidden">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Recent Keys</CardTitle>
              <button
                onClick={() => {
                  setHistory([])
                  setKeyInfo(null)
                }}
                className="text-xs text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] transition-colors"
              >
                Clear
              </button>
            </div>
          </CardHeader>
          <CardContent className="flex-1 overflow-auto">
            <div className="space-y-2">
              {history.map((item, i) => (
                <div
                  key={`${item.code}-${item.keyCode}-${i}`}
                  className="flex items-center gap-3 py-2 px-3 rounded-lg hover:bg-[var(--bg-hover)] transition-colors group"
                >
                  <span className="text-base font-mono font-semibold text-[var(--text-primary)] w-16 shrink-0">
                    {item.key.length === 1 ? item.key : item.code}
                  </span>
                  <span className="text-xs font-mono text-[var(--text-tertiary)]">{item.code}</span>
                  <div className="flex gap-1 ml-auto shrink-0">
                    {[
                      { label: 'C', active: item.ctrlKey },
                      { label: 'S', active: item.shiftKey },
                      { label: 'A', active: item.altKey },
                      { label: 'M', active: item.metaKey }
                    ].map(chip => (
                      <span
                        key={chip.label}
                        className={`inline-flex items-center justify-center w-5 h-5 rounded text-[10px] font-bold ${
                          chip.active
                            ? 'bg-[var(--primary)] text-white'
                            : 'bg-[var(--bg-muted)] text-[var(--text-tertiary)]'
                        }`}
                      >
                        {chip.label}
                      </span>
                    ))}
                  </div>
                  <button
                    onClick={() =>
                      copy(
                        `key: ${item.key}, code: ${item.code}, keyCode: ${item.keyCode}, which: ${item.which}`
                      )
                    }
                    className="opacity-0 group-hover:opacity-100 text-xs text-[var(--text-tertiary)] hover:text-[var(--primary)] transition-all"
                  >
                    copy
                  </button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

export default KeyCodeClient
