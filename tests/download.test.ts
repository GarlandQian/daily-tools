import assert from 'node:assert/strict'
import { resolveObjectURL } from 'node:buffer'
import { test, type TestContext } from 'node:test'

import { downloadBlob, downloadText } from '../src/utils/download.ts'

interface DownloadAnchor {
  download: string
  href: string
  hidden: boolean
  isConnected: boolean
  click: () => void
  remove: () => void
}

const browserDownloads = (t: TestContext, failure?: 'append' | 'click') => {
  const anchors: DownloadAnchor[] = []
  const clicks: DownloadAnchor[] = []
  const originalDocument = Object.getOwnPropertyDescriptor(globalThis, 'document')
  const error = new Error(`Download ${failure} failed`)

  t.mock.timers.enable({ apis: ['setTimeout'] })
  Object.defineProperty(globalThis, 'document', {
    configurable: true,
    value: {
      createElement: (tag: string) => {
        assert.equal(tag, 'a')
        const anchor: DownloadAnchor = {
          download: '',
          href: '',
          hidden: false,
          isConnected: false,
          click: () => {
            assert.equal(anchor.isConnected, true)
            assert.ok(resolveObjectURL(anchor.href), 'download URL must be live when clicked')
            clicks.push(anchor)
            if (failure === 'click') throw error
          },
          remove: () => {
            anchor.isConnected = false
          }
        }
        anchors.push(anchor)
        return anchor
      },
      body: {
        appendChild: (anchor: DownloadAnchor) => {
          if (failure === 'append') throw error
          anchor.isConnected = true
          return anchor
        }
      }
    }
  })
  t.after(() => {
    t.mock.timers.runAll()
    if (originalDocument) {
      Object.defineProperty(globalThis, 'document', originalDocument)
    } else {
      Reflect.deleteProperty(globalThis, 'document')
    }
  })

  return { anchors, clicks, error }
}

test('text downloads preserve UTF-8 bytes and filename without adding a BOM', async t => {
  const { anchors, clicks } = browserDownloads(t)
  const content = '中文 café 🔐\r\nsecond line\n'

  downloadText(content, '导出.txt')

  assert.equal(clicks.length, 1)
  assert.equal(clicks[0].download, '导出.txt')
  assert.equal(anchors[0].isConnected, false)
  const blob = resolveObjectURL(clicks[0].href)
  assert.ok(blob)
  assert.equal(blob.type, 'text/plain;charset=utf-8')
  assert.deepEqual(new Uint8Array(await blob.arrayBuffer()), new TextEncoder().encode(content))

  t.mock.timers.tick(999)
  assert.ok(resolveObjectURL(clicks[0].href), 'keep the URL alive while the download starts')
  t.mock.timers.tick(1)
  assert.equal(resolveObjectURL(clicks[0].href), undefined)
})

test('explicit MIME types and existing CSV byte sequences are preserved', async t => {
  const { clicks } = browserDownloads(t)
  const content = '\uFEFF"name","value"\r\n"hello, world","a""b"\r\n'

  downloadText(content, 'report.csv', 'text/csv;charset=utf-8')

  const blob = resolveObjectURL(clicks[0].href)
  assert.ok(blob)
  assert.equal(blob.type, 'text/csv;charset=utf-8')
  assert.equal(clicks[0].download, 'report.csv')
  assert.deepEqual(new Uint8Array(await blob.arrayBuffer()), new TextEncoder().encode(content))
})

test('binary downloads preserve bytes and MIME type, with independent cleanup', async t => {
  const { anchors, clicks } = browserDownloads(t)
  const bytes = Uint8Array.from([0, 255, 128, 13, 10])

  downloadBlob(new Blob([bytes], { type: 'application/octet-stream' }), 'original.bin')
  t.mock.timers.tick(500)
  downloadText('', '.env', '')

  assert.equal(clicks.length, 2)
  assert.notEqual(clicks[0].href, clicks[1].href)
  assert.ok(anchors.every(anchor => !anchor.isConnected))
  const binary = resolveObjectURL(clicks[0].href)
  const empty = resolveObjectURL(clicks[1].href)
  assert.ok(binary)
  assert.ok(empty)
  assert.equal(binary.type, 'application/octet-stream')
  assert.equal(clicks[0].download, 'original.bin')
  assert.deepEqual(new Uint8Array(await binary.arrayBuffer()), bytes)
  assert.equal(empty.size, 0)
  assert.equal(empty.type, '')
  assert.equal(clicks[1].download, '.env')

  t.mock.timers.tick(500)
  assert.equal(resolveObjectURL(clicks[0].href), undefined)
  assert.ok(resolveObjectURL(clicks[1].href))
  t.mock.timers.tick(500)
  assert.equal(resolveObjectURL(clicks[1].href), undefined)
})

for (const failure of ['append', 'click'] as const) {
  test(`a failed ${failure} propagates the error and cleans up its anchor and URL`, t => {
    const { anchors, error } = browserDownloads(t, failure)

    assert.throws(() => downloadText('content', 'failure.txt'), error)
    assert.equal(anchors.length, 1)
    assert.equal(anchors[0].isConnected, false)
    t.mock.timers.runAll()
    assert.equal(resolveObjectURL(anchors[0].href), undefined)
  })
}
