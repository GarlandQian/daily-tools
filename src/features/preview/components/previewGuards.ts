export interface PreviewRenderLimit {
  total: number
  visible: number
}

const previewFileNumberFormatter = new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 })

export const formatPreviewFileSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${previewFileNumberFormatter.format(bytes / 1024)} KB`
  return `${previewFileNumberFormatter.format(bytes / (1024 * 1024))} MB`
}

export const trimPreviewElements = (
  root: HTMLElement | null,
  selector: string,
  visible: number
): PreviewRenderLimit | null => {
  if (!root || visible <= 0) return null

  const elements = Array.from(root.querySelectorAll<HTMLElement>(selector))
  if (elements.length <= visible) return null

  for (const element of elements.slice(visible)) {
    element.remove()
  }

  return {
    total: elements.length,
    visible
  }
}
