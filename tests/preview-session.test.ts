import assert from 'node:assert/strict'
import test from 'node:test'

import { startPreviewSession } from '../src/features/preview/lib/previewSession.ts'

const deferred = <Value>() => {
  let resolve!: (value: Value) => void
  let reject!: (error: Error) => void
  const promise = new Promise<Value>((yes, no) => {
    resolve = yes
    reject = no
  })
  return { promise, resolve, reject }
}

const flush = () => new Promise(resolve => setImmediate(resolve))

test('an import failure reports an error and releases the session', async () => {
  let errors = 0
  let releases = 0
  const session = startPreviewSession({
    create: async () => {
      throw new Error('chunk unavailable')
    },
    onSuccess: () => assert.fail('a failed import cannot succeed'),
    onError: () => {
      errors += 1
    },
    release: () => {
      releases += 1
    }
  })
  await session.settled
  session.cancel()
  assert.equal(errors, 1)
  assert.equal(releases, 1)
})

test('clearing during import destroys a late instance without rendering it', async () => {
  const imported = deferred<{ render: () => Promise<string>; dispose: () => void }>()
  let destroyed = 0
  let released = 0
  const session = startPreviewSession({
    create: () => imported.promise,
    onSuccess: () => assert.fail('cancelled imports cannot update state'),
    onError: () => assert.fail('cancellation is not a user-visible error'),
    release: () => {
      released += 1
    }
  })
  await flush()
  session.cancel()
  imported.resolve({
    render: async () => {
      assert.fail('a stale renderer must not start')
    },
    dispose: () => {
      destroyed += 1
    }
  })
  await session.settled
  assert.equal(destroyed, 1)
  assert.equal(released, 1)
})

test('replacement waits for pending render and cleanup, ignoring its stale result', async () => {
  const rendered = deferred<string>()
  const events: string[] = []
  const old = startPreviewSession({
    create: async () => ({
      render: () => {
        events.push('old render')
        return rendered.promise
      },
      dispose: () => {
        events.push('old dispose')
      }
    }),
    onSuccess: () => assert.fail('stale result cannot replace the new file'),
    onError: () => assert.fail('stale errors cannot replace the new file'),
    release: () => {
      events.push('old release')
    }
  })
  await flush()
  old.cancel()
  const current = startPreviewSession({
    previous: old.settled,
    create: async () => {
      events.push('new create')
      return {
        render: async () => 'new',
        dispose: () => {
          events.push('new dispose')
        }
      }
    },
    onSuccess: value => {
      events.push(value)
    },
    onError: () => assert.fail('the replacement should render'),
    release: () => {
      events.push('new release')
    }
  })
  await flush()
  assert.deepEqual(events, ['old render'])
  rendered.resolve('stale')
  await current.settled
  assert.deepEqual(events, ['old render', 'old dispose', 'old release', 'new create', 'new'])
  current.cancel()
  current.cancel()
  assert.deepEqual(events.slice(-2), ['new dispose', 'new release'])
})

test('unmount during rendering suppresses late rejection and releases once', async () => {
  const rendered = deferred<void>()
  let releases = 0
  const session = startPreviewSession({
    create: async () => ({ render: () => rendered.promise, dispose: () => {} }),
    onSuccess: () => assert.fail('an unmounted session cannot succeed'),
    onError: () => assert.fail('an unmounted session cannot show an error'),
    release: () => {
      releases += 1
    }
  })
  await flush()
  session.cancel()
  rendered.reject(new Error('render failed after unmount'))
  await session.settled
  assert.equal(releases, 1)
})

test('an independent renderer can load while a cancelled renderer is still pending', async () => {
  const rendered = deferred<string>()
  const events: string[] = []
  const old = startPreviewSession({
    create: async () => ({
      render: () => rendered.promise,
      dispose: () => {
        events.push('old dispose')
      }
    }),
    onSuccess: () => assert.fail('the cancelled renderer must not update the replacement'),
    onError: () => assert.fail('the cancelled renderer must not report an error'),
    release: () => {
      events.push('old release')
    }
  })
  await flush()
  old.cancel()

  // DOCX and PDF have private hosts and do not join the shared-resource queue.
  const current = startPreviewSession({
    create: async () => ({
      render: async () => 'new file',
      dispose: () => {
        events.push('new dispose')
      }
    }),
    onSuccess: value => {
      events.push(value)
    },
    onError: () => assert.fail('the replacement should render independently'),
    release: () => {
      events.push('new release')
    }
  })
  await current.settled
  assert.deepEqual(events, ['new file'])

  // Late cleanup belongs to the old host and must leave the new renderer alive.
  rendered.resolve('stale file')
  await old.settled
  assert.deepEqual(events, ['new file', 'old dispose', 'old release'])
  current.cancel()
  assert.deepEqual(events.slice(-2), ['new dispose', 'new release'])
})

test('broken library teardown still releases resources and permits another session', async () => {
  let releases = 0
  const session = startPreviewSession({
    create: async () => ({
      render: async () => 'ready',
      dispose: () => {
        throw new Error('destroy')
      }
    }),
    onSuccess: () => {},
    onError: () => assert.fail('render succeeded'),
    release: () => {
      releases += 1
    }
  })
  await session.settled
  assert.doesNotThrow(() => session.cancel())
  assert.equal(releases, 1)
  await session.settled
})
