/** Start a browser download while keeping its object URL alive for navigation. */
export const downloadBlob = (blob: Blob, filename: string) => {
  const anchor = document.createElement('a')
  const url = URL.createObjectURL(blob)

  try {
    anchor.href = url
    anchor.download = filename
    anchor.hidden = true
    document.body.appendChild(anchor)
    anchor.click()
  } finally {
    try {
      anchor.remove()
    } finally {
      // Browsers can start consuming the URL after click() returns.
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    }
  }
}

export const downloadText = (
  content: string,
  filename: string,
  type = 'text/plain;charset=utf-8'
) => downloadBlob(new Blob([content], { type }), filename)
