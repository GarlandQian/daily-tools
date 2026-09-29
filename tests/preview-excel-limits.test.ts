import assert from 'node:assert/strict'
import test from 'node:test'

import {
  limitExcelWorkbook,
  MAX_EXCEL_PREVIEW_COLUMNS,
  MAX_EXCEL_PREVIEW_ROWS
} from '../src/features/preview/lib/excelPreviewLimits.ts'

test('Excel preview bounds expanded rows, columns, merges, and image anchors', () => {
  const firstCell = { value: 'keep the original visible cell' }
  const sheet = {
    _rows: Array.from({ length: MAX_EXCEL_PREVIEW_ROWS + 1 }, () => ({
      _cells: [firstCell, ...Array.from({ length: MAX_EXCEL_PREVIEW_COLUMNS }, () => ({}))]
    })),
    _columns: Array.from({ length: MAX_EXCEL_PREVIEW_COLUMNS + 1 }, () => ({})),
    _merges: {
      A1: { model: { bottom: 2, right: 2 } },
      A2000: { model: { bottom: MAX_EXCEL_PREVIEW_ROWS + 1, right: 1 } },
      CB1: { model: { bottom: 1, right: MAX_EXCEL_PREVIEW_COLUMNS + 1 } }
    },
    _media: [
      { range: { tl: { nativeRow: 0, nativeCol: 0 } } },
      { range: { tl: { nativeRow: MAX_EXCEL_PREVIEW_ROWS, nativeCol: 0 } } },
      { range: { br: { nativeRow: 0, nativeCol: MAX_EXCEL_PREVIEW_COLUMNS } } }
    ]
  }
  const workbook = { eachSheet: (visit: (value: typeof sheet) => void) => visit(sheet) }
  assert.equal(limitExcelWorkbook(workbook), workbook)
  assert.equal(sheet._rows.length, MAX_EXCEL_PREVIEW_ROWS)
  assert.equal(sheet._rows[0]._cells.length, MAX_EXCEL_PREVIEW_COLUMNS)
  assert.equal(sheet._rows[0]._cells[0], firstCell)
  assert.equal(sheet._columns.length, MAX_EXCEL_PREVIEW_COLUMNS)
  assert.deepEqual(Object.keys(sheet._merges), ['A1'])
  assert.equal(sheet._media.length, 1)
})
