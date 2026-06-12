export const OUTPUT_PREVIEW_CHARS = 60000
export const OUTPUT_PREVIEW_ROWS = 40

export const createOutputPreview = (value: string, limit = OUTPUT_PREVIEW_CHARS) =>
  value.length > limit ? `${value.slice(0, limit)}\n...` : value

export const isOutputPreviewLimited = (value: string, limit = OUTPUT_PREVIEW_CHARS) =>
  value.length > limit
