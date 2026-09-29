import assert from 'node:assert/strict'
import { test, type TestContext } from 'node:test'

import { getToolPathname } from '../src/features/navigation/paths.ts'
import {
  isDirectionMode,
  isSupportedLanguage,
  parseRecentToolPaths,
  rememberRecentToolPath
} from '../src/features/navigation/preferences.ts'
import { startThemeChange } from '../src/features/navigation/theme-transition.ts'
import { readLocalStorage, writeLocalStorage } from '../src/utils/storage.ts'

const allowedPaths = new Set(Array.from({ length: 8 }, (_, index) => `/tool/${index}`))

test('prerendered locale paths match public tool URLs without changing case-sensitive slugs', () => {
  const locales = ['en', 'cn']
  for (const pathname of ['/generation/uuid', '/hash/hmacMD5', '/encryption/urlEncode']) {
    assert.equal(getToolPathname(pathname, locales), pathname)
    assert.equal(getToolPathname(`/en${pathname}`, locales), pathname)
    assert.equal(getToolPathname(`/cn${pathname}`, locales), pathname)
  }
  assert.equal(getToolPathname('/en', locales), '/')
  assert.equal(getToolPathname('/cn/', locales), '/')
  assert.equal(getToolPathname('/', locales), '/')
  assert.equal(getToolPathname('/english/tool', locales), '/english/tool')
  assert.equal(getToolPathname('/EN/generation/uuid', locales), '/EN/generation/uuid')
})

test('recent tools reject malformed data and exclude unknown routes and duplicates', () => {
  for (const value of [null, '', '{invalid', '{}', 'null', '42']) {
    assert.deepEqual(parseRecentToolPaths(value, allowedPaths), [])
  }
  assert.deepEqual(
    parseRecentToolPaths(
      JSON.stringify(['/tool/1', null, 7, '/missing', '/tool/1', '/tool/2']),
      allowedPaths
    ),
    ['/tool/1', '/tool/2']
  )
  assert.deepEqual(
    parseRecentToolPaths(JSON.stringify([...allowedPaths]), allowedPaths),
    [...allowedPaths].slice(0, 6)
  )
})

test('remembering a tool moves it to the front without changing the previous list', () => {
  const current = [...allowedPaths].slice(0, 6)
  const snapshot = [...current]
  assert.deepEqual(rememberRecentToolPath(current, '/tool/3', allowedPaths), [
    '/tool/3',
    '/tool/0',
    '/tool/1',
    '/tool/2',
    '/tool/4',
    '/tool/5'
  ])
  assert.deepEqual(rememberRecentToolPath(current, '/tool/7', allowedPaths), [
    '/tool/7',
    '/tool/0',
    '/tool/1',
    '/tool/2',
    '/tool/3',
    '/tool/4'
  ])
  assert.equal(rememberRecentToolPath(current, '/missing', allowedPaths), current)
  assert.deepEqual(current, snapshot)
})

test('preferences only accept supported direction and language values', () => {
  assert.equal(isDirectionMode('rtl'), true)
  assert.equal(isDirectionMode('ltr'), true)
  assert.equal(isDirectionMode('auto'), false)
  assert.equal(isSupportedLanguage('cn'), true)
  assert.equal(isSupportedLanguage('en'), true)
  assert.equal(isSupportedLanguage('en-US'), false)
  assert.equal(isSupportedLanguage(null), false)
})

test('optional storage survives absent browser, denied property access, and quota errors', t => {
  assert.equal(readLocalStorage('test'), null)
  assert.doesNotThrow(() => writeLocalStorage('test', 'value'))

  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: {
      get localStorage() {
        throw new Error('Storage blocked')
      }
    }
  })
  t.after(() => Reflect.deleteProperty(globalThis, 'window'))
  assert.equal(readLocalStorage('test'), null)
  assert.doesNotThrow(() => writeLocalStorage('test', 'value'))

  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: {
      localStorage: {
        getItem: () => 'saved',
        setItem: () => {
          throw new Error('Quota exceeded')
        }
      }
    }
  })
  assert.equal(readLocalStorage('test'), 'saved')
  assert.doesNotThrow(() => writeLocalStorage('test', 'value'))
})

// A minimal DOM boundary keeps the assertions about cancellation and theme
// application, without mounting React or simulating the browser animation engine.
function themeEnvironment(t: TestContext, reducedMotion = false) {
  const classes = new Set<string>()
  const timers = new Map<number, () => void>()
  let timerId = 0
  const root = {
    classList: {
      add: (...names: string[]) => names.forEach(name => classes.add(name)),
      remove: (...names: string[]) => names.forEach(name => classes.delete(name))
    },
    style: { setProperty: () => {} }
  }
  const doc: {
    documentElement: typeof root
    startViewTransition?: (callback: () => void) => {
      finished: Promise<void>
      ready?: Promise<void>
      skipTransition?: () => void
    }
  } = { documentElement: root }
  Object.defineProperty(globalThis, 'document', { configurable: true, value: doc })
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: {
      matchMedia: () => ({ matches: reducedMotion }),
      setTimeout: (callback: () => void) => {
        timers.set(++timerId, callback)
        return timerId
      },
      clearTimeout: (id: number) => timers.delete(id)
    }
  })
  t.after(() => {
    Reflect.deleteProperty(globalThis, 'document')
    Reflect.deleteProperty(globalThis, 'window')
  })
  return { classes, timers, doc }
}

test('fallback theme transition cleans timers and reduced motion skips animation', t => {
  const environment = themeEnvironment(t)
  let applications = 0
  const cleanup = startThemeChange(() => applications++, 10, 20)
  assert.equal(applications, 1)
  assert.equal(environment.classes.has('theme-transitioning'), true)
  assert.equal(environment.timers.size, 1)
  cleanup()
  cleanup()
  assert.equal(environment.classes.size, 0)
  assert.equal(environment.timers.size, 0)

  const reduced = themeEnvironment(t, true)
  startThemeChange(() => applications++, 10, 20)()
  assert.equal(applications, 2)
  assert.equal(reduced.classes.size, 0)
  assert.equal(reduced.timers.size, 0)
})

test('cancelled native transitions cannot apply stale themes or clean a newer transition', async t => {
  const environment = themeEnvironment(t)
  let staleCallback: (() => void) | undefined
  let rejectFinished: ((error: Error) => void) | undefined
  let rejectReady: ((error: Error) => void) | undefined
  let skipped = 0
  environment.doc.startViewTransition = callback => {
    staleCallback = callback
    return {
      finished: new Promise<void>((_, reject) => {
        rejectFinished = reject
      }),
      ready: new Promise<void>((_, reject) => {
        rejectReady = reject
      }),
      skipTransition: () => skipped++
    }
  }
  let applications = 0
  const cleanup = startThemeChange(() => applications++, 0, 0)
  cleanup()
  assert.equal(skipped, 1)
  staleCallback?.()
  assert.equal(applications, 0)
  assert.equal(environment.timers.size, 0)

  // A previous finished promise may settle after the next transition starts.
  environment.classes.add('theme-view-transition')
  rejectReady?.(new Error('Skipped'))
  rejectFinished?.(new Error('Interrupted'))
  await Promise.resolve()
  await Promise.resolve()
  assert.equal(environment.classes.has('theme-view-transition'), true)
})

test('native transition failures use the fallback and successful completion removes animation state', async t => {
  const environment = themeEnvironment(t)
  let applications = 0
  environment.doc.startViewTransition = () => {
    throw new Error('Unsupported transition')
  }
  const cleanup = startThemeChange(() => applications++, 0, 0)
  assert.equal(applications, 1)
  assert.equal(environment.classes.has('theme-transitioning'), true)
  cleanup()

  environment.doc.startViewTransition = callback => {
    callback()
    return { finished: Promise.resolve() }
  }
  startThemeChange(() => applications++, 0, 0)
  await Promise.resolve()
  assert.equal(applications, 2)
  assert.equal(environment.classes.size, 0)
  assert.equal(environment.timers.size, 0)
})
