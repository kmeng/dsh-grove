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
    var CONNECTION = '/api/grove/connection'
    var CONFIG = '/api/grove/config'
    var CAPTURE = '/api/grove/capture'
    var KNOWLEDGE = '/api/grove/knowledge'
    var WORKS = '/api/grove/works'
    var MODEL = '/api/grove/model'
    var FINDINGS = '/api/grove/findings'
    var PARSERS = '/api/grove/parsers'
    var REPORTS = '/api/grove/reports'
    var SOURCES = '/api/grove/sources'
    var RESEARCH = '/api/grove/research'
    var INSPIRATIONS = '/api/grove/inspirations'

    var ZH = {
      's0.pickerUnavailable': '这个宿主暂时无法打开文件夹选择器。可以手动输入路径。',
      's0.pickerFailed': '没能打开文件夹选择器。{message}',
      'asset.knowledge': '知识库',
      'asset.works': '作品',
      'asset.title': '标题',
      'asset.body': '正文',
      'asset.new': '新建',
      'asset.save': '保存',
      'asset.basis': '查看依据',
      'asset.derive': '提炼为知识',
      'asset.compose': '写成作品',
      'asset.research': '带着这条知识深挖',
      'asset.reason': '实践反思 · 什么改变了你的理解？',
      'asset.copy': '复制正文',
      'asset.copied': '已复制',
      'asset.type': '知识类型',
      'asset.missing': '来源不可用。',
      'report.review': '审核为报告草稿',
      'report.discard': '丢弃未保存草稿',
      'model.title': '研究模型',
      'model.enabled': '启用 AI 深挖',
      'model.endpoint': 'HTTPS 模型接口',
      'model.name': '模型名称',
      'model.test': '测试连接',
      'model.apply': '应用模型设置',
      'model.tested': '连接通过。',
      'model.ask': '请 AI 深挖',
      'model.question': '想往哪儿深挖？',
      'model.scope': '仅发送勾选的摘录和本研究先前的发现。',
      'parsers.title': '资料解析设置',
      'parsers.pdf': '启用文本 PDF 解析',
      'parsers.apply': '应用设置',
      'parsers.pending': '正在应用…',
      'parsers.done': '解析设置已应用。',
      'parsers.failed': '设置还没生效，请重试。',
      'parsers.hint': 'Markdown 始终可导入。关闭 PDF 解析后，旧证据仍可回看。',
      'report.title': '研究报告',
      'report.new': '新报告',
      'report.body': '报告正文',
      'report.save': '确认报告',
      'report.history': '历史版本',
      'report.missing': '原件不可用，仍可核对上面的摘录。',
      'report.missingEvidence': '这条证据已不可用。',
      'source.title': '研究资料',
      'source.import': '导入 Markdown 或文本 PDF',
      'source.read': '看看原文',
      'source.save': '保存为证据',
      'source.saved': '证据已保存',
      'source.open': '打开原始文件',
      'research.title': '研究',
      'research.new': '新建独立研究',
      'research.question': '想深挖什么？',
      'research.notes': '研究记录',
      'research.save': '保存研究',
      'research.continue': '接着上次深挖',
      'research.back': '返回首页',
      'research.saved': '已保存。',
      'idea.title': '灵感来了',
      'idea.placeholder': '刚冒出什么点子？先记一句。',
      'idea.save': '💡叮～',
      'idea.saved': '叮～ 记住啦！',
      'idea.find': '找回灵感',
      'idea.search': '搜索',
      'idea.empty': '没找到这条灵感。',
      'idea.version': '历史版本',
      panel: 'Grove',
      menu: '知林',
      subtitle: '记灵感，做研究',
      'status.connected': '已连接',
      'status.disconnected': '未连接',
      'status.readonly': '只读',
      'status.checking': '正在读取…',
      's0.title': '连接 Obsidian 笔记库',
      's0.body': '选一下你在 Obsidian 里打开的笔记库文件夹，连好就能记下第一个灵感。',
      's0.pick': '选择文件夹',
      's0.manual': '手动输入路径',
      's0.placeholder': '/Users/你/Obsidian Vault',
      's0.connect': '连接',
      's0.cancel': '取消',
      's0.stale': '原来的 vault 已不可用：{path}。请重新选择，或把它移回原位。',
      's1.change': '更换 vault',
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
      'foot.privacy': '灵感和研究保存在笔记库的 Grove/ 文件夹里。',
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
      's0.pickerUnavailable': 'This host cannot open a folder picker. You can enter the path manually.',
      's0.pickerFailed': 'Could not open the folder picker. {message}',
      'asset.knowledge': 'Knowledge',
      'asset.works': 'Works',
      'asset.title': 'Title',
      'asset.body': 'Body',
      'asset.new': 'New',
      'asset.save': 'Save',
      'asset.basis': 'View basis',
      'asset.derive': 'Save as knowledge',
      'asset.compose': 'Create a work',
      'asset.research': 'Research from this knowledge',
      'asset.reason': 'Reflection · What changed your understanding?',
      'asset.copy': 'Copy body',
      'asset.copied': 'Copied',
      'asset.type': 'Knowledge type',
      'asset.missing': 'The source is unavailable.',
      'report.review': 'Review as report draft',
      'report.discard': 'Discard unsaved draft',
      'model.title': 'Research model',
      'model.enabled': 'Enable AI research',
      'model.endpoint': 'HTTPS model endpoint',
      'model.name': 'Model name',
      'model.test': 'Test connection',
      'model.apply': 'Apply model settings',
      'model.tested': 'Connection verified.',
      'model.ask': 'Ask AI to investigate',
      'model.question': 'What should we investigate?',
      'model.scope': 'Only selected excerpts and earlier findings in this study are sent.',
      'parsers.title': 'Parser settings',
      'parsers.pdf': 'Enable text PDF parsing',
      'parsers.apply': 'Apply settings',
      'parsers.pending': 'Applying…',
      'parsers.done': 'Parser settings applied.',
      'parsers.failed': 'Settings did not take effect. Try again.',
      'parsers.hint': 'Markdown remains available. Existing evidence stays readable when PDF parsing is off.',
      'report.title': 'Research reports',
      'report.new': 'New report',
      'report.body': 'Report body',
      'report.save': 'Confirm report',
      'report.history': 'History',
      'report.missing': 'Original unavailable. The saved excerpt is shown above.',
      'report.missingEvidence': 'This evidence version is unavailable.',
      'source.title': 'Sources',
      'source.import': 'Import Markdown or text PDF',
      'source.read': 'View original passage',
      'source.save': 'Save as evidence',
      'source.saved': 'Evidence saved',
      'source.open': 'Open original file',
      'research.title': 'Research',
      'research.new': 'New independent study',
      'research.question': 'What do you want to explore?',
      'research.notes': 'Research notes',
      'research.save': 'Save study',
      'research.continue': 'Continue the last study',
      'research.back': 'Back to home',
      'research.saved': 'Saved.',
      'idea.title': 'An idea?',
      'idea.placeholder': 'What just came to mind? Jot it down.',
      'idea.save': '💡 Ding!',
      'idea.saved': 'Ding! Saved.',
      'idea.find': 'Find ideas',
      'idea.search': 'Search',
      'idea.empty': 'No matching ideas.',
      'idea.version': 'History',
      panel: 'Grove',
      menu: 'Grove',
      subtitle: 'Capture ideas and do research',
      'status.connected': 'Connected',
      'status.disconnected': 'Not connected',
      'status.readonly': 'Read only',
      'status.checking': 'Reading…',
      's0.title': 'Connect your Obsidian vault',
      's0.body': 'Choose the folder you open as a vault in Obsidian. Once it’s connected, you can jot down your first idea.',
      's0.pick': 'Choose folder',
      's0.manual': 'Enter a path',
      's0.placeholder': '/Users/you/Obsidian Vault',
      's0.connect': 'Connect',
      's0.cancel': 'Cancel',
      's0.stale': 'The previous vault is no longer usable: {path}. Choose it again, or move it back.',
      's1.change': 'Change vault',
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
      'foot.privacy': 'Your ideas and research are saved in the Grove/ folder inside your vault.',
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
    var services = { picker: null }

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
      var [query, setQuery] = useState('')
      var [notes, setNotes] = useState(null)
      var [selected, setSelected] = useState(null)
      var [saved, setSaved] = useState(false)
      var [changing, setChanging] = useState(false)
      var [page, setPage] = useState('home')
      var [seed, setSeed] = useState(null)

      function navigate(destination, draft) {
        setSeed(draft || null)
        setPage(destination)
      }
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
        return api(CONNECTION, { path: path }).then(function (candidate) {
          return api(CONFIG, { path: candidate.path }).then(function () {
            return waitForVault(candidate.path, 12)
          })
        }).then(function (next) {
          if (!mounted.current) return
          setStatus(next)
          navigate('home')
          setNotes(null)
          setSelected(null)
          setSaved(false)
          setManual(false)
          setChanging(false)
        }, function (problem) {
          if (!mounted.current) return
          setError(problem)
        }).then(function () {
          if (mounted.current) setBusy('')
        })
      }

      async function pickFolder() {
        if (busy) return
        var picker = services.picker
        if (!picker) {
          setError(new Error(T('s0.pickerUnavailable')))
          return
        }
        setError(null)
        setBusy('pick')
        var path
        try {
          var result = await picker.pick()
          if (!result.ok) throw new Error(result.error.message)
          path = result.value
        } catch (problem) {
          if (mounted.current) setError(new Error(T('s0.pickerFailed', { message: messageOf(problem) })))
        } finally {
          if (mounted.current) setBusy('')
        }
        if (mounted.current && path) return connect(path)
      }

      function submitManual() {
        var path = pathDraft.trim()
        if (path === '') return
        connect(path)
      }

      function requestNotes(input, apply) {
        if (busy) return
        setBusy('read')
        setError(null)
        return api(INSPIRATIONS, input).then(function (data) {
          if (mounted.current) apply(data)
        }, function (problem) {
          if (mounted.current) setError(problem)
        }).finally(function () {
          if (mounted.current) setBusy('')
        })
      }

      function saveIdea() {
        var body = draft.trim()
        if (!body || busy) return
        setBusy('capture')
        setError(null)
        setSaved(false)
        api(CAPTURE, { body: body }).then(function () {
          if (!mounted.current) return
          setDraft('')
          setSaved(true)
          setNotes(null)
          setSelected(null)
        }, function (problem) {
          if (mounted.current) setError(problem)
        }).finally(function () {
          if (mounted.current) setBusy('')
        })
      }

      var connected = !!(status && status.configured && status.usable)
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
                : page === 'research'
                  ? h(ResearchPage, { seed: seed, onNavigate: navigate, onBack: function () { navigate('home') } })
                  : page === 'knowledge' || page === 'works'
                    ? h(AssetPage, { key: page, kind: page, seed: seed, onNavigate: navigate })
                    : h(InspirationHome, {
                    onResearch: function () { navigate('research') },
                    onKnowledge: function () { navigate('knowledge') },
                    onWorks: function () { navigate('works') },
                    draft: draft, busy: busy, saved: saved, onSave: saveIdea,
                    onDraft: function (value) { setDraft(value); setSaved(false) },
                    query: query, notes: notes, selected: selected, onQuery: setQuery,
                    onSearch: function () {
                      requestNotes({ query: query }, function (data) { setNotes(data.notes); setSelected(null) })
                    },
                    onSelect: function (id, version) {
                      requestNotes({ id: id, version: version }, setSelected)
                    },
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
      )
    }

    function InspirationHome(props) {
      var selected = props.selected
      return h(React.Fragment, null,
        h('div', { className: 'gr-card' },
          h('label', { className: 'gr-h2', htmlFor: 'gr-idea' }, T('idea.title')),
          h('textarea', {
            id: 'gr-idea', className: 'gr-textarea', value: props.draft,
            placeholder: T('idea.placeholder'),
            onChange: function (event) { props.onDraft(event.target.value) },
            onKeyDown: function (event) {
              if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') props.onSave()
            },
          }),
          h('div', { className: 'gr-row' },
            h('button', { className: 'gr-btn', disabled: !!props.busy || !props.draft.trim(), onClick: props.onSave }, T('idea.save')),
            h('span', { role: 'status' }, props.saved ? T('idea.saved') : ''),
          ),
        ),
        h('div', { className: 'gr-row' },
          h('button', { className: 'gr-btn gr-btn-ghost', disabled: !!props.busy, onClick: props.onResearch }, T('research.title')),
          h('button', { className: 'gr-btn gr-btn-ghost', disabled: !!props.busy, onClick: props.onKnowledge }, T('asset.knowledge')),
          h('button', { className: 'gr-btn gr-btn-ghost', disabled: !!props.busy, onClick: props.onWorks }, T('asset.works'))),
        h('details', { className: 'gr-card' },
          h('summary', null, T('idea.find')),
          h('form', { className: 'gr-row', onSubmit: function (event) {
            event.preventDefault()
            props.onSearch()
          } },
          h('input', { className: 'gr-input', type: 'search', 'aria-label': T('idea.find'),
            value: props.query, onChange: function (event) { props.onQuery(event.target.value) } }),
          h('button', { className: 'gr-btn gr-btn-sm', disabled: !!props.busy }, T('idea.search'))),
          props.notes && props.notes.length === 0 ? h('p', null, T('idea.empty')) : null,
          (props.notes || []).map(function (note) {
            return h('div', { key: note.id },
              h('button', { className: 'gr-btn gr-btn-ghost', disabled: !!props.busy,
                onClick: function () { props.onSelect(note.id, note.version) } }, note.title))
          }),
          selected ? h('article', { className: 'gr-card' },
            h('div', { className: 'gr-h2' }, selected.meta.title),
            h('pre', { className: 'gr-code' }, selected.body),
            h('label', null, T('idea.version'), ' ',
              h('select', { value: selected.meta.version, disabled: !!props.busy,
                onChange: function (event) { props.onSelect(selected.meta.id, Number(event.target.value)) } },
                selected.versions.map(function (version) { return h('option', { key: version, value: version }, 'v' + version) }))),
          ) : null,
        ),
      )
    }

    function ModelSettings() {
      var [config, setConfig] = useState(null)
      var [busy, setBusy] = useState(false)
      var [message, setMessage] = useState('')
      var [error, setError] = useState(null)

      function change(key, value) {
        setConfig(function (current) { return Object.assign({}, current, { [key]: value }) })
        setMessage('')
      }

      async function submit(event) {
        event.preventDefault()
        var test = event.nativeEvent.submitter?.value === 'test'
        setBusy(true)
        setError(null)
        setMessage('')
        try {
          await api(MODEL, Object.assign({}, config, { test: test }))
          if (test) { setMessage(T('model.tested')); return }
          for (var attempt = 0; attempt < 12; attempt++) {
            await new Promise(function (resolve) { setTimeout(resolve, 400) })
            var current = await api(MODEL).catch(function () { return null })
            if (current && current.enabled === config.enabled &&
              (!current.enabled || (current.name === config.name && current.endpoint === config.endpoint))) {
              setMessage(T('research.saved'))
              return
            }
          }
          throw new Error(T('parsers.failed'))
        } catch (problem) { setError(problem) }
        finally { setBusy(false) }
      }

      return h('details', { className: 'gr-card', onToggle: function (event) {
        if (event.currentTarget.open && !config) api(MODEL).then(setConfig, setError)
      } },
      h('summary', null, T('model.title')),
      error ? h('p', { role: 'alert' }, messageOf(error)) : null,
      config ? h('form', { onSubmit: submit },
        h('label', null, h('input', { type: 'checkbox', checked: config.enabled, disabled: busy,
          onChange: function (event) { change('enabled', event.target.checked) } }), T('model.enabled')),
        config.enabled ? h(React.Fragment, null,
          h('label', null, T('model.endpoint'), h('input', { type: 'url', className: 'gr-input', value: config.endpoint || '',
            required: true, disabled: busy, onChange: function (event) { change('endpoint', event.target.value) } })),
          h('label', null, T('model.name'), h('input', { className: 'gr-input', value: config.name || '',
            required: true, disabled: busy, onChange: function (event) { change('name', event.target.value) } })),
          h('p', { className: 'gr-meta' }, 'GROVE_MODEL_KEY')) : null,
        h('div', { className: 'gr-row' },
          config.enabled ? h('button', { className: 'gr-btn', value: 'test', disabled: busy }, T('model.test')) : null,
          h('button', { className: 'gr-btn', value: 'apply', disabled: busy }, T('model.apply'))),
        h('p', { role: 'status' }, message)) : null)
    }

    function ResearchFindings(props) {
      var [question, setQuestion] = useState(props.title)
      var [findings, setFindings] = useState([])
      var [evidence, setEvidence] = useState([])
      var [selected, setSelected] = useState([])
      var [busy, setBusy] = useState(false)
      var [error, setError] = useState(null)

      function load(event) {
        if (!event.currentTarget.open) return
        api(FINDINGS, { action: 'list', id: props.id }).then(function (result) { setFindings(result.findings) }, setError)
        api(REPORTS, { action: 'list', research: props.id }).then(function (result) { setEvidence(result.evidence) }, setError)
      }

      async function ask(event) {
        event.preventDefault()
        setBusy(true)
        setError(null)
        try {
          var finding = await api(FINDINGS, { id: props.id, version: props.version, question: question,
            includeHistory: true, materials: evidence.filter(function (item) { return selected.includes(item.id) }).map(function (item) {
              return { id: item.id, version: item.version }
            }) })
          setFindings(function (items) { return items.concat(finding) })
          setQuestion('')
        } catch (problem) { setError(problem) }
        finally { setBusy(false) }
      }

      return h('details', { className: 'gr-card', onToggle: load },
        h('summary', null, T('model.ask')),
        error ? h('p', { role: 'alert' }, messageOf(error)) : null,
        findings.map(function (item) {
          return h('article', { key: item.meta.id }, h('h3', null, item.meta.title), h('pre', { className: 'gr-code' }, item.body),
            h('button', { className: 'gr-btn gr-btn-ghost', disabled: busy, onClick: function () {
              api(REPORTS, { action: 'draft', research: props.id, id: item.meta.id, version: item.meta.version }).then(props.onDraft, setError)
            } }, T('report.review')))
        }),
        h('form', { onSubmit: ask },
          h('label', null, T('model.question'), h('textarea', { className: 'gr-textarea', value: question,
            required: true, maxLength: 1000, onChange: function (event) { setQuestion(event.target.value) } })),
          h('p', { className: 'gr-meta' }, T('model.scope')),
          evidence.map(function (item) {
            return h('label', { key: item.id }, h('input', { type: 'checkbox', checked: selected.includes(item.id),
              onChange: function (event) { setSelected(event.target.checked ? selected.concat(item.id) : selected.filter(function (id) { return id !== item.id })) } }), item.title)
          }),
          h('button', { className: 'gr-btn', disabled: busy }, T('model.ask'))))
    }

    function ParserSettings() {
      var [enabled, setEnabled] = useState(null)
      var [pending, setPending] = useState(false)
      var [done, setDone] = useState(false)
      var [error, setError] = useState(null)

      async function apply(event) {
        event.preventDefault()
        setPending(true)
        setDone(false)
        setError(null)
        try {
          await api(PARSERS, { pdf: enabled })
          for (var attempt = 0; attempt < 12; attempt++) {
            await new Promise(function (resolve) { setTimeout(resolve, 400) })
            var current = await api(PARSERS).catch(function () { return null })
            if (current && current.pdf === enabled) {
              setDone(true)
              return
            }
          }
          throw new Error(T('parsers.failed'))
        } catch (problem) {
          setError(problem)
        } finally {
          setPending(false)
        }
      }

      return h('details', { className: 'gr-card', onToggle: function (event) {
        if (!event.currentTarget.open || enabled !== null) return
        api(PARSERS).then(function (current) { setEnabled(current.pdf); setError(null) }, setError)
      } },
      h('summary', null, T('parsers.title')),
      h('p', { className: 'gr-body' }, T('parsers.hint')),
      error ? h('p', { role: 'alert' }, messageOf(error)) : null,
      enabled === null ? null : h('form', { onSubmit: apply },
        h('label', null, h('input', { type: 'checkbox', checked: enabled, disabled: pending,
          onChange: function (event) { setEnabled(event.target.checked); setDone(false) } }), T('parsers.pdf')),
        h('button', { className: 'gr-btn', disabled: pending }, T(pending ? 'parsers.pending' : 'parsers.apply')),
        h('p', { role: 'status' }, done ? T('parsers.done') : '')))
    }

    async function readSourceFile(file) {
      if (file.size > 500000) throw new Error(T('err.too-large'))
      var bytes = new Uint8Array(await file.arrayBuffer())
      var binary = ''
      for (var i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
      return btoa(binary)
    }

    function ResearchSources(props) {
      var [items, setItems] = useState([])
      var [document, setDocument] = useState(null)
      var [busy, setBusy] = useState(false)
      var [error, setError] = useState(null)
      var [saved, setSaved] = useState(false)
      useEffect(function () {
        var active = true
        api(SOURCES, { action: 'list', research: props.id }).then(function (value) {
          if (active) setItems(value.sources)
        }, function (problem) {
          if (active) setError(problem)
        })
        return function () { active = false }
      }, [props.id])

      async function run(operation) {
        setBusy(true)
        setError(null)
        setSaved(false)
        try { await operation() }
        catch (problem) { setError(problem) }
        finally { setBusy(false) }
      }

      async function upload(event) {
        var file = event.target.files[0]
        event.target.value = ''
        if (!file) return
        await run(async function () {
          var original = await readSourceFile(file)
          var result = await api(SOURCES, { action: 'import', name: file.name, original: original, research: props.id })
          setItems(function (existing) { return [result.meta].concat(existing.filter(function (item) { return item.id !== result.meta.id })) })
          setDocument({ meta: result.meta, blocks: result.blocks, original: original })
        })
      }

      function download() {
        var bytes = Uint8Array.from(atob(document.original), function (character) { return character.charCodeAt(0) })
        var url = URL.createObjectURL(new Blob([bytes]))
        var link = window.document.createElement('a')
        link.href = url
        link.download = document.meta.title
        link.click()
        setTimeout(function () { URL.revokeObjectURL(url) }, 1000)
      }

      return h('section', { className: 'gr-card' },
        h('h2', { className: 'gr-h2' }, T('source.title')),
        h('label', null, T('source.import'), ' ',
          h('input', { type: 'file', accept: '.md,.markdown,.pdf', disabled: busy, onChange: upload })),
        error ? h('p', { role: 'alert' }, messageOf(error)) : null,
        h('p', { role: 'status' }, saved ? T('source.saved') : ''),
        items.map(function (item) {
          return h('button', { key: item.id, className: 'gr-btn gr-btn-ghost', disabled: busy, onClick: function () {
            run(async function () { setDocument(await api(SOURCES, { action: 'open', id: item.id, version: item.version })) })
          } }, item.title)
        }),
        document ? h('div', null,
          h('button', { className: 'gr-btn', onClick: download }, T('source.open')),
          document.blocks.map(function (block, index) {
            return h('details', { key: document.meta.id + ':' + index },
              h('summary', null, T('source.read'), ' · ', block.locator),
              h('pre', { className: 'gr-code' }, block.text),
              h('button', { className: 'gr-btn', disabled: busy, onClick: function () {
                run(async function () {
                  await api(SOURCES, { action: 'excerpt', id: document.meta.id, version: document.meta.version, index: index })
                  setSaved(true)
                })
              } }, T('source.save')))
          })) : null)
    }

    function ResearchReports(props) {
      var [catalog, setCatalog] = useState(null)
      var [report, setReport] = useState(null)
      var [body, setBody] = useState('')
      var [references, setReferences] = useState([])
      var [originals, setOriginals] = useState({})
      var [busy, setBusy] = useState(false)
      var [error, setError] = useState(null)
      var [editing, setEditing] = useState(false)

      useEffect(function () {
        if (!props.draft) return
        setBody(props.draft.body)
        setReferences(props.draft.evidence)
        setReport(null)
        setEditing(true)
        list().catch(setError)
      }, [props.draft])

      function list() {
        return api(REPORTS, { action: 'list', research: props.id }).then(setCatalog)
      }

      async function run(operation) {
        setBusy(true)
        setError(null)
        try { await operation() }
        catch (problem) { setError(problem) }
        finally { setBusy(false) }
      }

      async function read(id, version) {
        var result = await api(REPORTS, { action: 'read', id: id, version: version })
        setReport(result)
        setBody(result.body)
        setReferences(result.evidence.filter(function (item) { return !item.missing }).map(function (item) {
          return { id: item.meta.id, version: item.meta.version }
        }))
        setOriginals({})
        setEditing(true)
      }

      function start() {
        setReport(null)
        setBody('')
        setReferences([])
        setEditing(true)
      }

      function save(event) {
        event.preventDefault()
        run(async function () {
          var input = { action: 'confirm', research: props.id, body: body, evidence: references }
          if (report) { input.id = report.meta.id; input.version = report.meta.version }
          var result = await api(REPORTS, input)
          await read(result.meta.id, result.meta.version)
          await list()
        })
      }

      function cite(item) {
        if (item.missing) return h('p', { key: item.reference.id }, T('report.missingEvidence'))
        var ref = item.original
        return h('div', { key: item.meta.id, className: 'gr-card' },
          h('p', null, item.meta.source, ' · ', item.meta.locator),
          h('pre', { className: 'gr-code' }, item.body),
          ref ? h('button', { className: 'gr-btn gr-btn-ghost', disabled: busy, onClick: function () {
            run(async function () {
              var text
              try {
                var result = await api(SOURCES, { action: 'open', id: ref.id, version: ref.version })
                var block = result.blocks.find(function (entry) { return entry.locator === item.meta.locator })
                text = block ? block.text : T('report.missing')
              } catch { text = T('report.missing') }
              setOriginals(function (previous) { return Object.assign({}, previous, { [item.meta.id]: text }) })
            })
          } }, T('source.read')) : null,
          originals[item.meta.id] ? h('pre', { className: 'gr-code' }, originals[item.meta.id]) : null)
      }

      return h('details', { className: 'gr-card', open: props.draft ? true : undefined, onToggle: function (event) {
        if (event.currentTarget.open) run(list)
      } },
      h('summary', null, T('report.title')),
      error ? h('p', { role: 'alert' }, messageOf(error)) : null,
      h('button', { className: 'gr-btn', disabled: busy, onClick: start }, T('report.new')),
      (catalog ? catalog.reports : []).map(function (entry) {
        return h('button', { key: entry.meta.id, className: 'gr-btn gr-btn-ghost', disabled: busy,
          onClick: function () { run(function () { return read(entry.meta.id, entry.meta.version) }) } }, entry.meta.title)
      }),
      report ? h('label', null, T('report.history'), ' ', h('select', {
        value: report.meta.version, disabled: busy,
        onChange: function (event) {
          var version = Number(event.target.value)
          run(function () { return read(report.meta.id, version) })
        },
      }, report.versions.map(function (version) { return h('option', { key: version, value: version }, 'v' + version) }))) : null,
      report ? report.evidence.map(cite) : null,
      report ? h('div', { className: 'gr-row' },
        h('button', { className: 'gr-btn', onClick: function () {
          props.onNavigate('knowledge', { title: report.meta.title, body: report.body, report: { id: report.meta.id, version: report.meta.version } })
        } }, T('asset.derive')),
        h('button', { className: 'gr-btn', onClick: function () {
          props.onNavigate('works', { title: report.meta.title, body: report.body, basis: { id: report.meta.id, version: report.meta.version } })
        } }, T('asset.compose'))) : null,
      editing ? h('form', { onSubmit: save },
        h('label', null, T('report.body'), h('textarea', { className: 'gr-textarea', required: true,
          value: body, onChange: function (event) { setBody(event.target.value) } })),
        (catalog ? catalog.evidence : []).map(function (item) {
          var checked = references.some(function (ref) { return ref.id === item.id && ref.version === item.version })
          return h('label', { key: item.id }, h('input', { type: 'checkbox', checked: checked,
            onChange: function () {
              setReferences(checked ? references.filter(function (ref) { return ref.id !== item.id })
                : references.filter(function (ref) { return ref.id !== item.id }).concat({ id: item.id, version: item.version }))
            } }), item.title, ' · v', item.version)
        }),
        h('button', { className: 'gr-btn', disabled: busy || (report && report.meta.version !== report.versions[0]) }, T('report.save')),
        h('button', { type: 'button', className: 'gr-btn gr-btn-ghost', disabled: busy,
          onClick: function () { setEditing(false); props.onDiscard() } }, T('report.discard'))) : null)
    }

    function AssetPage(props) {
      var isKnowledge = props.kind === 'knowledge'
      var endpoint = isKnowledge ? KNOWLEDGE : WORKS
      var [items, setItems] = useState([])
      var [selected, setSelected] = useState(null)
      var [draft, setDraft] = useState(props.seed)
      var [title, setTitle] = useState(props.seed?.title || '')
      var [body, setBody] = useState(props.seed?.body || '')
      var [kind, setKind] = useState('concept')
      var [reason, setReason] = useState('')
      var [basis, setBasis] = useState(null)
      var [busy, setBusy] = useState(false)
      var [error, setError] = useState(null)
      var [message, setMessage] = useState('')

      function list() { return api(endpoint, { action: 'list' }).then(function (result) { setItems(result.items) }) }
      useEffect(function () { list().catch(setError) }, [endpoint])

      async function run(operation) {
        setBusy(true)
        setError(null)
        setMessage('')
        try { await operation() }
        catch (problem) { setError(problem) }
        finally { setBusy(false) }
      }

      async function read(id, version) {
        var entry = await api(endpoint, { action: 'read', id: id, version: version })
        setSelected(entry)
        setDraft({})
        setTitle(entry.meta.title)
        setBody(entry.body)
        setBasis(null)
        setReason('')
      }

      function start() {
        setSelected(null)
        setDraft({})
        setTitle('')
        setBody('')
        setBasis(null)
        setReason('')
      }

      function save(event) {
        event.preventDefault()
        run(async function () {
          var input = { action: 'save', body: body, title: title, type: kind, reason: reason,
            basis: draft?.basis, report: draft?.report }
          if (selected) { input.id = selected.meta.id; input.version = selected.meta.version }
          var entry = await api(endpoint, input)
          await read(entry.meta.id, entry.meta.version)
          await list()
          setMessage(T('research.saved'))
        })
      }

      function readBasis() {
        run(async function () {
          var ref = selected.meta.links.find(function (link) { return link.kind === 'derived' })
          var input = { action: 'read', id: ref.id, version: ref.version }
          var entry = await api(isKnowledge ? REPORTS : KNOWLEDGE, input)
            .catch(function () { return isKnowledge ? null : api(REPORTS, input).catch(function () { return null }) })
          setBasis(entry || { body: T('asset.missing') })
        })
      }

      function reference() { return { id: selected.meta.id, version: selected.meta.version } }

      return h(React.Fragment, null,
        h('div', { className: 'gr-row' },
          h('button', { className: 'gr-btn gr-btn-ghost', onClick: function () { props.onNavigate('home') } }, T('research.back')),
          h('h2', { className: 'gr-h2' }, T('asset.' + props.kind)),
          h('button', { className: 'gr-btn', disabled: busy, onClick: start }, T('asset.new'))),
        error ? h('p', { role: 'alert' }, messageOf(error)) : null,
        h('p', { role: 'status' }, message),
        items.map(function (entry) {
          return h('button', { key: entry.meta.id, className: 'gr-btn gr-btn-ghost', disabled: busy,
            onClick: function () { run(function () { return read(entry.meta.id, entry.meta.version) }) } }, entry.meta.title)
        }),
        draft ? h('form', { className: 'gr-card', onSubmit: save },
          selected ? h('h3', null, selected.meta.title) : h('label', null, T('asset.title'),
            h('input', { className: 'gr-input', value: title, maxLength: 300, required: true, onChange: function (event) { setTitle(event.target.value) } })),
          isKnowledge && !selected ? h('label', null, T('asset.type'),
            h('select', { value: kind, onChange: function (event) { setKind(event.target.value) } },
              ['concept', 'theory', 'claim', 'method'].map(function (type) { return h('option', { key: type, value: type }, T('type.' + type)) }))) : null,
          selected ? h('label', null, T('report.history'),
            h('select', { value: selected.meta.version, disabled: busy, onChange: function (event) {
              var version = Number(event.target.value)
              run(function () { return read(selected.meta.id, version) })
            } }, selected.versions.map(function (version) { return h('option', { key: version, value: version }, 'v' + version) }))) : null,
          h('label', null, T('asset.body'), h('textarea', { className: 'gr-textarea', value: body, required: true,
            onChange: function (event) { setBody(event.target.value) } })),
          selected?.meta.revisionReason ? h('p', { className: 'gr-meta' }, selected.meta.revisionReason) : null,
          isKnowledge && selected ? h('label', null, T('asset.reason'),
            h('textarea', { className: 'gr-textarea', value: reason, required: true, onChange: function (event) { setReason(event.target.value) } })) : null,
          h('button', { className: 'gr-btn', disabled: busy || (selected && selected.meta.version !== selected.versions[0]) }, T('asset.save'))) : null,
        selected ? h('div', { className: 'gr-row' },
          selected.meta.links?.some(function (link) { return link.kind === 'derived' })
            ? h('button', { className: 'gr-btn', disabled: busy, onClick: readBasis }, T('asset.basis')) : null,
          isKnowledge ? h('button', { className: 'gr-btn', onClick: function () {
            props.onNavigate('research', { title: selected.meta.title, origin: reference() })
          } }, T('asset.research')) : null,
          isKnowledge ? h('button', { className: 'gr-btn', onClick: function () {
            props.onNavigate('works', { title: selected.meta.title, body: selected.body, basis: reference() })
          } }, T('asset.compose')) : null,
          !isKnowledge ? h('button', { className: 'gr-btn', onClick: function () {
            run(async function () { await navigator.clipboard.writeText(selected.body); setMessage(T('asset.copied')) })
          } }, T('asset.copy')) : null) : null,
        basis ? h('article', { className: 'gr-card' },
          basis.meta ? h('h3', null, basis.meta.title, ' · v', basis.meta.version) : null,
          h('pre', { className: 'gr-code' }, basis.body)) : null)
    }

    function ResearchPage(props) {
      var [reportDraft, setReportDraft] = useState(null)
      var [studies, setStudies] = useState([])
      var [selected, setSelected] = useState(null)
      var [question, setQuestion] = useState(props.seed?.title || '')
      var [body, setBody] = useState('')
      var [busy, setBusy] = useState(true)
      var [error, setError] = useState(null)
      var [saved, setSaved] = useState(false)

      useEffect(function () {
        var active = true
        api(RESEARCH).then(function (data) {
          if (active) setStudies(data.studies)
        }, function (problem) {
          if (active) setError(problem)
        }).finally(function () {
          if (active) setBusy(false)
        })
        return function () { active = false }
      }, [])

      function select(note) {
        setSelected(note)
        setReportDraft(null)
        setBody(note ? note.body : '')
        setQuestion('')
        setSaved(false)
      }

      function save(event) {
        event.preventDefault()
        if (busy || !body.trim() || (!selected && !question.trim())) return
        setBusy(true)
        setError(null)
        setSaved(false)
        var input = selected ? { id: selected.meta.id, version: selected.meta.version, body: body } : { question: question, body: body, origin: props.seed?.origin }
        api(RESEARCH, input).then(function (note) {
          select(note)
          setSaved(true)
          setStudies(function (items) {
            return [note].concat(items.filter(function (item) { return item.meta.id !== note.meta.id }))
          })
        }, setError).finally(function () { setBusy(false) })
      }

      return h(React.Fragment, null,
        h('div', { className: 'gr-row' },
          h('button', { className: 'gr-btn gr-btn-ghost', disabled: busy, onClick: props.onBack }, T('research.back')),
          studies.length ? h('button', { className: 'gr-btn', disabled: busy, onClick: function () { select(studies[0]) } }, T('research.continue')) : null,
          h('button', { className: 'gr-btn gr-btn-ghost', disabled: busy, onClick: function () { select(null) } }, T('research.new'))),
        error ? h('p', { role: 'alert' }, messageOf(error)) : null,
        h('form', { className: 'gr-card', onSubmit: save },
          selected ? h('h2', { className: 'gr-h2' }, selected.meta.title) :
            h('label', null, T('research.question'),
              h('input', { className: 'gr-input', value: question, required: true, maxLength: 300,
                onChange: function (event) { setQuestion(event.target.value) } })),
          h('label', null, T('research.notes'),
            h('textarea', { className: 'gr-textarea', value: body, required: true,
              onChange: function (event) { setBody(event.target.value); setSaved(false) } })),
          h('div', { className: 'gr-row' },
            h('button', { className: 'gr-btn', disabled: busy }, T('research.save')),
            h('span', { role: 'status' }, saved ? T('research.saved') : ''))),
        h(ModelSettings),
        h(ParserSettings),
        selected ? h(ResearchFindings, { key: 'findings:' + selected.meta.id, id: selected.meta.id, title: selected.meta.title, version: selected.meta.version, onDraft: setReportDraft }) : null,
        selected ? h(ResearchSources, { key: selected.meta.id, id: selected.meta.id }) : null,
        selected ? h(ResearchReports, { key: 'report:' + selected.meta.id, id: selected.meta.id, onNavigate: props.onNavigate, draft: reportDraft, onDiscard: function () { setReportDraft(null) } }) : null,
        studies.map(function (note) {
          return h('button', { key: note.meta.id, className: 'gr-btn gr-btn-ghost', disabled: busy,
            onClick: function () { select(note) } }, note.meta.title)
        }),
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
      '@media (max-width:560px){.gr-inner{padding:18px 14px 32px}.gr-head{flex-wrap:wrap}.gr-stats{grid-template-columns:repeat(2,1fr)}.gr-stat:last-child:nth-child(odd){grid-column:1/-1}.gr-btn{align-self:stretch;justify-content:center}}',
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
      if (typeof ctx.inject === 'function') {
        ctx.inject(['remote', 'remote.directoryPicker'], function (scoped) {
          var picker = scoped.remote.directoryPicker
          scoped.effect(function () {
            services.picker = picker
            return function () {
              if (services.picker === picker) services.picker = null
            }
          }, 'grove: directory picker')
        })
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
          label: function () { return T('menu') }, locale: NS,
        }, GroveIcon)
      })
    }

    return { inject: ['slots', 'locale'], apply: apply }
  },
})
