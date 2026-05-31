'use client'

import { AnimatePresence, motion } from 'framer-motion'
import { X } from 'lucide-react'
import * as React from 'react'

import { cn } from '@/lib/utils'

type ToastType = 'success' | 'error' | 'info' | 'warning'

interface Toast {
  id: string
  type: ToastType
  message: string
}

interface ToastContextType {
  success: (message: string) => void
  error: (message: string) => void
  info: (message: string) => void
  warning: (message: string) => void
}

const ToastContext = React.createContext<ToastContextType | undefined>(undefined)

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<Toast[]>([])

  const addToast = React.useCallback((type: ToastType, message: string) => {
    const id = Math.random().toString(36).substring(2, 9)
    setToasts(prev => [...prev, { id, type, message }])

    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id))
    }, 3000)
  }, [])

  const removeToast = React.useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  const contextValue = React.useMemo(
    () => ({
      success: (message: string) => addToast('success', message),
      error: (message: string) => addToast('error', message),
      info: (message: string) => addToast('info', message),
      warning: (message: string) => addToast('warning', message)
    }),
    [addToast]
  )

  return (
    <ToastContext.Provider value={contextValue}>
      {children}
      <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none">
        <AnimatePresence>
          {toasts.map(toast => (
            <motion.div
              key={toast.id}
              initial={{ opacity: 0, y: -20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, x: 100, scale: 0.95 }}
              transition={{ type: 'spring', stiffness: 300, damping: 25 }}
              className={cn(
                'glass-panel rounded-lg px-4 py-3 shadow-lg min-w-[300px] max-w-[400px] pointer-events-auto',
                'flex items-center gap-3 border',
                toast.type === 'success' && 'border-[var(--success)] bg-[var(--success-subtle)]',
                toast.type === 'error' && 'border-[var(--error)] bg-[var(--error-subtle)]',
                toast.type === 'warning' && 'border-[var(--warning)] bg-[var(--warning-subtle)]',
                toast.type === 'info' && 'border-[var(--primary)] bg-[var(--primary-subtle)]'
              )}
            >
              <div className="flex-1 text-sm text-[var(--text-primary)]">{toast.message}</div>
              <button
                onClick={() => removeToast(toast.id)}
                className="text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const context = React.useContext(ToastContext)
  if (!context) {
    throw new Error('useToast must be used within ToastProvider')
  }
  return context
}
