import type { Options as ExcelPreviewOptions } from '@js-preview/excel'
import type { JsPdfPreview } from '@js-preview/pdf'

import { type PreviewRenderLimit, trimPreviewElements } from '../components/previewGuards'
import type { LocalPreviewFormat } from '../hooks/useLocalFilePreview'
import { limitExcelWorkbook, type PreviewWorkbook } from './excelPreviewLimits'

export const MAX_DOCX_SIZE = 25 * 1024 * 1024
export const MAX_DOCX_RENDER_PAGES = 80
export const MAX_EXCEL_SIZE = 25 * 1024 * 1024
export const MAX_PDF_SIZE = 50 * 1024 * 1024
export const MAX_PDF_RENDER_PAGES = 160
export const MAX_PPTX_SIZE = 30 * 1024 * 1024
const PPTX_RENDERED_SLIDES = 1

export const docxPreviewFormat: LocalPreviewFormat<PreviewRenderLimit | null> = {
  maxSize: MAX_DOCX_SIZE,
  accepts: file => /\.docx$/i.test(file.name),
  createRenderer: async (host, signal) => {
    const [{ default: jsPreviewDocx }] = await Promise.all([
      import('@js-preview/docx'),
      import('@js-preview/docx/lib/index.css')
    ])
    signal.throwIfAborted()
    const previewer = jsPreviewDocx.init(host)
    return {
      preview: async ({ url }) => {
        await previewer.preview(url)
        return trimPreviewElements(host, 'section.docx', MAX_DOCX_RENDER_PAGES)
      },
      destroy: () => previewer.destroy()
    }
  }
}

export const excelPreviewFormat: LocalPreviewFormat<boolean> = {
  maxSize: MAX_EXCEL_SIZE,
  // The installed renderer stores image resources in a module-level collection.
  serializeSessions: true,
  accepts: file => /\.(xlsx|xls)$/i.test(file.name),
  createRenderer: async (host, signal) => {
    const [{ default: jsPreviewExcel }] = await Promise.all([
      import('@js-preview/excel'),
      import('@js-preview/excel/lib/index.css')
    ])
    signal.throwIfAborted()
    // The runtime supports this callback although its declaration omits it.
    // maxRows/maxCols alone are ignored by this installed library version.
    const options: ExcelPreviewOptions & {
      beforeTransformData: (workbook: PreviewWorkbook) => PreviewWorkbook
      xls?: boolean
    } = {
      beforeTransformData: limitExcelWorkbook,
      minColLength: 12,
      minRowLength: 40,
      showContextmenu: false
    }
    const previewer = jsPreviewExcel.init(host, options)
    return {
      preview: async ({ file, url }) => {
        previewer.setOptions({ ...options, xls: /\.xls$/i.test(file.name) } as typeof options)
        await previewer.preview(url)
        return true
      },
      destroy: () => previewer.destroy()
    }
  }
}

// @js-preview/pdf exposes no page cap. Keep its virtual list bounded using the
// fields in the installed runtime, isolated here from component and hook code.
interface PdfPreviewInternals extends JsPdfPreview {
  options?: { gap?: number }
  pageHeight?: number
  totalItems?: number
  wrapperMain?: HTMLElement
}

const limitPdfPreviewPages = (previewer: PdfPreviewInternals): PreviewRenderLimit | null => {
  const total = previewer.totalItems
  if (typeof total !== 'number' || total <= MAX_PDF_RENDER_PAGES) return null

  previewer.totalItems = MAX_PDF_RENDER_PAGES
  if (previewer.wrapperMain && typeof previewer.pageHeight === 'number') {
    const gap = previewer.options?.gap ?? 10
    previewer.wrapperMain.style.height = `${(previewer.pageHeight + gap) * MAX_PDF_RENDER_PAGES - gap}px`
  }
  return { total, visible: MAX_PDF_RENDER_PAGES }
}

export const pdfPreviewFormat: LocalPreviewFormat<PreviewRenderLimit | null> = {
  maxSize: MAX_PDF_SIZE,
  accepts: file => /\.pdf$/i.test(file.name) || file.type === 'application/pdf',
  createRenderer: async (host, signal) => {
    const { default: jsPreviewPdf } = await import('@js-preview/pdf')
    signal.throwIfAborted()
    let previewer: JsPdfPreview | undefined
    return {
      preview: ({ url }) =>
        new Promise<PreviewRenderLimit | null>((resolve, reject) => {
          previewer = jsPreviewPdf.init(host, {
            onError: reject,
            onRendered: () => resolve(previewer ? limitPdfPreviewPages(previewer) : null)
          })
          // The installed implementation returns void, despite declaring a Promise.
          // Render callbacks determine readiness; a returned rejection is handled too.
          Promise.resolve(previewer.preview(url)).catch(reject)
        }),
      destroy: () => previewer?.destroy()
    }
  }
}

export const pptxPreviewFormat: LocalPreviewFormat<PreviewRenderLimit | null> = {
  maxSize: MAX_PPTX_SIZE,
  // Chart teardown broadcasts through the library's module-level event emitter.
  serializeSessions: true,
  accepts: file => /\.pptx$/i.test(file.name),
  createRenderer: async (host, signal) => {
    const { init } = await import('pptx-preview')
    signal.throwIfAborted()
    const measuredWidth = Math.floor(host.getBoundingClientRect().width || host.clientWidth)
    const previewer = init(host, {
      width: measuredWidth > 0 ? Math.min(measuredWidth, 1200) : 960,
      height: 700,
      mode: 'slide'
    })
    return {
      preview: async ({ file }) => {
        const buffer = await file.arrayBuffer()
        signal.throwIfAborted()
        await previewer.preview(buffer)
        // Chart rendering schedules a zero-delay initialization task. Let it finish
        // before a cancelled session disposes the library's shared chart resources.
        await new Promise(resolve => setTimeout(resolve, 0))
        return previewer.slideCount > PPTX_RENDERED_SLIDES
          ? { total: previewer.slideCount, visible: PPTX_RENDERED_SLIDES }
          : null
      },
      destroy: () => previewer.destroy()
    }
  }
}
