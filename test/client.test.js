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

function mount(localeId = 'zh') {
  const dictionaries = {}
  const registrations = []
  const effects = []
  const ctx = {
    locale: {
      register(namespace, value) { dictionaries[namespace] = value; return () => {} },
      bind(namespace) {
        return key => {
          const value = dictionaries[namespace]?.[localeId]?.[key]
          return value === undefined ? key : value
        }
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
  assert.equal(sidebar.label(), '知林')
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

test('the sidebar label follows the active locale', () => {
  const loaded = loadModule()
  const app = loaded.factory(requireStub)

  const zh = mount('zh')
  app.apply(zh.ctx)
  assert.equal(zh.registrations.find(item => item.name === 'sidebar.panellist').label(), '知林')

  const en = mount('en')
  app.apply(en.ctx)
  assert.equal(en.registrations.find(item => item.name === 'sidebar.panellist').label(), 'Grove')
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

test('the folder button uses the host picker and cancellation leaves manual entry alone', async () => {
  const { ctx, registrations } = mount()
  let picks = 0
  ctx.remote = { directoryPicker: { async pick() { picks++; return { ok: true, value: null } } } }
  ctx.inject = (services, callback) => {
    assert.deepEqual(services, ['remote', 'remote.directoryPicker'])
    callback(ctx)
  }
  const original = React.useState
  const changes = []
  let index = 0
  React.useState = value => {
    const slot = index++
    return [slot === 1 ? false : value, next => changes.push([slot, next])]
  }
  try {
    loadModule().factory(requireStub).apply(ctx)
    const page = registrations.find(item => item.name === 'main').component
    const tree = page()
    const connect = tree.children[1].children[0].children.find(item => item?.props?.onPick)
    await connect.props.onPick()
    assert.equal(picks, 1)
    assert.ok(!changes.some(([slot, value]) => slot === 4 && value === true))
  } finally {
    React.useState = original
  }
})

test('the connected home offers recent ideas before searching', () => {
  const { ctx, registrations } = mount()
  const original = React.useState
  let slot = 0
  React.useState = value => [slot++ === 0 ? { configured: true, usable: true, vault: '/fixture' } : value, () => {}]
  try {
    loadModule().factory(requireStub).apply(ctx)
    const page = registrations.find(item => item.name === 'main').component
    const home = page().children[1].children[0].children.find(item => item?.props?.onSearch)
    const fixture = { id: 'test', title: '先前的灵感', version: 1 }
    const tree = home.type({ ...home.props, recent: [fixture] })
    function contains(node, text) {
      return node === text || (Array.isArray(node) ? node : node?.children ?? []).some(child => contains(child, text))
    }
    assert.ok(contains(tree, '最近灵感'))
    assert.ok(contains(tree, fixture.title))
  } finally {
    React.useState = original
  }
})
