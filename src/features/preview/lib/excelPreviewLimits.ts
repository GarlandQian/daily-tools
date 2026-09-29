export const MAX_EXCEL_PREVIEW_COLUMNS = 80
export const MAX_EXCEL_PREVIEW_ROWS = 2000

// These are the workbook fields consumed by @js-preview/excel's transform.
// Constrain them before it walks every cell and creates the sheet renderer.
interface PreviewRow {
  _cells: unknown[]
}

interface PreviewSheet {
  _rows: (PreviewRow | undefined)[]
  _columns?: unknown[]
  _merges: Record<string, { model: { bottom: number; right: number } }>
  _media: {
    range?: {
      tl?: { nativeRow: number; nativeCol: number }
      br?: { nativeRow: number; nativeCol: number }
    }
  }[]
}

export interface PreviewWorkbook {
  eachSheet: (callback: (sheet: PreviewSheet) => void) => void
}

export const limitExcelWorkbook = <Workbook extends PreviewWorkbook>(workbook: Workbook) => {
  workbook.eachSheet(sheet => {
    sheet._rows = sheet._rows.slice(0, MAX_EXCEL_PREVIEW_ROWS)
    for (const row of sheet._rows) {
      if (row) row._cells = row._cells.slice(0, MAX_EXCEL_PREVIEW_COLUMNS)
    }
    if (sheet._columns) sheet._columns = sheet._columns.slice(0, MAX_EXCEL_PREVIEW_COLUMNS)

    for (const [key, merge] of Object.entries(sheet._merges)) {
      if (
        merge.model.bottom > MAX_EXCEL_PREVIEW_ROWS ||
        merge.model.right > MAX_EXCEL_PREVIEW_COLUMNS
      ) {
        delete sheet._merges[key]
      }
    }
    sheet._media = sheet._media.filter(({ range }) => {
      const { tl, br } = range ?? {}
      return [tl, br].every(
        anchor =>
          !anchor ||
          (anchor.nativeRow < MAX_EXCEL_PREVIEW_ROWS &&
            anchor.nativeCol < MAX_EXCEL_PREVIEW_COLUMNS)
      )
    })
  })
  return workbook
}
