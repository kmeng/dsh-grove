/**
 * Grove client half: the left-sidebar panel and its cold-start page.
 *
 * Single file, plain JavaScript, no build step. Only `require('react')` plus browser APIs.
 * All data comes from the host half's same-origin routes:
 *   GET  /api/grove/status
 *   POST /api/grove/config
 *   POST /api/grove/capture
 * The shared Grove palette inherits the host color scheme.
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
    var MODEL_UPDATE = '/api/grove/model/settings'
    var FINDINGS = '/api/grove/findings'
    var PARSERS = '/api/grove/parsers'
    var PARSERS_UPDATE = '/api/grove/parsers/settings'
    var REPORTS = '/api/grove/reports'
    var SOURCES = '/api/grove/sources'
    var RESEARCH = '/api/grove/research'
    var RESEARCH_UPDATE = '/api/grove/research/save'
    var DEEP_RESEARCH = '/api/grove/deep-research'
    var INSPIRATIONS = '/api/grove/inspirations'

    var ZH = {
      'err.research-search-links-unreadable': '没能读取给出的公开网页。请检查链接，或换一个能直接打开的网页。',
      'err.research-search-links-unavailable': '当前 dsh 没有可用的公开网页读取服务。',
      'model.source': '默认模型来源',
      'model.followDsh': '跟随 dsh 默认模型',
      'model.custom': '自定义接口',
      'model.dshMissing': '请先在 dsh 的「设置 → 模型」中配置并选择默认模型。',
      'model.researchSource': '深度研究使用',
      'model.inherit': '继承默认模型',
      'model.dshPicker': '指定 dsh 模型',
      'model.pickOne': '请选择模型',
      'model.catalogEmpty': 'dsh 暂无可选的文字模型。',
      'model.catalogMissing': '当前选择已不在 dsh 模型列表中',
      'err.model-dsh-auth': 'dsh 模型的认证失败。请在 dsh 的模型设置中检查账号或凭据。',
      'err.model-dsh-route': 'dsh 当前找不到这个模型或服务商。请检查 dsh 模型设置，或为深度研究另选模型。',
      'settings.title': '设置',
      'settings.models': '模型设置',
      'settings.back': '返回刚才的页面',
      'settings.byTask': '按任务指定模型',
      'settings.web': '联网检索',
      'settings.verifySave': '保存并测试模型',
      'settings.save': '保存设置',
      'settings.saving': '正在保存和检查设置…',
      'model.default': '默认模型',
      'model.research': '深度研究模型',
      'model.researchEndpoint': '深度研究模型接口',
      'model.researchName': '深度研究模型名称',
      'model.researchKeyHint': '专用接口使用 GROVE_RESEARCH_MODEL_KEY。默认模型也使用同一个自定义接口时，可沿用默认凭据。',
      'model.unconfigured': 'AI 模型尚未配置',
      'model.unverified': 'AI 模型已配置，待验证',
      'model.connected': 'AI 模型已配置，已连接',
      'model.connectionFailed': 'AI 模型连接失败',
      'deep.title': '来点深度',
      'deep.direction': '给个方向',
      'deep.hint': '想往哪儿挖？留空也可以，我先拆几个问题。',
      'deep.question': '想深挖什么？',
      'deep.start': '开始深挖',
      'deep.waiting': '正在拆解研究问题…',
      'deep.searching': '正在查找资料…',
      'deep.checking': '正在核对证据和查找缺口…',
      'deep.plan': '拆出这些问题',
      'deep.collected': '找到的资料',
      'deep.noSources': '暂未找到可引用的资料。',
      'deep.webSetting': '启用 Tavily 搜索',
      'deep.webHint': '提供公开链接时，知林可以直接读取网页。开启 Tavily 后，未提供链接的研究可以自动搜索，需要 GROVE_TAVILY_KEY。',
      'deep.followups': '待补查的证据',
      'deep.verified': '核验结果',
      'deep.supported': '有证据支持',
      'deep.disputed': '证据有分歧',
      'deep.insufficient': '证据不足',
      'deep.writing': '正在起草报告…',
      'deep.saving': '正在保存 Markdown 报告…',
      'deep.ready': '报告草稿已保存',
      'deep.interrupted': '研究中断了，可以接着上次的进度继续。',
      'deep.retry': '继续深挖',
      'deep.draft': '待确认草稿',
      'deep.openReport': '查看 Markdown 报告',
      'deep.note': '手动建立话题',
      'deep.topics': '研究话题',
      'deep.topicSearch': '按标题找话题',
      'deep.noTopics': '没有找到匹配的话题。',
      'err.research-running': '这项研究正在启动，请稍候。',
      'err.research-search': '联网检索失败。请检查网络或检索服务，再继续深挖。',
      'err.research-search-disabled': '在研究方向里粘贴一个公开网页链接，就能开始深挖。也可在设置中启用 Tavily 搜索。',
      'err.research-search-key': 'Tavily 缺少密钥。粘贴公开网页链接也可以开始深挖。',
      'err.research-storage': '无法保存研究进度或报告，请检查笔记库的访问权限后重试。',
      'idea.detail': '从灵感出发',
      'idea.back': '回到这条灵感',
      'idea.studies': '研究过的话题',
      'idea.links': 'AI 发现的关联',
      'idea.linksWaiting': '正在找有没有值得一起看的灵感…',
      'idea.linksEmpty': '暂时没发现值得一起看的灵感。',
      'idea.suggest': '带着这个问题深挖',
      'idea.report': '打开报告',
      'idea.today': '今天 {time}',
      'idea.origin': '这轮研究从哪里开始',
      'idea.openOriginal': '看看灵感原文',
      'idea.openStudy': '回看研究',
      'idea.continueStudy': '继续深挖',
      'idea.ongoing': '进行中',
      'idea.savedReport': '研究报告',
      'idea.reportVersion': '第 {version} 版',
      'model.inspirationLinks': '自动发现相关灵感',
      'model.inspirationHint': '打开灵感时，会将这条灵感及最多 24 条近期灵感的片段发给所配置的模型。',
      'research.independent': '独立发起研究',
      'idea.recent': '最近灵感',
      'idea.recentEmpty': '还没有灵感，先叮一下吧。',
      'idea.results': '搜索结果',
      'idea.query': '搜索灵感',
      'model.keyHint': '自定义接口使用 GROVE_MODEL_KEY 提供 API 密钥。',
      'model.saveFailed': '模型设置还未生效。请检查当前 dsh 配置是否可写，再试一次。',
      'model.running': 'AI 正在深挖…',
      'err.model-settings': '请填写模型接口和模型名称。',
      'err.model-endpoint': '请填写 HTTPS 接口地址，地址里不要带密钥、查询参数或片段。',
      'err.model-disabled': '请先前往「设置」配置 AI 模型。',
      'err.model-research-key': '专用深度研究模型缺少 GROVE_RESEARCH_MODEL_KEY。请在宿主设置后重启。',
      'err.model-key': 'dsh 宿主缺少 GROVE_MODEL_KEY。设置后重新启动 dsh。',
      'err.model-auth': '模型服务拒绝了认证（{message}）。请检查密钥及模型访问权限。',
      'err.model-not-found': '找不到模型接口或模型（{message}）。请检查地址和模型名称。',
      'err.model-rate-limit': '模型服务限制了请求（{message}）。请稍后重试或检查用量额度。',
      'err.model-rejected': '模型服务拒绝了请求（{message}）。请检查模型名称及接口是否支持 JSON 输出。',
      'err.model-unavailable': '模型服务暂时不可用（{message}）。请稍后重试。',
      'err.model-network': '无法连接模型服务。请检查 HTTPS 地址、网络和证书。',
      'err.model-timeout': '模型服务在 60 秒内未响应。请重试，或减少选中的材料。',
      'err.model-response': '模型返回的正文或引用格式不正确。请重试，或更换支持 JSON 输出的模型。',
      'research.notesOptional': '研究记录（可选）',
      'research.start': '开始研究',

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
      'model.enabled': '启用 AI 深挖',
      'model.endpoint': 'HTTPS 模型接口',
      'model.name': '模型名称',
      'model.ask': '单轮分析',
      'model.question': '想往哪儿深挖？',
      'model.scope': '模型会收到勾选的证据、这项研究的灵感片段和先前的发现。',
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
      'err.request-too-large': '请求内容超过 1 MiB。',
      'err.unsupported-media': '请求需要使用 JSON 格式。',
      'err.too-large': '内容太长了，请控制在 128 KiB 以内。',
      'err.network': '连不上面板服务，请重启 DSH 后重试。',
      'err.timeout': '配置已提交，但还没生效。请重启 DSH 后再看。',
      'err.internal': '操作失败，请重试。',
      'err.retry': '重试',
      'err.clipboard': '复制被拦截，请手动选择文本。',
      'loading': '正在读取 vault…',
    }

    var EN = {
      'err.research-search-links-unreadable': 'The supplied pages could not be read. Check the links or try a public page that opens directly.',
      'err.research-search-links-unavailable': 'Public page reading is unavailable in this dsh host.',
      'model.source': 'Default model source',
      'model.followDsh': 'Follow the dsh default model',
      'model.custom': 'Custom endpoint',
      'model.dshMissing': 'Configure and select a default model in dsh under Settings → Models.',
      'model.researchSource': 'Deep research uses',
      'model.inherit': 'Inherit the default model',
      'model.dshPicker': 'Choose a dsh model',
      'model.pickOne': 'Select a model',
      'model.catalogEmpty': 'dsh has no available text models.',
      'model.catalogMissing': 'The current choice is no longer listed in dsh',
      'err.model-dsh-auth': 'The dsh model rejected authentication. Check the account or credentials in dsh model settings.',
      'err.model-dsh-route': 'dsh could not find this model or provider. Check dsh model settings or select another research model.',
      'err.model-research-key': 'Set GROVE_RESEARCH_MODEL_KEY in the host and restart to use the dedicated model.',
      'settings.title': 'Settings',
      'settings.models': 'Model settings',
      'settings.back': 'Back to the previous page',
      'settings.byTask': 'Models by task',
      'settings.web': 'Web search',
      'settings.verifySave': 'Save and test models',
      'settings.save': 'Save settings',
      'settings.saving': 'Saving and checking settings…',
      'model.default': 'Default model',
      'model.research': 'Deep research model',
      'model.researchEndpoint': 'Deep research model endpoint',
      'model.researchName': 'Deep research model name',
      'model.researchKeyHint': 'Use GROVE_RESEARCH_MODEL_KEY for the dedicated endpoint. If the default also uses this exact custom endpoint, the credential can be shared.',
      'model.unconfigured': 'AI model is unconfigured',
      'model.unverified': 'AI model configured, awaiting verification',
      'model.connected': 'AI model configured and connected',
      'model.connectionFailed': 'AI model connection failed',
      'deep.title': 'Dig a little deeper',
      'deep.direction': 'Give it a direction',
      'deep.hint': 'What would you like to focus on? Leave this blank to let Grove break down the idea.',
      'deep.question': 'What would you like to investigate?',
      'deep.start': 'Start research',
      'deep.waiting': 'Breaking down the research question…',
      'deep.searching': 'Looking for sources…',
      'deep.checking': 'Checking the evidence and looking for gaps…',
      'deep.plan': 'Research questions',
      'deep.collected': 'Sources found',
      'deep.noSources': 'No citable sources found yet.',
      'deep.webSetting': 'Enable Tavily search',
      'deep.webHint': 'Grove can read supplied public links directly. To search automatically when no link is supplied, enable Tavily and set GROVE_TAVILY_KEY.',
      'deep.followups': 'Evidence to look for next',
      'deep.verified': 'Evidence review',
      'deep.supported': 'Supported',
      'deep.disputed': 'Disputed',
      'deep.insufficient': 'Insufficient evidence',
      'deep.writing': 'Writing the report…',
      'deep.saving': 'Saving the Markdown report…',
      'deep.ready': 'Report draft saved',
      'deep.interrupted': 'Research was interrupted. You can pick up where it stopped.',
      'deep.retry': 'Resume research',
      'deep.draft': 'Draft for review',
      'deep.openReport': 'Read Markdown report',
      'deep.note': 'Create a topic manually',
      'deep.topics': 'Research topics',
      'deep.topicSearch': 'Find topics by title',
      'deep.noTopics': 'No matching topics.',
      'err.research-running': 'This research is already starting.',
      'err.research-search': 'Web search failed. Check the network or search provider before resuming.',
      'err.research-search-disabled': 'Paste a public page link into the research direction, or enable Tavily search in Settings.',
      'err.research-search-key': 'Tavily needs a key. You can also start with a public page link.',
      'err.research-storage': 'Grove could not save research progress or the report. Check vault access and retry.',
      'idea.detail': 'From this idea',
      'idea.back': 'Back to this idea',
      'idea.studies': 'Research topics',
      'idea.links': 'Connections found by AI',
      'idea.linksWaiting': 'Looking for ideas worth seeing together…',
      'idea.linksEmpty': 'No related ideas to show yet.',
      'idea.suggest': 'Explore this question',
      'idea.report': 'Open report',
      'idea.today': 'Today {time}',
      'idea.origin': 'Where this research began',
      'idea.openOriginal': 'Read original idea',
      'idea.openStudy': 'Open research',
      'idea.continueStudy': 'Continue research',
      'idea.ongoing': 'In progress',
      'idea.savedReport': 'Research report',
      'idea.reportVersion': 'Version {version}',
      'model.inspirationLinks': 'Automatically find related ideas',
      'model.inspirationHint': 'When you open an idea, Grove sends excerpts from that idea and up to 24 recent ideas to the configured model.',
      'research.independent': 'Start independent research',
      'idea.recent': 'Recent ideas',
      'idea.recentEmpty': 'Your first idea will show up here.',
      'idea.results': 'Search results',
      'idea.query': 'Search ideas',
      'model.keyHint': 'Custom endpoints use GROVE_MODEL_KEY for the API key.',
      'model.saveFailed': 'Model settings have not taken effect. Check that the dsh profile is writable, then try again.',
      'model.running': 'AI is investigating…',
      'err.model-settings': 'Enter the model endpoint and name.',
      'err.model-endpoint': 'Enter an HTTPS endpoint without credentials, query parameters, or a fragment.',
      'err.model-disabled': 'Configure an AI model in Settings first.',
      'err.model-key': 'The dsh host is missing GROVE_MODEL_KEY. Set it and restart dsh.',
      'err.model-auth': 'The model service rejected authentication ({message}). Check the key and model permissions.',
      'err.model-not-found': 'The endpoint or model was not found ({message}). Check the URL and model name.',
      'err.model-rate-limit': 'The model service limited the request ({message}). Try again later or check your quota.',
      'err.model-rejected': 'The model service rejected the request ({message}). Check the model name and JSON output support.',
      'err.model-unavailable': 'The model service is temporarily unavailable ({message}). Try again later.',
      'err.model-network': 'Could not connect to the model service. Check the HTTPS URL, network, and certificate.',
      'err.model-timeout': 'The model service did not respond within 60 seconds. Try again or select fewer materials.',
      'err.model-response': 'The model returned invalid text or citations. Retry or choose a model that supports JSON output.',
      'research.notesOptional': 'Research notes (optional)',
      'research.start': 'Start research',
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
      'model.enabled': 'Enable AI research',
      'model.endpoint': 'HTTPS model endpoint',
      'model.name': 'Model name',
      'model.ask': 'Run a single analysis',
      'model.question': 'What should we investigate?',
      'model.scope': 'The model receives selected evidence, inspiration excerpts, and earlier findings from this study.',
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
      'err.request-too-large': 'This request exceeds 1 MiB.',
      'err.unsupported-media': 'This request must use JSON.',
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
      if (error && error.code && ZH['err.' + error.code] !== undefined) return T('err.' + error.code, { message: error.message })
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
      var [searchOpen, setSearchOpen] = useState(false)
      var [saved, setSaved] = useState(false)
      var [changing, setChanging] = useState(false)
      var [page, setPage] = useState('home')
      var [seed, setSeed] = useState(null)
      var [settingsOpen, setSettingsOpen] = useState(false)
      var [modelConfig, setModelConfig] = useState(null)
      var scroll = useRef(null)
      var previousView = useRef(null)

      useEffect(function () {
        var active = true
        var timer
        function refreshModel() {
          api(MODEL).then(function (data) {
            if (active) setModelConfig(data)
          }, function () {
            if (active) setModelConfig(function (current) {
              return current || { connection: { status: 'failed', code: 'network' } }
            })
          }).finally(function () {
            if (active && !settingsOpen && (page === 'idea' || page === 'research')) timer = setTimeout(refreshModel, 4000)
          })
        }
        refreshModel()
        return function () { active = false; clearTimeout(timer) }
      }, [page, settingsOpen])

      useEffect(function () {
        if (settingsOpen) {
          if (scroll.current) scroll.current.scrollTop = 0
        } else if (previousView.current) {
          if (scroll.current) scroll.current.scrollTop = previousView.current.top
          previousView.current.element?.focus({ preventScroll: true })
          previousView.current = null
        }
      }, [settingsOpen])

      function openSettings() {
        if (settingsOpen) return
        previousView.current = { top: scroll.current?.scrollTop || 0, element: document.activeElement }
        setSettingsOpen(true)
      }

      function navigate(destination, draft) {
        setSeed(draft || null)
        setPage(destination)
      }
      var [recent, setRecent] = useState(null)
      var [recentError, setRecentError] = useState(null)
      var [recentRevision, setRecentRevision] = useState(0)
      var vault = status?.usable ? status.vault : null

      useEffect(function () {
        if (!vault || page !== 'home') return
        var active = true
        setRecentError(null)
        api(INSPIRATIONS, {}).then(function (data) {
          if (active) setRecent(data.notes.slice(0, 5))
        }, function (problem) {
          if (active) setRecentError(problem)
        })
        return function () { active = false }
      }, [vault, page, recentRevision])
      var [resumable, setResumable] = useState(null)
      useEffect(function () {
        if (!vault || page !== 'home' || changing) return
        var active = true
        api(RESEARCH).then(function (data) {
          if (active) setResumable({ vault: vault, id: data.studies[0]?.meta.id })
        }, function () {
          if (active) setResumable(null)
        })
        return function () { active = false }
      }, [vault, page, changing])
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
          setRecent(null)
          setQuery('')
          setNotes(null)
          setSearchOpen(false)
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
          setRecentRevision(function (revision) { return revision + 1 })
          setNotes(null)
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
        h('div', { className: 'gr-scroll', ref: scroll },
          h('div', { className: 'gr-inner' },
            h(Header, {
              status: status, loading: loading, error: error,
              onSettings: settingsOpen ? null : openSettings,
              onChange: connected && !settingsOpen ? function () {
                setPathDraft(status.vault || '')
                setManual(false)
                setChanging(true)
              } : null,
            }),
            error ? h(ErrorNote, { error: error, onRetry: load }) : null,
            h('div', { className: 'gr-view', hidden: settingsOpen }, loading && status === null
              ? h('div', { className: 'gr-card' }, h('div', { className: 'gr-body' }, T('loading')))
              : changing || !connected
                ? connectView
                : page === 'research'
                  ? h(ResearchPage, { seed: seed, onNavigate: navigate, modelConfig: modelConfig, onSettings: openSettings, onBack: function () {
                    if (seed?.idea) navigate('idea', seed.idea)
                    else navigate('home')
                  } })
                  : page === 'idea'
                    ? h(InspirationPage, { key: vault + ':' + seed.id + ':' + seed.version, reference: seed, onNavigate: navigate, modelConfig: modelConfig, onSettings: openSettings })
                  : page === 'report'
                    ? h(InspirationReport, { key: seed.id + ':' + seed.version, reference: seed, onNavigate: navigate })
                  : page === 'knowledge' || page === 'works'
                    ? h(AssetPage, { key: page, kind: page, seed: seed, onNavigate: navigate })
                    : h(InspirationHome, {
                    onResearch: function () { navigate('research') },
                    onResume: resumable?.vault === vault && resumable.id ? function () {
                      navigate('research', { resume: resumable.id })
                    } : null,
                    onKnowledge: function () { navigate('knowledge') },
                    onWorks: function () { navigate('works') },
                    draft: draft, busy: busy, saved: saved, onSave: saveIdea,
                    onDraft: function (value) { setDraft(value); setSaved(false) },
                    query: query, notes: notes, onQuery: setQuery, searchOpen: searchOpen, onSearchOpen: setSearchOpen,
                    recent: recent, recentError: recentError,
                    onRetryRecent: function () { setRecentRevision(function (revision) { return revision + 1 }) },
                    onSearch: function () {
                      requestNotes({ query: query }, function (data) { setNotes(data.notes) })
                    },
                    onSelect: function (id, version) {
                      navigate('idea', { id: id, version: version })
                    },
                  })),
            settingsOpen ? h(SettingsPage, { onBack: function () { setSettingsOpen(false) }, onApplied: setModelConfig }) : null,
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
          props.onSettings ? h('button', { className: 'gr-btn gr-btn-ghost gr-btn-sm', onClick: props.onSettings }, T('settings.title')) : null,
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
          props.onResume ? h('button', { className: 'gr-btn', disabled: !!props.busy, onClick: props.onResume }, T('research.continue')) : null,
          h('button', { className: 'gr-btn gr-btn-ghost', disabled: !!props.busy, onClick: props.onResearch }, T('research.independent')),
          h('button', { className: 'gr-btn gr-btn-ghost', disabled: !!props.busy, onClick: props.onKnowledge }, T('asset.knowledge')),
          h('button', { className: 'gr-btn gr-btn-ghost', disabled: !!props.busy, onClick: props.onWorks }, T('asset.works'))),
        h('section', { className: 'gr-card' },
          h('h2', { className: 'gr-h2' }, T('idea.recent')),
          props.recentError ? h(ErrorNote, { error: props.recentError, onRetry: props.onRetryRecent }) :
            props.recent === null ? h('p', { className: 'gr-meta' }, T('loading')) :
              props.recent.length ? inspirationList(props.recent, props) : h('p', { className: 'gr-meta' }, T('idea.recentEmpty')),
          h('details', { className: 'gr-idea-search', open: props.searchOpen, onToggle: function (event) { props.onSearchOpen(event.currentTarget.open) } },
            h('summary', null, T('idea.find')),
            h('form', { className: 'gr-search-row', onSubmit: function (event) {
              event.preventDefault()
              props.onSearch()
            } },
            h('input', { className: 'gr-input', type: 'search', 'aria-label': T('idea.query'),
              placeholder: T('idea.query'), value: props.query, onChange: function (event) { props.onQuery(event.target.value) } }),
            h('button', { className: 'gr-btn', disabled: !!props.busy }, T('idea.search'))),
            props.notes ? h('div', { className: 'gr-stack' },
              h('h3', { className: 'gr-h2' }, T('idea.results')),
              props.notes.length ? inspirationList(props.notes, props) : h('p', { className: 'gr-meta' }, T('idea.empty'))) : null),
        ),
      )
    }

    function inspirationTime(value) {
      var date = new Date(value)
      if (!value || Number.isNaN(date.getTime())) return null
      var locale = T('idea.today').startsWith('Today') ? 'en' : 'zh-CN'
      var time = new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit' }).format(date)
      var label = date.toDateString() === new Date().toDateString()
        ? T('idea.today', { time: time })
        : new Intl.DateTimeFormat(locale, { year: 'numeric', month: 'short', day: 'numeric' }).format(date) + ' ' + time
      return h('time', { className: 'gr-meta', dateTime: date.toISOString() }, label)
    }

    function inspirationList(items, props) {
      return h('ul', { className: 'gr-records' }, items.map(function (item) {
        return h('li', { key: item.id },
          h('button', { className: 'gr-btn gr-btn-ghost gr-idea-row', disabled: !!props.busy,
            onClick: function () { props.onSelect(item.id, item.version) } },
          h('span', { 'aria-hidden': true }, '💡'), h('span', null, item.title || item.id), inspirationTime(item.created)))
      }))
    }

    function InspirationPage(props) {
      var ref = props.reference
      var [detail, setDetail] = useState(null)
      var [error, setError] = useState(null)
      var [discovery, setDiscovery] = useState(null)
      var [discoveryError, setDiscoveryError] = useState(null)
      var [retry, setRetry] = useState(0)
      var [revision, setRevision] = useState(0)
      var [suggestion, setSuggestion] = useState(null)
      var researchForm = useRef(null)

      useEffect(function () {
        var active = true
        api(INSPIRATIONS, { action: 'detail', id: ref.id, version: ref.version }).then(function (value) {
          if (active) setDetail(value)
        }, function (problem) { if (active) setError(problem) })
        return function () { active = false }
      }, [ref.id, ref.version, revision])

      useEffect(function () {
        if (!detail) return
        if (!props.modelConfig?.enabled || !props.modelConfig.inspirationLinks) {
          setDiscovery(null)
          setDiscoveryError(null)
          return
        }
        var active = true
        setDiscovery(null)
        setDiscoveryError(null)
        api(INSPIRATIONS, { action: 'discover', id: detail.meta.id, version: detail.meta.version }).then(function (value) {
          if (active) setDiscovery(value)
        }, function (problem) { if (active) setDiscoveryError(problem) })
        return function () { active = false }
      }, [detail?.meta.id, detail?.meta.version, props.modelConfig?.enabled, props.modelConfig?.inspirationLinks, props.modelConfig?.source, props.modelConfig?.endpoint, props.modelConfig?.name, props.modelConfig?.source === 'dsh' ? props.modelConfig.dshDefault?.provider : null, props.modelConfig?.source === 'dsh' ? props.modelConfig.dshDefault?.model : null, retry])

      return h('main', { className: 'gr-origin-page' },
        h('div', { className: 'gr-origin-heading' },
          h('button', { className: 'gr-btn gr-origin-link', onClick: function () {
            if (ref.back) props.onNavigate('idea', ref.back)
            else props.onNavigate('home')
          } }, '← ', T(ref.back ? 'idea.back' : 'research.back')),
          h('h1', null, T('idea.detail'))),
        error ? h('p', { role: 'alert' }, messageOf(error)) : null,
        !detail && !error ? h('p', { role: 'status' }, T('loading')) : null,
        detail ? h(React.Fragment, null,
          h('article', { className: 'gr-origin-note gr-stack' },
            h('div', { className: 'gr-row' }, h('span', { className: 'gr-origin-bulb', 'aria-hidden': true }, '💡'), inspirationTime(detail.meta.created)),
            h('p', { className: 'gr-prose' }, detail.body),
            detail.versions.length > 1 ? h('label', { className: 'gr-row' }, T('idea.version'),
              h('select', { value: detail.meta.version, onChange: function (event) {
                props.onNavigate('idea', Object.assign({}, ref, { version: Number(event.target.value) }))
              } }, detail.versions.map(function (version) { return h('option', { key: version, value: version }, 'v' + version) }))) : null),
          h(DeepResearchPanel, { idea: { id: detail.meta.id, version: detail.meta.version }, suggestion: suggestion, field: researchForm, onSettings: props.onSettings, modelConfig: props.modelConfig,
            onFinished: function () { setRevision(function (value) { return value + 1 }) },
            onReport: function (run) { props.onNavigate('report', Object.assign({ idea: ref, studyId: run.topic }, run.report)) } }),
          detail.studies.length ? h('section', { className: 'gr-origin-section gr-stack' },
            h('h3', { className: 'gr-h2' }, T('idea.studies')),
            detail.studies.map(function (study) {
              return h('article', { className: 'gr-stack gr-origin-topic', key: study.id },
                h('div', { className: 'gr-row' }, h('h4', { className: 'gr-h2' }, study.title),
                  study.status === 'open' ? h('span', { className: 'gr-meta' }, T('idea.ongoing')) : null),
                study.latest || study.summary ? h('p', { className: 'gr-prose' }, study.latest || study.summary) : null,
                h('button', { className: 'gr-btn gr-btn-ghost', onClick: function () {
                  props.onNavigate('research', { resume: study.id, idea: ref })
                } }, T(study.status === 'open' && !study.reports.length ? 'idea.continueStudy' : 'idea.openStudy')),
                study.reports.map(function (report) {
                  return h('section', { className: 'gr-origin-report gr-stack', key: report.id },
                    h('p', { className: 'gr-meta' }, T(report.review === 'draft' ? 'deep.draft' : 'idea.savedReport'), ' · ', T('idea.reportVersion', { version: report.version })),
                    h('h4', { className: 'gr-h2' }, report.title),
                    h('p', { className: 'gr-prose' }, report.summary),
                    h('button', { className: 'gr-btn gr-btn-ghost', onClick: function () {
                      props.onNavigate('report', Object.assign({ idea: ref, studyId: study.id }, report))
                    } }, T('idea.report')))
                }),
                [['knowledge', study.knowledge], ['works', study.works]].map(function ([kind, items]) {
                  return items.map(function (item) {
                    return h('button', { className: 'gr-btn gr-btn-ghost', key: item.id, onClick: function () {
                      props.onNavigate(kind, { read: item, idea: ref })
                    } }, item.title)
                  })
                }))
            })) : null,
          h('section', { className: 'gr-origin-section' },
            h(ModelConnection, { value: props.modelConfig?.connection, loading: !props.modelConfig, onSettings: props.onSettings })),
          props.modelConfig?.enabled && props.modelConfig.inspirationLinks ?
          h('section', { className: 'gr-origin-section gr-stack' },
            h('h3', { className: 'gr-h2' }, T('idea.links')),
            discoveryError ? h(ErrorNote, { error: discoveryError, onRetry: function () { setRetry(retry + 1) } }) :
              !discovery ? h('p', { role: 'status' }, T('idea.linksWaiting')) :
              discovery.matches.length ? discovery.matches.map(function (match) {
                return h('article', { className: 'gr-stack gr-origin-topic', key: match.id },
                  h('button', { className: 'gr-btn gr-btn-ghost', onClick: function () {
                    props.onNavigate('idea', { id: match.id, version: match.version, back: ref })
                  } }, match.title),
                  h('p', { className: 'gr-prose' }, match.reason),
                  match.question ? h(React.Fragment, null, h('p', null, match.question),
                    h('button', { className: 'gr-btn gr-btn-ghost', onClick: function () { setSuggestion({ text: match.question }); researchForm.current?.focus() } }, T('idea.suggest'))) : null)
              }) : h('p', { className: 'gr-meta' }, T('idea.linksEmpty'))) : null) : null)
    }

    function ReportMarkdown(props) {
      function inline(text) {
        return text.split(/(\*\*[^*]+\*\*|<https?:\/\/[^>\s]+>)/g).map(function (part, index) {
          if (part.startsWith('**') && part.endsWith('**')) return h('strong', { key: index }, part.slice(2, -2))
          if (/^<https?:\/\/[^>\s]+>$/.test(part)) {
            var address = part.slice(1, -1)
            return h('a', { key: index, href: address, target: '_blank', rel: 'noreferrer' }, address)
          }
          return part.replace(/\\([\\`*_\[\]<>])/g, '$1')
        })
      }

      return h('div', { className: 'gr-markdown gr-stack' }, props.body.split(/\n\s*\n/).map(function (block, index) {
        var lines = block.split('\n')
        var heading = /^(#{1,6}) (.+)$/.exec(block)
        if (heading) return h('h' + Math.min(6, heading[1].length + 2), { key: index }, inline(heading[2]))
        var ordered = /^\d+\. /.test(block)
        if (ordered || /^- /.test(block)) {
          var entries = block.split(ordered ? /\n(?=\d+\. )/ : /\n(?=- )/)
          return h(ordered ? 'ol' : 'ul', { key: index }, entries.map(function (item, position) {
            return h('li', { key: position }, inline(item.replace(ordered ? /^\d+\. / : /^- /, '').replace(/\n +/g, ' ')))
          }))
        }
        return h('p', { key: index, className: 'gr-prose' }, inline(lines.join('\n')))
      }))
    }

    function DeepResearchPanel(props) {
      var [direction, setDirection] = useState(props.direction || '')
      var [run, setRun] = useState(null)
      var [report, setReport] = useState(null)
      var [error, setError] = useState(null)
      var [busy, setBusy] = useState(false)
      var [failedAction, setFailedAction] = useState(null)
      var [loaded, setLoaded] = useState(false)
      var [refresh, setRefresh] = useState(0)
      var finished = useRef(null)
      var scope = { idea: props.idea, topic: props.topic, knowledge: props.knowledge }
      var optional = !!(props.idea || props.topic || props.knowledge)
      var running = run?.status === 'running'
      var setupErrors = ['model-disabled', 'model-key', 'model-research-key', 'model-dsh-auth', 'model-dsh-route', 'research-search-disabled', 'research-search-key']
      var configurationNeeded = setupErrors.includes(error?.code)

      useEffect(function () {
        setError(function (problem) { return setupErrors.includes(problem?.code) ? null : problem })
      }, [props.modelConfig?.changeId])

      useEffect(function () {
        if (props.suggestion) setDirection(props.suggestion.text)
      }, [props.suggestion])

      useEffect(function () {
        var mounted = true
        var timeout
        function poll() {
          api(DEEP_RESEARCH, Object.assign({ action: 'list' }, scope)).then(function (result) {
            if (!mounted) return
            var latest = result.runs[0]
            setRun(latest || null)
            setLoaded(true)
            if (latest?.status === 'running') timeout = setTimeout(poll, 1000)
          }, function (problem) {
            if (mounted) { setError(problem); setLoaded(true) }
          })
        }
        poll()
        return function () { mounted = false; clearTimeout(timeout) }
      }, [props.idea?.id, props.idea?.version, props.topic, props.knowledge?.id, props.knowledge?.version, refresh])

      useEffect(function () {
        var id = run?.report?.id
        if (!id) { setReport(null); return }
        if (finished.current !== id) {
          finished.current = id
          props.onFinished?.()
        }
        var mounted = true
        api(REPORTS, { action: 'read', id: id, version: run.report.version }).then(function (result) {
          if (mounted) setReport(result)
        }, function (problem) { if (mounted) setError(problem) })
        return function () { mounted = false }
      }, [run?.report?.id, run?.report?.version, refresh])

      async function begin(action) {
        if (busy || running) return
        setBusy(true)
        setError(null)
        setFailedAction(null)
        try {
          var language = T('deep.start') === EN['deep.start'] ? 'en' : 'zh'
          var started = await api(DEEP_RESEARCH, Object.assign({ action: action, id: action === 'retry' ? run.id : undefined,
            direction: direction, language: language }, scope))
          setRun(started)
          setRefresh(function (value) { return value + 1 })
        } catch (problem) { setFailedAction(action); setError(problem) }
        finally { setBusy(false) }
      }

      var status = run?.status === 'complete' ? (report?.meta.review === 'confirmed' ? null : 'deep.ready')
        : !running ? null : run.written ? 'deep.saving'
          : run.verified ? 'deep.writing' : !run.plan ? 'deep.waiting' : null
      return h('section', { className: 'gr-card' },
        h('h2', { className: 'gr-h2' }, T('deep.title')),
        h('form', { onSubmit: function (event) { event.preventDefault(); begin('start') } },
          h('label', null, T(optional ? 'deep.direction' : 'deep.question'),
            h('textarea', { className: 'gr-textarea', ref: props.field, value: direction, maxLength: 1200,
              placeholder: props.idea ? T('deep.hint') : undefined, required: !optional, disabled: busy || running,
              onChange: function (event) { setDirection(event.target.value) } })),
          h('button', { className: 'gr-btn', disabled: !loaded || busy || running || (!optional && !direction.trim()) }, T('deep.start'))),
        error ? h('div', { className: 'gr-stack' },
          h('p', { role: 'alert' }, messageOf(error)),
          configurationNeeded ? h('button', { className: 'gr-btn gr-btn-ghost', onClick: props.onSettings }, T('settings.models')) : h('button', { className: 'gr-btn gr-btn-ghost', onClick: function () {
            if (failedAction) begin(failedAction)
            else { setError(null); setRefresh(function (value) { return value + 1 }) }
          } }, T('err.retry'))) : null,
        run ? h('div', { className: 'gr-stack' },
          run.plan ? h('h3', { className: 'gr-h2' }, run.plan.topic) : null,
          run.direction && run.direction !== direction ? h('p', { className: 'gr-meta' }, T('deep.direction'), ' · ', run.direction) : null,
          run.plan ? h('div', null, h('h4', null, T('deep.plan')),
            h('ul', null, run.plan.questions.map(function (item) { return h('li', { key: item }, item) }))) : null,
          run.collected ? h('div', null, h('h4', null, T('deep.collected')),
            run.collected.length ? h('ul', null, run.collected.map(function (item, index) { return h('li', { key: index }, item) }))
              : h('p', { className: 'gr-meta' }, T('deep.noSources'))) : run.plan && running ? h('p', { role: 'status' }, T('deep.searching')) : null,
          run.review?.followups.length ? h('div', null, h('h4', null, T('deep.followups')),
            h('ul', null, run.review.followups.map(function (item) { return h('li', { key: item }, item) }))) : null,
          run.verified ? h('div', null, h('h4', null, T('deep.verified')),
            h('ul', null, run.verified.map(function (item, index) {
              return h('li', { key: index }, h('strong', null, T('deep.' + item.status)), ' · ', item.text)
            }))) : run.collected && running ? h('p', { role: 'status' }, T('deep.checking')) : null,
          status ? h('p', { role: 'status' }, T(status)) : null,
          run.status === 'failed' || run.status === 'interrupted' ? h('div', { className: 'gr-stack' },
            h('p', { role: 'alert' }, run.error ? messageOf(run.error) : T('deep.interrupted')),
            h('button', { className: 'gr-btn gr-btn-ghost', disabled: busy, onClick: function () { begin('retry') } }, T('deep.retry'))) : null,
          report && run.report ? h('details', { className: 'gr-origin-report', open: true },
            h('summary', null, T('deep.openReport')),
            h(ReportMarkdown, { body: report.body }),
            h('button', { className: 'gr-btn gr-btn-ghost', onClick: function () { props.onReport(run) } }, T('idea.report'))) : null) : null)
    }

    function InspirationReport(props) {
      var ref = props.reference
      var [report, setReport] = useState(null)
      var [error, setError] = useState(null)
      useEffect(function () {
        var active = true
        api(REPORTS, { action: 'read', id: ref.id, version: ref.version }).then(function (value) {
          if (active) setReport(value)
        }, function (problem) { if (active) setError(problem) })
        return function () { active = false }
      }, [ref.id, ref.version])
      return h(React.Fragment, null,
        h('div', { className: 'gr-row' },
          ref.idea ? h('button', { className: 'gr-btn gr-btn-ghost', onClick: function () { props.onNavigate('idea', ref.idea) } }, T('idea.back')) : null,
          h('button', { className: 'gr-btn gr-btn-ghost', onClick: function () {
            props.onNavigate('research', { resume: ref.studyId, idea: ref.idea, report: ref })
          } }, T('idea.openStudy'))),
        error ? h('p', { role: 'alert' }, messageOf(error)) : null,
        report ? h('article', { className: 'gr-card' }, h('h2', { className: 'gr-h2' }, report.meta.title),
          h('p', { className: 'gr-meta' }, T('idea.reportVersion', { version: report.meta.version })),
          report.meta.review === 'draft' ? h('p', { className: 'gr-meta' }, T('deep.draft')) : null,
          h(ReportMarkdown, { body: report.body })) : !error ? h('p', { role: 'status' }, T('loading')) : null)
    }

    function ModelConnection(props) {
      var state = props.value?.status || (props.loading ? 'loading' : 'unconfigured')
      var labels = { loading: 'loading', unconfigured: 'model.unconfigured', unverified: 'model.unverified',
        connected: 'model.connected', failed: 'model.connectionFailed' }
      var color = state === 'connected' ? 'gr-dot-ok' : (state === 'unconfigured' || state === 'failed') ? 'gr-dot-error' : ''
      return h('div', { className: 'gr-row gr-model-status' },
        h('span', { className: 'gr-row gr-meta', role: 'status', title: props.value?.checkedAt },
          h('span', { className: 'gr-dot ' + color, 'aria-hidden': true }), T(labels[state] || 'model.unverified')),
        props.onSettings ? h('button', { type: 'button', className: 'gr-btn gr-origin-link', onClick: props.onSettings }, T('settings.models')) : null,
        props.value?.code ? h('span', { className: 'gr-meta' }, messageOf({ code: props.value.code, message: props.value.message || '' })) : null)
    }

    function SettingsPage(props) {
      var [config, setConfig] = useState(null)
      var [busy, setBusy] = useState(false)
      var [message, setMessage] = useState('')
      var [error, setError] = useState(null)
      var back = useRef(null)
      useEffect(function () {
        back.current?.focus({ preventScroll: true })
        var active = true
        api(MODEL + '?catalog=1').then(function (value) { if (active) setConfig(value) }, function (problem) { if (active) setError(problem) })
        return function () { active = false }
      }, [])

      function change(key, value) {
        setConfig(function (current) {
          var next = Object.assign({}, current, { [key]: value })
          if (key === 'enabled' || key === 'source' || key === 'name' || key === 'endpoint') {
            next.connection = { status: next.enabled ? 'unverified' : 'unconfigured' }
          }
          if (key === 'deepResearch' || key === 'enabled') {
            next.researchConnection = value ? { status: 'unverified' } : next.connection
          }
          if (key === 'deepResearch' && current.deepResearch?.endpoint && current.deepResearch.source !== 'dsh') {
            next.customResearch = current.deepResearch
          }
          return next
        })
        setMessage('')
      }

      async function submit(event) {
        event.preventDefault()
        setBusy(true)
        setError(null)
        setMessage('')
        try {
          var receipt = await api(MODEL_UPDATE, {
            enabled: config.enabled, source: config.source, name: config.name, endpoint: config.endpoint, deepResearch: config.deepResearch,
            inspirationLinks: config.inspirationLinks, webSearch: config.webSearch, verify: config.enabled,
          })
          for (var attempt = 0; attempt < 12; attempt++) {
            var current = await api(MODEL).catch(function () { return null })
            if (current && current.changeId === receipt.changeId) {
              props.onApplied(current)
              setConfig(Object.assign({}, current, { catalog: config.catalog }))
              setMessage(T('research.saved'))
              return
            }
            await new Promise(function (resolve) { setTimeout(resolve, 400) })
          }
          throw new Error(T('model.saveFailed'))
        } catch (problem) { setError(problem) }
        finally { setBusy(false) }
      }

      function fields(value, update, role) {
        var research = role === 'research'
        return h(React.Fragment, null,
          h('label', null, T(research ? 'model.researchEndpoint' : 'model.endpoint'),
            h('input', { type: 'url', className: 'gr-input', value: value.endpoint || '', required: true, disabled: busy,
              onChange: function (event) { update('endpoint', event.target.value) } })),
          h('label', null, T(research ? 'model.researchName' : 'model.name'),
            h('input', { className: 'gr-input', value: value.name || '', required: true, disabled: busy,
              onChange: function (event) { update('name', event.target.value) } })))
      }

      function modelKey(model) {
        return model?.provider && model?.model ? JSON.stringify([model.provider, model.model]) : ''
      }

      var research = config?.deepResearch
      var researchSource = !research ? 'inherit' : research.source === 'dsh' ? 'dsh' : 'custom'
      var catalog = config?.catalog || []
      var defaultModel = config?.dshDefault
      var defaultEntry = catalog.find(function (entry) { return modelKey(entry) === modelKey(defaultModel) })

      function researchPicker() {
        var selected = modelKey(research)
        return h('label', null, T('model.dshPicker'),
          h('select', { 'aria-label': T('model.dshPicker'), value: selected, required: true, disabled: busy, onChange: function (event) {
            var entry = catalog.find(function (item) { return modelKey(item) === event.target.value })
            if (entry) change('deepResearch', { source: 'dsh', provider: entry.provider, model: entry.model })
          } },
          h('option', { value: '', disabled: true }, T(catalog.length ? 'model.pickOne' : 'model.catalogEmpty')),
          selected && !catalog.some(function (entry) { return modelKey(entry) === selected })
            ? h('option', { value: selected, disabled: true }, research.model + ' · ' + T('model.catalogMissing')) : null,
          catalog.map(function (entry) {
            return h('option', { key: modelKey(entry), value: modelKey(entry) }, entry.label + ' · ' + entry.providerName)
          })))
      }

      return h('main', { className: 'gr-view' },
        h('div', { className: 'gr-origin-heading' },
          h('button', { className: 'gr-btn gr-origin-link', onClick: props.onBack, ref: back }, '← ', T('settings.back')),
          h('h1', null, T('settings.title'))),
        error ? h('p', { role: 'alert' }, messageOf(error)) : null,
        config ? h('form', { className: 'gr-view', onSubmit: submit },
          h('section', { className: 'gr-card' },
            h('h2', { className: 'gr-h2' }, T('model.default')),
            h(ModelConnection, { value: config.connection }),
            h('label', null, h('input', { type: 'checkbox', checked: config.enabled, disabled: busy,
              onChange: function (event) { change('enabled', event.target.checked) } }), T('model.enabled')),
            config.enabled ? h('label', null, T('model.source'),
              h('select', { 'aria-label': T('model.source'), value: config.source, disabled: busy, onChange: function (event) { change('source', event.target.value) } },
                h('option', { value: 'dsh' }, T('model.followDsh')),
                h('option', { value: 'custom' }, T('model.custom')))) : null,
            config.enabled && config.source === 'custom' ? h(React.Fragment, null, fields(config, change, 'default'),
              h('p', { className: 'gr-meta' }, T('model.keyHint'))) : null,
            config.enabled && config.source === 'dsh' ? h('p', { className: 'gr-meta' },
              defaultEntry ? defaultEntry.label + ' · ' + defaultEntry.providerName : defaultModel?.model || T('model.dshMissing')) : null,
            h('label', null, h('input', { type: 'checkbox', checked: config.inspirationLinks, disabled: busy || !config.enabled,
              onChange: function (event) { change('inspirationLinks', event.target.checked) } }), T('model.inspirationLinks')),
            config.enabled ? h('p', { className: 'gr-meta' }, T('model.inspirationHint')) : null,
            config.enabled ? h('details', { className: 'gr-model-options', open: config.deepResearch ? true : undefined },
              h('summary', null, T('settings.byTask')),
              h('div', { className: 'gr-stack' },
                h('h3', { className: 'gr-h2' }, T('model.research')),
                h('label', null, T('model.researchSource'),
                  h('select', { 'aria-label': T('model.researchSource'), value: researchSource, disabled: busy, onChange: function (event) {
                    var mode = event.target.value
                    change('deepResearch', mode === 'inherit' ? null : mode === 'dsh' ? { source: 'dsh' }
                      : config.customResearch || { endpoint: config.endpoint || '', name: '' })
                  } }, h('option', { value: 'inherit' }, T('model.inherit')),
                    h('option', { value: 'dsh' }, T('model.dshPicker')),
                    h('option', { value: 'custom' }, T('model.custom')))),
                researchSource === 'dsh' ? researchPicker() : null,
                researchSource === 'custom' ? h(React.Fragment, null,
                  fields(research, function (key, value) { change('deepResearch', Object.assign({}, research, { [key]: value })) }, 'research'),
                  h('p', { className: 'gr-meta' }, T('model.researchKeyHint'))) : null,
                research ? h(ModelConnection, { value: config.researchConnection }) : null)) : null),
          h('section', { className: 'gr-card' },
            h('h2', { className: 'gr-h2' }, T('settings.web')),
            h('label', null, h('input', { type: 'checkbox', checked: config.webSearch, disabled: busy,
              onChange: function (event) { change('webSearch', event.target.checked) } }), T('deep.webSetting')),
            h('p', { className: 'gr-meta' }, T('deep.webHint'))),
          h('div', { className: 'gr-row' },
            h('button', { className: 'gr-btn', disabled: busy }, T(config.enabled ? 'settings.verifySave' : 'settings.save')),
            h('span', { role: 'status' }, busy ? T('settings.saving') : message))) : !error ? h('p', { role: 'status' }, T('loading')) : null,
        h(ParserSettings))
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
        api(FINDINGS, { action: 'list', id: props.id }).then(function (result) {
          setFindings(function (items) {
            return result.findings.concat(items.filter(function (item) {
              return !result.findings.some(function (loaded) { return loaded.meta.id === item.meta.id })
            }))
          })
        }, setError)
        api(REPORTS, { action: 'list', research: props.id }).then(function (result) { setEvidence(result.evidence) }, setError)
      }

      async function ask(event) {
        if (event) event.preventDefault()
        if (!props.modelEnabled || busy) return
        setBusy(true)
        setError(null)
        try {
          var finding = await api(FINDINGS, { id: props.id, version: props.version, question: question,
            includeHistory: true, materials: evidence.filter(function (item) { return selected.includes(item.id) }).map(function (item) {
              return { id: item.id, version: item.version }
            }) })
          setFindings(function (items) {
            return items.some(function (item) { return item.meta.id === finding.meta.id }) ? items : items.concat(finding)
          })
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
        props.modelEnabled === false ? h('button', { className: 'gr-btn gr-btn-ghost', onClick: props.onSettings }, T('settings.models')) : null,
        props.modelEnabled ? h('form', { className: 'gr-stack', onSubmit: ask },
          h('label', null, T('model.question'), h('textarea', { className: 'gr-textarea', value: question,
            required: true, disabled: busy, maxLength: 1000, onChange: function (event) { setQuestion(event.target.value) } })),
          h('p', { className: 'gr-meta' }, T('model.scope')),
          evidence.map(function (item) {
            return h('label', { key: item.id }, h('input', { type: 'checkbox', checked: selected.includes(item.id),
              onChange: function (event) { setSelected(event.target.checked ? selected.concat(item.id) : selected.filter(function (id) { return id !== item.id })) } }), item.title)
          }),
          h('button', { className: 'gr-btn', disabled: busy }, T(busy ? 'model.running' : 'model.ask'))) : null)
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
          await api(PARSERS_UPDATE, { pdf: enabled })
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

      useEffect(function () {
        api(PARSERS).then(function (current) { setEnabled(current.pdf) }, setError)
      }, [])

      return h('section', { className: 'gr-card' },
      h('h2', { className: 'gr-h2' }, T('parsers.title')),
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

      useEffect(function () {
        if (props.initialReport) run(function () { return read(props.initialReport.id, props.initialReport.version) })
      }, [props.initialReport])

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

      return h('details', { className: 'gr-card', open: props.draft || props.initialReport ? true : undefined, onToggle: function (event) {
        if (event.currentTarget.open) run(list)
      } },
      h('summary', null, T('report.title')),
      error ? h('p', { role: 'alert' }, messageOf(error)) : null,
      h('button', { className: 'gr-btn', disabled: busy, onClick: start }, T('report.new')),
      (catalog ? catalog.reports : []).map(function (entry) {
        return h('button', { key: entry.meta.id, className: 'gr-btn gr-btn-ghost', disabled: busy,
          onClick: function () { run(function () { return read(entry.meta.id, entry.meta.version) }) } }, entry.meta.title, entry.meta.review === 'draft' ? ' · ' + T('deep.draft') : '')
      }),
      report ? h('label', null, T('report.history'), ' ', h('select', {
        value: report.meta.version, disabled: busy,
        onChange: function (event) {
          var version = Number(event.target.value)
          run(function () { return read(report.meta.id, version) })
        },
      }, report.versions.map(function (version) { return h('option', { key: version, value: version }, 'v' + version) }))) : null,
      report ? report.evidence.map(cite) : null,
      report && report.meta.review !== 'draft' ? h('div', { className: 'gr-row' },
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
      useEffect(function () {
        list().catch(setError)
        if (props.seed?.read) run(function () { return read(props.seed.read.id, props.seed.read.version) })
      }, [endpoint])

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
          h('button', { className: 'gr-btn gr-btn-ghost', onClick: function () { props.onNavigate(props.seed?.idea ? 'idea' : 'home', props.seed?.idea) } }, T(props.seed?.idea ? 'idea.back' : 'research.back')),
          h('h2', { className: 'gr-h2' }, T('asset.' + props.kind)),
          h('button', { className: 'gr-btn', disabled: busy, onClick: start }, T('asset.new'))),
        error ? h('p', { role: 'alert' }, messageOf(error)) : null,
        h('p', { role: 'status' }, message),
        items.length ? h('div', { className: 'gr-stack' }, items.map(function (entry) {
          return h('button', { key: entry.meta.id, className: 'gr-btn gr-btn-ghost', disabled: busy,
            onClick: function () { run(function () { return read(entry.meta.id, entry.meta.version) }) } }, entry.meta.title)
        })) : null,
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
      var [topicSearch, setTopicSearch] = useState('')
      var [selected, setSelected] = useState(null)
      var [question, setQuestion] = useState(props.seed?.title || '')
      var [useOrigin, setUseOrigin] = useState(!!props.seed?.origin)
      var [body, setBody] = useState('')
      var [busy, setBusy] = useState(true)
      var [error, setError] = useState(null)
      var [saved, setSaved] = useState(false)

      useEffect(function () {
        var active = true
        api(RESEARCH).then(function (data) {
          if (!active) return
          setStudies(data.studies)
          if (props.seed?.resume) select(data.studies.find(function (study) {
            return study.meta.id === props.seed.resume
          }) || data.studies[0] || null)
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
        if (busy || (!selected && !question.trim())) return
        setBusy(true)
        setError(null)
        setSaved(false)
        var input = selected ? { id: selected.meta.id, version: selected.meta.version, body: body } : { question: question, body: body, origin: useOrigin ? props.seed?.origin : undefined }
        api(RESEARCH_UPDATE, input).then(function (note) {
          select(note)
          setSaved(true)
          setStudies(function (items) {
            return [note].concat(items.filter(function (item) { return item.meta.id !== note.meta.id }))
          })
        }, setError).finally(function () { setBusy(false) })
      }

      var inspirationOrigins = selected?.meta.links?.filter(function (link) { return link.excerpt })
      var visibleTopics = studies.filter(function (note) {
        return note.meta.title.toLowerCase().includes(topicSearch.trim().toLowerCase())
      })
      return h(React.Fragment, null,
        h('div', { className: 'gr-row' },
          h('button', { className: 'gr-btn gr-btn-ghost', disabled: busy, onClick: props.onBack }, T(props.seed?.idea ? 'idea.back' : 'research.back')),
          studies.length ? h('button', { className: 'gr-btn', disabled: busy, onClick: function () { select(studies[0]) } }, T('research.continue')) : null,
          h('button', { className: 'gr-btn gr-btn-ghost', disabled: busy, onClick: function () { setUseOrigin(false); select(null) } }, T('research.new'))),
        error ? h('p', { role: 'alert' }, messageOf(error)) : null,
        h(DeepResearchPanel, { key: selected?.meta.id || (useOrigin ? props.seed.origin.id : 'independent'), topic: selected?.meta.id, onSettings: props.onSettings, modelConfig: props.modelConfig,
          knowledge: selected || !useOrigin ? undefined : props.seed.origin, direction: selected || !useOrigin ? undefined : props.seed.title,
          onFinished: function () { api(RESEARCH).then(function (data) { setStudies(data.studies) }, setError) },
          onReport: function (run) { props.onNavigate('report', Object.assign({ idea: props.seed?.idea, studyId: run.topic }, run.report)) } }),
        selected ? h('form', { className: 'gr-card', onSubmit: save },
          h('h2', { className: 'gr-h2' }, selected.meta.title),
          inspirationOrigins?.length ? h('details', null,
            h('summary', null, T('idea.origin')),
            inspirationOrigins.map(function (link) {
              return h('div', { className: 'gr-stack', key: link.id },
                h('p', { className: 'gr-prose' }, link.excerpt),
                h('button', { type: 'button', className: 'gr-btn gr-btn-ghost', onClick: function () {
                  props.onNavigate('idea', { id: link.id, version: link.version, back: props.seed?.idea?.id === link.id ? undefined : props.seed?.idea })
                } }, T('idea.openOriginal'), ' · v', link.version))
            })) : null,
          h('label', null, T('research.notes'), h('textarea', { className: 'gr-textarea', value: body,
            onChange: function (event) { setBody(event.target.value); setSaved(false) } })),
          h('div', { className: 'gr-row' },
            h('button', { className: 'gr-btn', disabled: busy }, T('research.save')),
            h('span', { role: 'status' }, saved ? T('research.saved') : ''))) :
          h('details', { className: 'gr-card' }, h('summary', null, T('deep.note')),
          h('form', { onSubmit: save }, h('label', null, T('research.question'),
              h('input', { className: 'gr-input', value: question, required: true, maxLength: 300,
                onChange: function (event) { setQuestion(event.target.value) } })),
          h('label', null, T('research.notesOptional'), h('textarea', { className: 'gr-textarea', value: body,
            onChange: function (event) { setBody(event.target.value) } })),
          h('button', { className: 'gr-btn', disabled: busy }, T('research.start')))),
        selected ? h(ResearchFindings, { key: 'findings:' + selected.meta.id, id: selected.meta.id, title: selected.meta.title, version: selected.meta.version, modelEnabled: props.modelConfig?.enabled, onSettings: props.onSettings, onDraft: setReportDraft }) : null,
        selected ? h(ResearchSources, { key: selected.meta.id, id: selected.meta.id }) : null,
        selected ? h(ResearchReports, { key: 'report:' + selected.meta.id, id: selected.meta.id, onNavigate: props.onNavigate, draft: reportDraft, initialReport: selected.meta.id === props.seed?.resume ? props.seed?.report : null, onDiscard: function () { setReportDraft(null) } }) : null,
        studies.length ? h('section', { className: 'gr-card' },
          h('h2', { className: 'gr-h2' }, T('deep.topics')),
          h('label', null, T('deep.topicSearch'),
            h('input', { type: 'search', className: 'gr-input', value: topicSearch, onChange: function (event) { setTopicSearch(event.target.value) } })),
          visibleTopics.map(function (note) {
            return h('button', { key: note.meta.id, className: 'gr-btn gr-btn-ghost', disabled: busy,
              'aria-pressed': note.meta.id === selected?.meta.id, onClick: function () { select(note) } }, note.meta.title)
          }),
          visibleTopics.length ? null : h('p', { className: 'gr-meta' }, T('deep.noTopics'))) : null,
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
      '.gr-root{--gr-paper:light-dark(#f7f8f2,#19211d);--gr-surface:light-dark(#fffefa,#222d26);--gr-ink:light-dark(#24342b,#e5eee5);--gr-muted:light-dark(#55675b,#adbdaf);--gr-line:light-dark(#dce3d8,#43554a);--gr-wash:light-dark(#e9efe3,#293a30);--gr-green:light-dark(#285342,#bce0c9);--gr-on-green:light-dark(#fff,#173629);--gr-error:light-dark(#a52d25,#ffb4aa);height:100%;min-height:0;display:flex;flex-direction:column;background:var(--gr-paper);color:var(--gr-ink);font-family:inherit;font-size:13px;line-height:1.6;box-sizing:border-box;padding-top:min(var(--dsh-frame-top-clearance,0px),28px)}',
      '.gr-scroll{flex:1 1 auto;min-height:0;overflow:auto}',
      '.gr-inner{max-width:760px;margin:0 auto;padding:28px 24px 40px;display:flex;flex-direction:column;gap:18px;box-sizing:border-box}',
      '.gr-head{display:flex;align-items:flex-start;gap:14px;flex-wrap:wrap;padding-bottom:14px;border-bottom:1px solid var(--gr-line)}',
      '.gr-mark{flex:none;width:44px;height:44px;border-radius:12px;background:var(--gr-surface);border:1px solid var(--gr-line);display:grid;place-items:center}',
      '.gr-headtext{min-width:0;flex:1 1 220px}',
      '.gr-title{font-size:20px;font-weight:600;line-height:1.3}',
      '.gr-sub{color:var(--gr-muted);font-size:13px;margin-top:2px;word-break:break-all}',
      '.gr-head-actions{display:flex;align-items:center;gap:8px;margin-left:auto;flex-wrap:wrap;max-width:100%}',
      '.gr-pill{display:inline-flex;align-items:center;gap:6px;font-size:12px;color:var(--gr-muted);border:1px solid var(--gr-line);border-radius:999px;padding:3px 10px;white-space:nowrap;background:var(--gr-surface)}',
      '.gr-dot{width:6px;height:6px;border-radius:50%;background:var(--gr-muted)}',
      '.gr-dot-ok{background:var(--gr-green)}',
      '.gr-view:not([hidden]){display:flex;flex-direction:column;gap:18px;min-width:0}',
      '.gr-dot-error{background:var(--gr-error)}',
      '.gr-model-options[open]>.gr-stack{margin-top:12px}',
      '.gr-model-status .gr-btn{align-self:center}',
      '.gr-card{background:var(--gr-surface);border:1px solid var(--gr-line);border-radius:12px;padding:20px;display:flex;flex-direction:column;gap:12px;box-sizing:border-box}',
      '.gr-card :is(h2,h3,p),.gr-inner>.gr-body{margin:0}',
      '.gr-stack{display:flex;flex-direction:column;gap:12px;min-width:0}',
      '.gr-root details.gr-card{display:block}',
      '.gr-root details[open]>summary~*,.gr-root details[open]>summary~*+*{margin-top:12px}',
      '.gr-card form:not(.gr-row):not(.gr-search-row){display:flex;flex-direction:column;align-items:flex-start;gap:12px}',
      '.gr-card form>label:not(.gr-row){display:block;width:100%;overflow-wrap:anywhere}',
      '.gr-card label>:is(.gr-input,.gr-textarea){margin-top:6px}',
      '.gr-root input[type=checkbox]{accent-color:var(--gr-green)}',
      '.gr-root select{background:var(--gr-wash);color:inherit;border:1px solid var(--gr-line);border-radius:6px;padding:4px 8px;font:inherit}',
      '.gr-card button,.gr-stack button{max-width:100%;overflow-wrap:anywhere;text-align:left}',
      '.gr-search-row{display:flex;gap:8px;align-items:center}.gr-search-row input{flex:1;min-width:0}',
      '.gr-records{display:grid;gap:8px;list-style:none;margin:0;padding:0}',
      '.gr-records .gr-idea-row{display:grid;grid-template-columns:auto minmax(0,1fr) auto;gap:8px;align-items:center;text-align:left}',
      '@media(max-width:430px){.gr-records .gr-idea-row{grid-template-columns:auto minmax(0,1fr)}.gr-idea-row time{grid-column:2}}',
      '.gr-records button{width:100%;justify-content:flex-start}',
      '.gr-records button[aria-pressed=true]{background:var(--gr-wash)}',
      '.gr-idea-search,.gr-idea-reader{border-top:1px solid var(--gr-line);padding-top:12px}',
      '.gr-origin-page{width:min(100%,620px);margin-inline:auto;display:grid;gap:20px;min-width:0;overflow-wrap:anywhere;font-size:14px}',
      '.gr-origin-page :is(h1,h2,h3,h4,p){margin:0}',
      '.gr-origin-heading{display:grid;gap:5px;justify-items:start}',
      '.gr-origin-heading h1{font-size:clamp(23px,4vw,32px);line-height:1.25;font-weight:650;letter-spacing:-.025em}',
      '.gr-origin-note{border:1px solid var(--gr-line);border-radius:14px;padding:clamp(14px,3vw,22px);background:var(--gr-wash)}',
      '.gr-origin-note .gr-prose{font-size:17px;line-height:1.7}',
      '.gr-origin-bulb{font-size:16px}',
      '.gr-origin-section{border-top:1px solid var(--gr-line);padding-top:14px}',
      '.gr-origin-topic{padding-block:8px}',
      '.gr-origin-topic+.gr-origin-topic{border-top:1px solid var(--gr-line);padding-top:14px}',
      '.gr-origin-report{padding:12px 14px;border:1px solid var(--gr-line);border-radius:10px;background:var(--gr-surface)}',
      '.gr-origin-page .gr-origin-link{background:transparent;color:var(--gr-green);padding:4px 0}',
      '.gr-markdown{overflow-wrap:anywhere}.gr-markdown :is(ul,ol){margin:0;padding-inline-start:22px}.gr-markdown :is(h3,h4,h5,h6){margin:0}.gr-markdown a{color:var(--gr-green)}',
      '.gr-prose{white-space:pre-wrap;overflow-wrap:anywhere;line-height:1.6}',
      '.gr-h2{font-size:15px;font-weight:600;line-height:1.4}',
      '.gr-body{color:var(--gr-muted);font-size:13px}',
      '.gr-meta{font-size:12px;color:var(--gr-muted)}',
      '.gr-btn{appearance:none;border:0;border-radius:8px;background:var(--gr-green);color:var(--gr-on-green);font:inherit;font-size:13px;font-weight:600;padding:8px 14px;cursor:pointer;display:inline-flex;align-items:center;gap:8px;align-self:flex-start}',
      '.gr-btn:hover{opacity:.92}',
      '.gr-btn:disabled{opacity:.5;cursor:default}',
      '.gr-btn-ghost{background:transparent;color:var(--gr-ink);border:1px solid var(--gr-line)}',
      '.gr-btn-sm{padding:5px 10px;font-size:12px;font-weight:500}',
      '.gr-input,.gr-textarea{width:100%;box-sizing:border-box;background:var(--gr-wash);border:1px solid var(--gr-line);border-radius:8px;color:var(--gr-ink);font:inherit;font-size:13px;padding:9px 11px;outline:none}',
      '.gr-textarea{min-height:96px;resize:vertical;line-height:1.6}',
      '.gr-root :is(button,input,textarea,select,summary,a):focus-visible{outline:2px solid var(--gr-green);outline-offset:1px}',
      '.gr-row{display:flex;gap:8px;align-items:center;flex-wrap:wrap;min-width:0}',
      '.gr-root [role=alert],.gr-err{color:var(--gr-error);font-size:12px;white-space:pre-wrap}',
      '.gr-ok{color:var(--gr-green)}',
      '.gr-path{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px;background:var(--gr-wash);border:1px solid var(--gr-line);border-radius:6px;padding:2px 6px;word-break:break-all}',
      '.gr-stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(112px,1fr));gap:10px}',
      '.gr-stat{border:1px solid var(--gr-line);border-radius:10px;padding:12px;background:var(--gr-paper);min-width:0}',
      '.gr-stat b{display:block;font-size:20px;font-weight:600;line-height:1.2}',
      '.gr-stat span{font-size:12px;color:var(--gr-muted)}',
      '.gr-recent{display:flex;flex-direction:column;min-width:0}',
      '.gr-item{display:flex;align-items:baseline;gap:10px;padding:9px 0;border-bottom:1px solid var(--gr-line);min-width:0}',
      '.gr-item:last-child{border-bottom:0}',
      '.gr-type{flex:none;font-size:11px;color:var(--gr-muted);border:1px solid var(--gr-line);border-radius:999px;padding:1px 8px}',
      '.gr-itemtitle{flex:1 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.gr-code{white-space:pre-wrap;word-break:break-word;background:var(--gr-wash);border:1px solid var(--gr-line);border-radius:8px;padding:10px 12px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px;line-height:1.6;margin:0}',
      '.gr-foot{border-top:1px solid var(--gr-line);padding-top:12px;color:var(--gr-muted);font-size:12px;display:flex;flex-direction:column;gap:4px}',
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
