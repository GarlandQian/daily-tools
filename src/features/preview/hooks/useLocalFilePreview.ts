'use client'

import { type ChangeEvent, useEffect, useRef, useState } from 'react'

import { downloadBlob } from '@/utils/download'

import { startPreviewSession } from '../lib/previewSession'

export interface PreviewSource {
  file: File
  url: string
  signal: AbortSignal
}

export interface PreviewRenderer<Result> {
  preview: (source: PreviewSource) => Promise<Result>
  destroy: () => void
}

export interface LocalPreviewFormat<Result> {
  maxSize: number
  accepts: (file: File) => boolean
  createRenderer: (host: HTMLDivElement, signal: AbortSignal) => Promise<PreviewRenderer<Result>>
  serializeSessions?: boolean
}

interface PreviewMessages {
  invalidType: string
  tooLarge: string
  previewFailed: string
}

// Only adapters with shared module resources serialize cancelled work. Independent
// renderers must not make later uploads wait for an old library promise to settle.
const pendingSessions = new WeakMap<object, Promise<void>>()

interface SelectedFile {
  file: File
}

type PreviewOutcome<Result> = {
  selection: SelectedFile
} & ({ status: 'ready'; result: Result } | { status: 'error' })

export const useLocalFilePreview = <Result>(
  format: LocalPreviewFormat<Result>,
  messages: PreviewMessages
) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const selectionRef = useRef<SelectedFile | null>(null)
  const cancelRef = useRef<(() => void) | null>(null)
  const [selection, setSelection] = useState<SelectedFile | null>(null)
  const [outcome, setOutcome] = useState<PreviewOutcome<Result> | null>(null)
  const [validationError, setValidationError] = useState<'invalidType' | 'tooLarge' | null>(null)

  useEffect(() => {
    if (!selection || !containerRef.current) return

    // Each session owns a separate node, even when React retains the outer container.
    const host = document.createElement('div')
    host.className = 'h-full'
    containerRef.current.appendChild(host)
    let url: string | undefined
    const session = startPreviewSession({
      previous: format.serializeSessions ? pendingSessions.get(format) : undefined,
      create: async signal => {
        const renderer = await format.createRenderer(host, signal)
        try {
          url = URL.createObjectURL(selection.file)
        } catch (error) {
          renderer.destroy()
          throw error
        }
        const source = { file: selection.file, url, signal }
        return {
          render: () => renderer.preview(source),
          dispose: () => renderer.destroy()
        }
      },
      onSuccess: result => {
        if (selectionRef.current === selection) {
          setOutcome({ selection, status: 'ready', result })
        }
      },
      onError: () => {
        if (selectionRef.current === selection) setOutcome({ selection, status: 'error' })
      },
      release: () => {
        if (url) URL.revokeObjectURL(url)
        host.remove()
      }
    })
    if (format.serializeSessions) pendingSessions.set(format, session.settled)

    const cancel = () => {
      // Remove immediately; libraries finish into their detached, private node.
      host.remove()
      session.cancel()
    }
    cancelRef.current = cancel
    return cancel
  }, [format, selection])

  const onUpload = (file: File) => {
    if (!format.accepts(file)) {
      setValidationError('invalidType')
      return
    }
    if (file.size > format.maxSize) {
      setValidationError('tooLarge')
      return
    }
    cancelRef.current?.()
    const next = { file }
    selectionRef.current = next
    setSelection(next)
    setOutcome(null)
    setValidationError(null)
  }

  const handleReupload = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (file) onUpload(file)
  }

  const handleClear = () => {
    selectionRef.current = null
    cancelRef.current?.()
    setSelection(null)
    setOutcome(null)
    setValidationError(null)
  }

  const currentOutcome = outcome?.selection === selection ? outcome : null
  return {
    containerRef,
    fileInputRef,
    fileInfo: selection?.file ?? null,
    hasFile: selection !== null,
    loading: selection !== null && currentOutcome === null,
    result: currentOutcome?.status === 'ready' ? currentOutcome.result : null,
    error: validationError
      ? messages[validationError]
      : currentOutcome?.status === 'error'
        ? messages.previewFailed
        : '',
    onUpload,
    handleReupload,
    handleClear,
    handleDownload: () => {
      if (selection) downloadBlob(selection.file, selection.file.name)
    }
  }
}
