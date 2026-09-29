export interface PreviewResource<Result> {
  render: () => Promise<Result>
  dispose: () => void
}

interface PreviewSessionOptions<Result> {
  create: (signal: AbortSignal) => Promise<PreviewResource<Result>>
  onSuccess: (result: Result) => void
  onError: () => void
  release: () => void
  previous?: Promise<void>
}

/** Keep uncancellable library work isolated until it is safe to destroy its instance. */
export const startPreviewSession = <Result>({
  create,
  onSuccess,
  onError,
  release,
  previous
}: PreviewSessionOptions<Result>) => {
  const controller = new AbortController()
  let resource: PreviewResource<Result> | undefined
  let finished = false
  let disposed = false

  const dispose = () => {
    if (disposed) return
    disposed = true
    try {
      resource?.dispose()
    } catch {
      // Teardown failures must not block releasing URLs or the next preview.
    } finally {
      release()
    }
  }

  const settled = (async () => {
    try {
      // A replacement must not race an old renderer's pending work or cleanup.
      await previous
      if (controller.signal.aborted) return
      resource = await create(controller.signal)
      if (controller.signal.aborted) return
      const result = await resource.render()
      if (!controller.signal.aborted) onSuccess(result)
    } catch {
      if (!controller.signal.aborted) onError()
      controller.abort()
    } finally {
      finished = true
      if (controller.signal.aborted) dispose()
    }
  })()

  return {
    settled,
    cancel: () => {
      controller.abort()
      if (finished) dispose()
    }
  }
}
