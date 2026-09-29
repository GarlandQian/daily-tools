import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

import ts from 'typescript'

// Validate the real static catalog against filesystem routes and translations.
// Parse only metadata here so this contract check does not need a DOM/JSX loader.
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const menuSource = ts.createSourceFile(
  'menus.tsx',
  readFileSync(join(root, 'src/config/menus.tsx'), 'utf8'),
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.TSX
)

interface MenuEntry {
  path: string
  labelKey?: string
  children: MenuEntry[]
}

function readEntries(array: ts.ArrayLiteralExpression): MenuEntry[] {
  return array.elements.map(element => {
    assert.ok(ts.isObjectLiteralExpression(element), 'Menu entries must declare static metadata')
    const entry: MenuEntry = { path: '', children: [] }
    for (const property of element.properties) {
      if (!ts.isPropertyAssignment(property)) continue
      const name = property.name.getText(menuSource)
      if (name === 'path' || name === 'labelKey') {
        assert.ok(ts.isStringLiteral(property.initializer))
        entry[name] = property.initializer.text
      }
      if (name === 'children') {
        assert.ok(ts.isArrayLiteralExpression(property.initializer))
        entry.children = readEntries(property.initializer)
      }
    }
    assert.ok(entry.path.startsWith('/'), 'Every menu entry must have an absolute tool path')
    return entry
  })
}

const declaration = menuSource.statements
  .filter(ts.isVariableStatement)
  .flatMap(statement => [...statement.declarationList.declarations])
  .find(item => item.name.getText(menuSource) === 'menus')
assert.ok(declaration?.initializer && ts.isArrayLiteralExpression(declaration.initializer))
const categories = readEntries(declaration.initializer)
const entries = categories.flatMap(category => [category, ...category.children])
const leaves = categories.flatMap(category =>
  category.children.length ? category.children : [category]
)

function collectPages(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const path = join(directory, entry.name)
    return entry.isDirectory() ? collectPages(path) : entry.name === 'page.tsx' ? [path] : []
  })
}

test('every tool route has exactly one catalog entry, preserving path case', () => {
  const routesRoot = join(root, 'src/app/[locale]/(tools)')
  const routes = collectPages(routesRoot).map(page => `/${relative(routesRoot, dirname(page))}`)
  const paths = leaves.map(entry => entry.path)
  assert.equal(new Set(paths).size, paths.length, 'Duplicate tools in navigation')
  assert.equal(
    new Set(entries.map(entry => entry.path)).size,
    entries.length,
    'Duplicate menu paths'
  )
  assert.deepEqual([...paths].sort(), routes.sort())
})

test('both languages provide a nonempty title for every tool and virtual category', () => {
  for (const locale of ['cn', 'en']) {
    const translations = JSON.parse(readFileSync(join(root, `src/locales/${locale}.json`), 'utf8'))
    for (const entry of entries) {
      const key = entry.labelKey ?? `app${entry.path.replaceAll('/', '.')}`
      const label = translations[key] ?? translations[key.replaceAll('-', '_')]
      assert.equal(typeof label, 'string', `${locale}: missing ${key}`)
      assert.ok(label.trim(), `${locale}: empty ${key}`)
    }
  }
})

test('virtual finance and inspection categories retain their existing tools', () => {
  assert.deepEqual(
    categories.find(category => category.path === '/life')?.children.map(item => item.path),
    ['/social/salary', '/social/housing-fund', '/social/pension', '/social/retires']
  )
  assert.deepEqual(
    categories.find(category => category.path === '/inspect')?.children.map(item => item.path),
    ['/social/time', '/social/keycode']
  )
})
