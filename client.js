/**
 * Grove client half: the left-sidebar panel and its cold-start page.
 *
 * Single file, plain JavaScript, no build step. Only `require('react')` plus browser APIs.
 * All data comes from the host half's same-origin routes:
 *   GET  /api/grove/status
 *   POST /api/grove/config
 *   POST /api/grove/capture
 * Styles use `--dsw-alias-*` tokens only.
 */
window.__ModuleLoader__.load({
  id: 'dsh-grove',
  factory: function (require) {
    var React = require('react')
    var h = React.createElement
    var useState = React.useState
    var useEffect = React.useEffect
    var useRef = React.useRef

    var NS = 'grove'
    var STATUS = '/api/grove/status'
    var CONFIG = '/api/grove/config'
    var CAPTURE = '/api/grove/capture'

    var ZH = {
      panel: 'Grove',
      subtitle: '把探索留在自己的 vault 里。',
      'status.connected': '已连接',
      'status.disconnected': '未连接',
      'status.readonly': '只读',
      'status.checking': '正在读取…',
      's0.title': '先连接你的 Obsidian vault',
      's0.body': 'Grove 只读写 vault 里的 Grove/ 文件夹，不读其他笔记。连接后，Harness 里的对话就能落成可回看、可修订的 Markdown。',
      's0.step1': '连接 vault',
      's0.step2': '写下第一条灵感',
      's0.step3': '回到会话继续探索',
      's0.pick': '选择文件夹',
      's0.manual': '手动输入路径',
      's0.placeholder': '/Users/你/Obsidian Vault',
      's0.connect': '连接',
      's0.cancel': '取消',
      's0.hint': '路径会保存到当前 profile 的插件配置；之后可在插件页里修改。',
      's0.stale': '原来的 vault 已不可用：{path}。请重新选择，或把它移回原位。',
      's0.noVault': '这个文件夹里没有 .obsidian。如果它不是 vault 根目录，仍可继续连接。',
      's1.connectedTo': '已连接',
      's1.change': '更换 vault',
      's1.title': '写下第一条灵感',
      's1.body': '一个观察、一个困惑、一句还没想清楚的话都可以。保存后它会出现在 vault 的 Grove/ 文件夹里。',
      's1.placeholder': '比如：为什么组织扩大后，协调成本会上升？',
      's1.save': '保存到 vault',
      's1.saving': '正在保存…',
      's1.saved': '已保存',
      's1.savedBody': '已写入 vault。用 Obsidian 打开 Grove/ 文件夹就能看到。回到会话里，让 AI 用 grove_role 陪你继续想。',
      's1.view': '查看概览',
      's1.another': '另一种开始',
      's1.prompt': '用 grove_role 当我的思想伙伴，先帮我拆开这个问题：<你的问题>',
      's1.copy': '复制提示词',
      's1.copied': '已复制',
      's2.title': '你的知识库',
      's2.total': '条资产',
      's2.recent': '最近更新',
      's2.empty': '还没有笔记。',
      's2.continue': '在会话里继续探索',
      's2.prompt': '用 grove_role 当我的思想伙伴，接着上次的问题继续。',
      's2.count.inspiration': '灵感',
      's2.count.question': '问题',
      's2.count.research': '研究',
      's2.count.claim': '判断',
      's2.count.evidence': '证据',
      'type.inspiration': '灵感',
      'type.question': '问题',
      'type.concept': '概念',
      'type.theory': '理论',
      'type.claim': '判断',
      'type.evidence': '证据',
      'type.method': '方法',
      'type.output': '成果',
      'type.exploration': '探索',
      'type.research': '研究',
      'foot.privacy': 'Grove 只读写 vault 的 Grove/ 文件夹，不读其他笔记。',
      'foot.confirm': 'AI 起草的草稿要你在终端确认后才落盘。',
      'foot.data': '数据是你的 Markdown，随时可以备份或迁移。',
      'err.invalid-path': '路径无效，请填写绝对路径。',
      'err.not-directory': '这个路径不是文件夹。',
      'err.symlink': '这个路径是符号链接，请选择真实目录。',
      'err.save-unavailable': '当前 profile 无法保存插件配置，请手动设置 GROVE_VAULT。',
      'err.not-configured': '还没有连接 vault。',
      'err.invalid-body': '内容不能为空。',
      'err.too-large': '内容太长了，请控制在 128 KiB 以内。',
      'err.network': '连不上面板服务，请重启 DSH 后重试。',
      'err.timeout': '配置已提交，但还没生效。请重启 DSH 后再看。',
      'err.internal': '操作失败，请重试。',
      'err.retry': '重试',
      'err.clipboard': '复制被拦截，请手动选择文本。',
      'loading': '正在读取 vault…',
    }

    var EN = {
      panel: 'Grove',
      subtitle: 'Keep what you explore in your own vault.',
      'status.connected': 'Connected',
      'status.disconnected': 'Not connected',
      'status.readonly': 'Read only',
      'status.checking': 'Reading…',
      's0.title': 'Connect your Obsidian vault',
      's0.body': 'Grove reads and writes only the Grove/ folder inside your vault, never other notes. Once connected, conversations in Harness can become Markdown you can revisit and revise.',
      's0.step1': 'Connect a vault',
      's0.step2': 'Capture a first idea',
      's0.step3': 'Go back to the conversation',
      's0.pick': 'Choose folder',
      's0.manual': 'Enter a path',
      's0.placeholder': '/Users/you/Obsidian Vault',
      's0.connect': 'Connect',
      's0.cancel': 'Cancel',
      's0.hint': 'The path is saved in this profile’s plugin configuration and can be changed later from the Plugins page.',
      's0.stale': 'The previous vault is no longer usable: {path}. Choose it again, or move it back.',
      's0.noVault': 'This folder has no .obsidian. You can still connect if it is a vault root.',
      's1.connectedTo': 'Connected',
      's1.change': 'Change vault',
      's1.title': 'Capture a first idea',
      's1.body': 'An observation, a question, or a thought you have not worked out yet. Saving puts it in the vault’s Grove/ folder.',
      's1.placeholder': 'For example: why do coordination costs rise as an organization grows?',
      's1.save': 'Save to vault',
      's1.saving': 'Saving…',
      's1.saved': 'Saved',
      's1.savedBody': 'Written to the vault. Open the Grove/ folder in Obsidian to see it. Back in the conversation, ask AI to use grove_role and keep thinking.',
      's1.view': 'View overview',
      's1.another': 'Another way to start',
      's1.prompt': 'Use grove_role as my thinking partner and help me unpack this question: <your question>',
      's1.copy': 'Copy prompt',
      's1.copied': 'Copied',
      's2.title': 'Your knowledge base',
      's2.total': 'assets',
      's2.recent': 'Recently updated',
      's2.empty': 'No notes yet.',
      's2.continue': 'Continue in the conversation',
      's2.prompt': 'Use grove_role as my thinking partner and continue from the last question.',
      's2.count.inspiration': 'Inspirations',
      's2.count.question': 'Questions',
      's2.count.research': 'Research',
      's2.count.claim': 'Claims',
      's2.count.evidence': 'Evidence',
      'type.inspiration': 'Inspiration',
      'type.question': 'Question',
      'type.concept': 'Concept',
      'type.theory': 'Theory',
      'type.claim': 'Claim',
      'type.evidence': 'Evidence',
      'type.method': 'Method',
      'type.output': 'Output',
      'type.exploration': 'Exploration',
      'type.research': 'Research',
      'foot.privacy': 'Grove reads and writes only the vault’s Grove/ folder, never other notes.',
      'foot.confirm': 'Content drafted by AI is saved only after you confirm it in the terminal.',
      'foot.data': 'Your data is Markdown you can back up or move at any time.',
      'err.invalid-path': 'That path is not valid. Use an absolute path.',
      'err.not-directory': 'That path is not a folder.',
      'err.symlink': 'That path is a symlink. Choose a real directory.',
      'err.save-unavailable': 'This profile cannot save plugin configuration. Set GROVE_VAULT manually.',
      'err.not-configured': 'No vault is connected yet.',
      'err.invalid-body': 'Write something first.',
      'err.too-large': 'That is too long. Keep it under 128 KiB.',
      'err.network': 'The panel service is unreachable. Restart DSH and try again.',
      'err.timeout': 'The configuration was submitted but has not taken effect. Restart DSH and check again.',
      'err.internal': 'That did not work. Try again.',
      'err.retry': 'Retry',
      'err.clipboard': 'Copy was blocked. Select the text manually.',
      'loading': 'Reading the vault…',
    }

    var boundT = null
    var services = { workspace: null }

    function T(key, vars) {
      if (boundT) {
        try {
          var resolved = boundT(key, vars)
          if (resolved !== undefined && resolved !== null && resolved !== key) return resolved
        } catch (error) { /* fall through to the bundled dictionary */ }
      }
      var value = ZH[key] !== undefined ? ZH[key] : EN[key]
      if (value === undefined) return key
      if (vars) {
        value = value.replace(/\{(\w+)\}/g, function (match, name) {
          return vars[name] === undefined ? match : String(vars[name])
        })
      }
      return value
    }

    function api(path, body) {
      var request = body === undefined
        ? { headers: { accept: 'application/json' } }
        : { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json' }, body: JSON.stringify(body) }
      return fetch(path, request).then(function (response) {
        return response.json().catch(function () { return {} }).then(function (data) {
          if (response.ok) return data
          var error = new Error((data.error && data.error.message) || ('HTTP ' + response.status))
          error.code = data.error && data.error.code
          throw error
        })
      }, function () {
        var error = new Error('network')
        error.code = 'network'
        throw error
      })
    }

    function messageOf(error) {
      if (error && error.code && ZH['err.' + error.code] !== undefined) return T('err.' + error.code)
      if (error && error.code === 'network') return T('err.network')
      return (error && error.message) || T('err.internal')
    }

    function when(iso) {
      if (!iso) return ''
      var date = new Date(iso)
      if (isNaN(date.getTime())) return ''
      return date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0') + '-' + String(date.getDate()).padStart(2, '0')
    }

    function copyText(text) {
      if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(text)
      return Promise.reject(new Error('clipboard'))
    }

    function waitForVault(expected, tries) {
      return api(STATUS).catch(function () { return null }).then(function (status) {
        if (status && status.configured && status.usable && (expected === undefined || status.vault === expected)) return status
        if (tries <= 0) {
          var error = new Error('timeout')
          error.code = 'timeout'
          throw error
        }
        return new Promise(function (resolve) { setTimeout(resolve, 700) }).then(function () {
          return waitForVault(expected, tries - 1)
        })
      })
    }

    // ────────────────────────────────────────────────────── the page
    function GrovePage() {
      var [status, setStatus] = useState(null)
      var [loading, setLoading] = useState(true)
      var [error, setError] = useState(null)
      var [busy, setBusy] = useState('')
      var [manual, setManual] = useState(false)
      var [draft, setDraft] = useState('')
      var [pathDraft, setPathDraft] = useState('')
      var [firstNote, setFirstNote] = useState(null)
      var [copied, setCopied] = useState(false)
      var [changing, setChanging] = useState(false)
      var mounted = useRef(true)

      useEffect(function () {
        mounted.current = true
        load()
        return function () { mounted.current = false }
      }, [])

      function load() {
        setLoading(true)
        return api(STATUS).then(function (next) {
          if (!mounted.current) return
          setStatus(next)
          setError(null)
        }, function (problem) {
          if (!mounted.current) return
          setError(problem)
        }).then(function () {
          if (mounted.current) setLoading(false)
        })
      }

      function connect(path) {
        setBusy('connect')
        setError(null)
        return api(CONFIG, { path: path }).then(function () {
          return waitForVault(path, 12)
        }).then(function (next) {
          if (!mounted.current) return
          setStatus(next)
          setManual(false)
          setChanging(false)
        }, function (problem) {
          if (!mounted.current) return
          setError(problem)
        }).then(function () {
          if (mounted.current) setBusy('')
        })
      }

      function pickFolder() {
        var workspace = services.workspace
        if (!workspace || typeof workspace.pickDirectory !== 'function') {
          setManual(true)
          return
        }
        setBusy('pick')
        Promise.resolve(workspace.pickDirectory()).then(function (path) {
          if (!path) {
            if (mounted.current) setBusy('')
            return
          }
          if (mounted.current) setBusy('')
          connect(path)
        }, function () {
          if (!mounted.current) return
          setBusy('')
          setManual(true)
        })
      }

      function submitManual() {
        var path = pathDraft.trim()
        if (path === '') return
        connect(path)
      }

      function saveFirst() {
        var body = draft.trim()
        if (body === '') return
        setBusy('capture')
        setError(null)
        api(CAPTURE, { body: body }).then(function (note) {
          if (!mounted.current) return
          setFirstNote(note)
          setDraft('')
          return api(STATUS).then(function (next) {
            if (mounted.current) setStatus(next)
          })
        }, function (problem) {
          if (mounted.current) setError(problem)
        }).then(function () {
          if (mounted.current) setBusy('')
        })
      }

      function copyPrompt(text) {
        copyText(text).then(function () {
          if (!mounted.current) return
          setCopied(true)
          setTimeout(function () { if (mounted.current) setCopied(false) }, 1600)
        }, function (problem) {
          if (mounted.current) setError(problem)
        })
      }

      var connected = !!(status && status.configured && status.usable)
      var total = status && status.counts ? Number(status.counts.total) || 0 : 0
      var connectView = h(Connect, {
        busy: busy, manual: manual, error: error, pathDraft: pathDraft,
        stale: !changing && status && status.configured && !status.usable ? status.vault : null,
        onPath: setPathDraft, onPick: pickFolder, onSubmit: submitManual,
        onManual: function () { setManual(true) },
        onManualCancel: function () { setManual(false) },
        onCancel: changing || connected ? function () { setChanging(false); setManual(false) } : null,
      })

      return h('div', { className: 'gr-root' },
        h('style', null, CSS),
        h('div', { className: 'gr-scroll' },
          h('div', { className: 'gr-inner' },
            h(Header, {
              status: status, loading: loading, error: error,
              onChange: connected ? function () {
                setPathDraft(status.vault || '')
                setManual(false)
                setChanging(true)
              } : null,
            }),
            error ? h(ErrorNote, { error: error, onRetry: load }) : null,
            loading && status === null
              ? h('div', { className: 'gr-card' }, h('div', { className: 'gr-body' }, T('loading')))
              : changing || !connected
                ? connectView
                : total > 0 && firstNote === null
                  ? h(Overview, { status: status, onCopy: copyPrompt })
                  : h(FirstNote, {
                    status: status, draft: draft, busy: busy, note: firstNote,
                    onDraft: setDraft, onSave: saveFirst, onCopy: copyPrompt,
                    onOverview: function () { setFirstNote(null) },
                  }),
            h(Footer, null),
          ),
        ),
      )
    }

    function Header(props) {
      var status = props.status
      var connected = !!(status && status.configured && status.usable)
      var label = props.loading && !status ? T('status.checking') : connected ? T('status.connected') : T('status.disconnected')
      return h('div', { className: 'gr-head' },
        h('div', { className: 'gr-mark' }, h(GroveMark, { size: 26 })),
        h('div', { className: 'gr-headtext' },
          h('div', { className: 'gr-title' }, T('panel')),
          h('div', { className: 'gr-sub' }, status && status.vault ? status.vault : T('subtitle')),
        ),
        h('div', { className: 'gr-head-actions' },
          props.onChange
            ? h('button', { className: 'gr-btn gr-btn-ghost gr-btn-sm', onClick: props.onChange }, T('s1.change'))
            : null,
          h('span', { className: 'gr-pill', 'aria-live': 'polite' },
            h('span', { className: 'gr-dot ' + (connected ? 'gr-dot-ok' : '') }),
            label,
            connected && status.writable === false ? h('span', null, ' · ' + T('status.readonly')) : null,
          ),
        ),
      )
    }

    function Connect(props) {
      return h('div', { className: 'gr-card' },
        props.stale ? h('div', { className: 'gr-err' }, T('s0.stale', { path: props.stale })) : null,
        h('div', { className: 'gr-h2' }, T('s0.title')),
        h('div', { className: 'gr-body' }, T('s0.body')),
        h('div', { className: 'gr-steps' },
          h('div', { className: 'gr-step' }, h('b', null, '1'), T('s0.step1')),
          h('div', { className: 'gr-step' }, h('b', null, '2'), T('s0.step2')),
          h('div', { className: 'gr-step' }, h('b', null, '3'), T('s0.step3')),
        ),
        props.manual
          ? h('div', { className: 'gr-row' },
            h('input', {
              className: 'gr-input', value: props.pathDraft, spellCheck: false,
              placeholder: T('s0.placeholder'), 'aria-label': T('s0.placeholder'),
              onChange: function (event) { props.onPath(event.target.value) },
              onKeyDown: function (event) { if (event.key === 'Enter') props.onSubmit() },
            }),
            h('button', { className: 'gr-btn gr-btn-sm', disabled: props.busy !== '', onClick: props.onSubmit }, T('s0.connect')),
            h('button', { className: 'gr-btn gr-btn-ghost gr-btn-sm', disabled: props.busy !== '', onClick: props.onManualCancel }, T('s0.cancel')),
          )
          : h('div', { className: 'gr-row' },
            h('button', { className: 'gr-btn', disabled: props.busy !== '', onClick: props.onPick }, props.busy === 'pick' ? T('status.checking') : T('s0.pick')),
            h('button', { className: 'gr-btn gr-btn-ghost gr-btn-sm', disabled: props.busy !== '', onClick: props.onManual }, T('s0.manual')),
            props.onCancel
              ? h('button', { className: 'gr-btn gr-btn-ghost gr-btn-sm', disabled: props.busy !== '', onClick: props.onCancel }, T('s0.cancel'))
              : null,
          ),
        h('div', { className: 'gr-meta' }, T('s0.hint')),
      )
    }

    function FirstNote(props) {
      var status = props.status
      if (props.note) {
        return h('div', { className: 'gr-card' },
          h('div', { className: 'gr-h2 gr-ok' }, '✓ ' + T('s1.saved')),
          h('div', { className: 'gr-body' }, T('s1.savedBody')),
          h('div', { className: 'gr-row' }, h('span', { className: 'gr-path' }, props.note.path)),
          h('div', { className: 'gr-row' }, h('button', { className: 'gr-btn gr-btn-sm', onClick: props.onOverview }, T('s1.view'))),
        )
      }
      return h(React.Fragment, null,
        h('div', { className: 'gr-card' },
          h('div', { className: 'gr-meta' }, T('s1.connectedTo') + ' · ' + (status.vault || '')),
          h('div', { className: 'gr-h2' }, T('s1.title')),
          h('div', { className: 'gr-body' }, T('s1.body')),
          h('textarea', {
            className: 'gr-textarea', value: props.draft, placeholder: T('s1.placeholder'),
            'aria-label': T('s1.title'),
            onChange: function (event) { props.onDraft(event.target.value) },
            onKeyDown: function (event) {
              if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') props.onSave()
            },
          }),
          h('div', { className: 'gr-row' },
            h('button', { className: 'gr-btn', disabled: props.busy !== '' || props.draft.trim() === '', onClick: props.onSave },
              props.busy === 'capture' ? T('s1.saving') : T('s1.save')),
            h('span', { className: 'gr-meta' }, '⌘↵'),
          ),
        ),
        h('div', { className: 'gr-card' },
          h('div', { className: 'gr-h2' }, T('s1.another')),
          h('pre', { className: 'gr-code' }, T('s1.prompt')),
          h('button', { className: 'gr-btn gr-btn-ghost gr-btn-sm', onClick: function () { props.onCopy(T('s1.prompt')) } }, T('s1.copy')),
        ),
      )
    }

    function Overview(props) {
      var status = props.status
      var counts = status.counts || {}
      var stats = ['inspiration', 'question', 'research', 'claim', 'evidence'].map(function (type) {
        return h('div', { className: 'gr-stat', key: type },
          h('b', null, String(counts[type] || 0)),
          h('span', null, T('s2.count.' + type)),
        )
      })
      var recent = status.recent || []
      return h(React.Fragment, null,
        h('div', { className: 'gr-card' },
          h('div', { className: 'gr-row', style: { justifyContent: 'space-between' } },
            h('div', { className: 'gr-h2' }, T('s2.title')),
            h('div', { className: 'gr-meta' }, String(counts.total || 0) + ' ' + T('s2.total')),
          ),
          h('div', { className: 'gr-stats' }, stats),
        ),
        h('div', { className: 'gr-card' },
          h('div', { className: 'gr-h2' }, T('s2.recent')),
          recent.length === 0
            ? h('div', { className: 'gr-body' }, T('s2.empty'))
            : h('div', { className: 'gr-recent' }, recent.map(function (item) {
              return h('div', { className: 'gr-item', key: item.id + ':' + item.version },
                h('span', { className: 'gr-type' }, T('type.' + item.type)),
                h('span', { className: 'gr-itemtitle', title: item.title || '' }, item.title || item.id),
                h('span', { className: 'gr-meta' }, 'v' + item.version + (item.at ? ' · ' + when(item.at) : '')),
              )
            })),
        ),
        h('div', { className: 'gr-card' },
          h('div', { className: 'gr-h2' }, T('s2.continue')),
          h('pre', { className: 'gr-code' }, T('s2.prompt')),
          h('button', { className: 'gr-btn gr-btn-ghost gr-btn-sm', onClick: function () { props.onCopy(T('s2.prompt')) } }, T('s1.copy')),
        ),
      )
    }

    function ErrorNote(props) {
      return h('div', { className: 'gr-card', role: 'alert' },
        h('div', { className: 'gr-err' }, messageOf(props.error)),
        h('button', { className: 'gr-btn gr-btn-ghost gr-btn-sm', onClick: props.onRetry }, T('err.retry')),
      )
    }

    function Footer() {
      return h('div', { className: 'gr-foot' },
        h('div', null, T('foot.privacy')),
        h('div', null, T('foot.confirm')),
        h('div', null, T('foot.data')),
      )
    }

    function GroveMark(props) {
      var size = Number(props && props.size) || 36
      return h('svg', {
        xmlns: 'http://www.w3.org/2000/svg', width: size, height: size, viewBox: '0 0 36 36',
        'aria-hidden': true, focusable: 'false',
      },
      h('g', { transform: 'translate(18 18) scale(1.12) translate(-18.6 -20.9)' },
        h('path', { d: 'M16.9 30.4h2.2l-.65-12.3h-.9z', fill: '#1B3A2E' }),
        h('path', { d: 'M18.4 19c2.2-6.5 8.3-9.4 10.5-8.15-1 5.3-4.9 8.45-10.5 8.15Z', fill: '#2F7D5B' }),
        h('path', { d: 'M17.6 23c-2.2-5.1-6.5-7.3-8.5-6.3.7 4.1 4.3 6.3 8.5 6.3Z', fill: '#5FA37E' }),
        h('path', { d: 'M15.4 31.5h5.2', stroke: '#C98A3B', 'stroke-width': 2.2, 'stroke-linecap': 'round', fill: 'none' }),
      ))
    }

    function GroveIcon(props) {
      var size = Number(props && props.size) || 16
      return h(GroveMark, { size: size })
    }

    var CSS = [
      '.gr-root{height:100%;min-height:0;display:flex;flex-direction:column;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);font-family:inherit;font-size:13px;line-height:1.6;box-sizing:border-box;padding-top:min(var(--dsh-frame-top-clearance,0px),28px)}',
      '.gr-scroll{flex:1 1 auto;min-height:0;overflow:auto}',
      '.gr-inner{max-width:760px;margin:0 auto;padding:28px 24px 40px;display:flex;flex-direction:column;gap:18px;box-sizing:border-box}',
      '.gr-head{display:flex;align-items:flex-start;gap:14px;flex-wrap:wrap}',
      '.gr-mark{flex:none;width:44px;height:44px;border-radius:12px;background:var(--dsw-alias-bg-layer-1);border:1px solid var(--dsw-alias-border-l1);display:grid;place-items:center}',
      '.gr-headtext{min-width:0;flex:1 1 220px}',
      '.gr-title{font-size:20px;font-weight:600;line-height:1.3}',
      '.gr-sub{color:var(--dsw-alias-label-secondary);font-size:13px;margin-top:2px;word-break:break-all}',
      '.gr-head-actions{display:flex;align-items:center;gap:8px;margin-left:auto;flex:none}',
      '.gr-pill{display:inline-flex;align-items:center;gap:6px;font-size:12px;color:var(--dsw-alias-label-secondary);border:1px solid var(--dsw-alias-border-l1);border-radius:999px;padding:3px 10px;white-space:nowrap;background:var(--dsw-alias-bg-layer-1)}',
      '.gr-dot{width:6px;height:6px;border-radius:50%;background:var(--dsw-alias-state-idle-primary)}',
      '.gr-dot-ok{background:var(--dsw-alias-state-success-primary)}',
      '.gr-card{background:var(--dsw-alias-bg-layer-1);border:1px solid var(--dsw-alias-border-l1);border-radius:12px;padding:20px;display:flex;flex-direction:column;gap:12px;box-sizing:border-box}',
      '.gr-h2{font-size:15px;font-weight:600;line-height:1.4}',
      '.gr-body{color:var(--dsw-alias-label-secondary);font-size:13px}',
      '.gr-meta{font-size:12px;color:var(--dsw-alias-label-secondary)}',
      '.gr-btn{appearance:none;border:0;border-radius:8px;background:var(--dsw-alias-brand-primary);color:#fff;font:inherit;font-size:13px;font-weight:600;padding:8px 14px;cursor:pointer;display:inline-flex;align-items:center;gap:8px;align-self:flex-start}',
      '.gr-btn:hover{opacity:.92}',
      '.gr-btn:disabled{opacity:.5;cursor:default}',
      '.gr-btn-ghost{background:transparent;color:var(--dsw-alias-label-primary);border:1px solid var(--dsw-alias-border-l2)}',
      '.gr-btn-sm{padding:5px 10px;font-size:12px;font-weight:500}',
      '.gr-input,.gr-textarea{width:100%;box-sizing:border-box;background:var(--dsw-alias-bg-layer-2);border:1px solid var(--dsw-alias-border-l1);border-radius:8px;color:var(--dsw-alias-label-primary);font:inherit;font-size:13px;padding:9px 11px;outline:none}',
      '.gr-textarea{min-height:96px;resize:vertical;line-height:1.6}',
      '.gr-input:focus-visible,.gr-textarea:focus-visible{outline:2px solid var(--dsw-alias-brand-primary);outline-offset:1px}',
      '.gr-row{display:flex;gap:8px;align-items:center;flex-wrap:wrap;min-width:0}',
      '.gr-err{color:var(--dsw-alias-state-error-primary);font-size:12px;white-space:pre-wrap}',
      '.gr-ok{color:var(--dsw-alias-state-success-primary)}',
      '.gr-path{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px;background:var(--dsw-alias-bg-layer-2);border:1px solid var(--dsw-alias-border-l1);border-radius:6px;padding:2px 6px;word-break:break-all}',
      '.gr-steps{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}',
      '.gr-step{border:1px solid var(--dsw-alias-border-l1);border-radius:10px;padding:12px;font-size:12px;color:var(--dsw-alias-label-secondary);background:var(--dsw-alias-bg-base)}',
      '.gr-step b{display:block;color:var(--dsw-alias-label-primary);font-size:12px;margin-bottom:2px}',
      '.gr-stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(112px,1fr));gap:10px}',
      '.gr-stat{border:1px solid var(--dsw-alias-border-l1);border-radius:10px;padding:12px;background:var(--dsw-alias-bg-base);min-width:0}',
      '.gr-stat b{display:block;font-size:20px;font-weight:600;line-height:1.2}',
      '.gr-stat span{font-size:12px;color:var(--dsw-alias-label-secondary)}',
      '.gr-recent{display:flex;flex-direction:column;min-width:0}',
      '.gr-item{display:flex;align-items:baseline;gap:10px;padding:9px 0;border-bottom:1px solid var(--dsw-alias-border-l1);min-width:0}',
      '.gr-item:last-child{border-bottom:0}',
      '.gr-type{flex:none;font-size:11px;color:var(--dsw-alias-label-secondary);border:1px solid var(--dsw-alias-border-l1);border-radius:999px;padding:1px 8px}',
      '.gr-itemtitle{flex:1 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.gr-code{white-space:pre-wrap;word-break:break-word;background:var(--dsw-alias-bg-layer-2);border:1px solid var(--dsw-alias-border-l1);border-radius:8px;padding:10px 12px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px;line-height:1.6;margin:0}',
      '.gr-foot{border-top:1px solid var(--dsw-alias-border-l1);padding-top:12px;color:var(--dsw-alias-label-secondary);font-size:12px;display:flex;flex-direction:column;gap:4px}',
      '@media (max-width:560px){.gr-inner{padding:18px 14px 32px}.gr-head{flex-wrap:wrap}.gr-steps{grid-template-columns:1fr}.gr-stats{grid-template-columns:repeat(2,1fr)}.gr-stat:last-child:nth-child(odd){grid-column:1/-1}.gr-btn{align-self:stretch;justify-content:center}}',
      '@media (prefers-reduced-motion:reduce){.gr-btn{transition:none}}',
    ].join('\n')

    // ────────────────────────────────────────────────────── registration
    function apply(ctx) {
      var locale = ctx.locale
      if (locale) {
        try {
          if (typeof ctx.effect === 'function') {
            ctx.effect(function () { return locale.register(NS, { zh: ZH, en: EN }) }, 'grove: dictionaries')
          }
          if (typeof locale.bind === 'function') boundT = locale.bind(NS)
        } catch (error) {
          console.warn('[grove] locale registration failed', error)
        }
      }
      try {
        services.workspace = ctx.get('uiWorkspace')
      } catch (error) {
        services.workspace = null
      }
      var slots = ctx.slots
      if (!slots || typeof slots.inject !== 'function' || typeof slots.register !== 'function') {
        console.warn('[grove] slots service unavailable; the panel is not mounted')
        return
      }
      slots.inject('main', function () {
        return slots.register({ name: 'main', key: 'grove', locale: NS }, GrovePage)
      })
      slots.inject('sidebar.panellist', function () {
        return slots.register({
          name: 'sidebar.panellist', id: 'grove', order: 40,
          label: function () { return T('panel') }, locale: NS,
        }, GroveIcon)
      })
    }

    return { inject: ['slots', 'locale'], apply: apply }
  },
})
