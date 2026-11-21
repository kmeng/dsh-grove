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

function activeView(tree) {
  return tree.children[1].children[0].children.find(item => item?.props?.className === 'gr-view')
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
    const connect = activeView(tree).children.find(item => item?.props?.onPick)
    await connect.props.onPick()
    assert.equal(picks, 1)
    assert.ok(!changes.some(([slot, value]) => slot === 4 && value === true))
  } finally {
    React.useState = original
  }
})

test('the ideas view offers saved ideas in the shared workspace', () => {
  const { ctx, registrations } = mount()
  const original = React.useState
  let slot = 0
  React.useState = value => [slot++ === 0 ? { configured: true, usable: true, vault: '/fixture' } : value, () => {}]
  try {
    loadModule().factory(requireStub).apply(ctx)
    const page = registrations.find(item => item.name === 'main').component
    const home = activeView(page()).children.find(item => item?.props?.onSearch)
    const fixture = { id: 'test', title: '先前的灵感', version: 1 }
    const tree = home.type({ ...home.props, history: true, recent: [fixture] })
    function contains(node, text) {
      return node === text || (Array.isArray(node) ? node : node?.children ?? []).some(child => contains(child, text))
    }
    assert.ok(contains(tree, '最近灵感'))
    assert.ok(contains(tree, fixture.title))
  } finally {
    React.useState = original
  }
})

test('a slow native picker can complete after a minute', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] })
  const { ctx, registrations } = mount()
  let resolvePicker
  ctx.remote = { directoryPicker: { pick: () => new Promise(resolve => { resolvePicker = resolve }) } }
  ctx.inject = (_services, callback) => callback(ctx)
  const changes = []
  const original = React.useState
  let index = 0
  React.useState = value => [index++ === 1 ? false : value, next => changes.push(next)]
  t.after(() => { React.useState = original })

  loadModule().factory(requireStub).apply(ctx)
  const page = registrations.find(item => item.name === 'main').component
  const connect = activeView(page()).children.find(item => item?.props?.onPick)
  const pending = connect.props.onPick()
  t.mock.timers.tick(61000)
  resolvePicker({ ok: true, value: '/slow-selection' })
  await pending
  assert.ok(changes.includes('connect'))
})

test('every panel inherits DSH theme colors with standalone fallbacks', () => {
  const root = source.match(/\.gr-root\{([^}]+)\}/)?.[1] ?? ''
  assert.match(root, /--gr-paper:var\(--dsw-alias-bg-base,Canvas\)/)
  assert.match(root, /background:var\(--gr-paper\)/)
  assert.match(source, /\.gr-card\{background:var\(--gr-surface\)/)
  assert.match(source, /\.gr-btn\{[^}]*background:var\(--gr-primary\)/)
  assert.match(root, /--gr-ink:var\(--dsw-alias-label-primary,CanvasText\)/)
})

test('resuming a topic opens a scoped detail view without repeating the deep research form', t => {
  const { ctx, registrations } = mount()
  const original = React.useState
  t.after(() => { React.useState = original })
  let slot = 0
  const topic = { meta: { id: 'topic-1', title: '先前的课题', version: 1 }, body: '' }
  const homeState = { 0: { configured: true, usable: true, vault: '/fixture' }, 12: 'research' }
  let useState = value => [homeState[slot++] ?? value, () => {}]
  React.useState = value => useState(value)
  loadModule().factory(requireStub).apply(ctx)
  const page = registrations.find(item => item.name === 'main').component
  const research = activeView(page()).children[0]

  let nextTopic
  let drafted
  function render(selected) {
    const run = { id: 'run-1', status: 'complete', direction: '追问', suggestions: ['补查原文'], report: { id: 'report-1', version: 1 } }
    const state = { 0: [topic], 1: selected, 4: selected ? [run] : [], 5: false }
    slot = 0
    useState = value => {
      const index = slot++
      return [state[index] ?? value, next => {
        if (index === 1) nextTopic = next
        if (index === 11 && typeof next === 'function') drafted = next('我已输入的问题')
      }]
    }
    return research.type(research.props)
  }
  const overview = render(null)
  const resume = overview.children[2].children[1][0]
  assert.ok(resume.children.includes(topic.meta.title))
  resume.props.onClick()
  assert.equal(nextTopic, topic)
  const detail = render(nextTopic)
  const title = detail.children[0].children[1]
  const deepPanel = detail.children.at(-1)
  const [turn] = detail.children.find(child => child?.props?.className === 'gr-conversation-flow').children.find(Array.isArray)
  const [, , report, suggestions] = turn.children[1].children
  assert.equal(title.type, 'h1')
  assert.deepEqual(title.children, [topic.meta.title])
  assert.equal(deepPanel.props.topic, topic.meta.id)
  assert.equal(report.props.id, topic.meta.id)
  assert.equal(report.props.initialReport.id, 'report-1')
  const [suggestion] = suggestions.children.at(-1)
  suggestion.props.onClick()
  assert.equal(drafted, '我已输入的问题\n补查原文')
  const keys = detail.children.map(child => child?.props?.key).filter(key => key != null)
  assert.equal(new Set(keys).size, keys.length)
})
