import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'

const source = await readFile(new URL('../client.js', import.meta.url), 'utf8')

const React = {
  createElement: (type, props, ...children) => ({ type, props, children }),
  useState: value => [value, () => {}],
  useEffect: () => {},
  useRef: () => ({ current: true }),
}

function requireStub(id) {
  if (id === 'react') return React
  throw new Error(`unexpected require: ${id}`)
}

function loadModule() {
  let loaded
  const window = { __ModuleLoader__: { load: value => { loaded = value } } }
  new Function('window', 'require', source)(window, requireStub)
  return loaded
}

function mount() {
  const dictionaries = {}
  const registrations = []
  const effects = []
  const ctx = {
    locale: {
      register(namespace, value) { dictionaries[namespace] = value; return () => {} },
      bind(namespace) {
        return key => dictionaries[namespace]?.zh?.[key] ?? dictionaries[namespace]?.en?.[key] ?? key
      },
    },
    effect(fn) { effects.push(fn()); return () => {} },
    get(name) { return name === 'uiWorkspace' ? { pickDirectory: async () => null } : undefined },
    slots: {
      inject(_name, callback) { callback() },
      register(description, component) { registrations.push({ ...description, component }); return () => {} },
    },
  }
  return { ctx, dictionaries, registrations, effects }
}

test('the client module is a build-free module-loader factory', () => {
  assert.doesNotMatch(source, /^\s*(import|export)\s/m, 'client.js must not use import/export')
  const loaded = loadModule()
  assert.equal(loaded.id, 'dsh-grove')
  assert.equal(typeof loaded.factory, 'function')
})

test('the client registers a Grove sidebar entry and a matching main panel', () => {
  const loaded = loadModule()
  const app = loaded.factory(requireStub)
  assert.deepEqual(app.inject, ['slots', 'locale'])

  const { ctx, dictionaries, registrations } = mount()
  app.apply(ctx)

  const main = registrations.find(item => item.name === 'main')
  const sidebar = registrations.find(item => item.name === 'sidebar.panellist')
  assert.equal(main.key, 'grove')
  assert.equal(typeof main.component, 'function')
  assert.equal(sidebar.id, 'grove')
  assert.equal(sidebar.order, 40)
  assert.equal(sidebar.label(), 'Grove')
  assert.equal(typeof sidebar.component, 'function')

  const icon = sidebar.component({ size: 16, active: false })
  assert.equal(icon.props.size, 16)
  const svg = icon.type(icon.props)
  assert.equal(svg.type, 'svg')
  assert.equal(svg.props.width, 16)

  assert.deepEqual(Object.keys(dictionaries).sort(), ['grove'])
  assert.deepEqual(Object.keys(dictionaries.grove).sort(), ['en', 'zh'])
  assert.deepEqual(Object.keys(dictionaries.grove.zh).sort(), Object.keys(dictionaries.grove.en).sort())
  assert.ok(Object.keys(dictionaries.grove.zh).length >= 40, 'the panel needs its full copy')
  for (const [key, value] of Object.entries(dictionaries.grove.zh)) {
    assert.equal(typeof value, 'string', key)
    assert.ok(value.trim() !== '', key)
  }
})

test('the page renders its cold-start state without a vault', () => {
  const loaded = loadModule()
  const app = loaded.factory(requireStub)
  const { ctx, registrations } = mount()
  app.apply(ctx)
  const page = registrations.find(item => item.name === 'main').component
  const tree = page()
  assert.equal(tree.type, 'div')
  assert.equal(tree.props.className, 'gr-root')
})
