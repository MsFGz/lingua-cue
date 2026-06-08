const SpeechRecognition =
  window.SpeechRecognition || window.webkitSpeechRecognition || null;

const SPEECH_ENGINE_NAME = SpeechRecognition ? "Web Speech API" : "No ASR";
const WATCHDOG_INTERVAL_MS = 4000;
const SILENCE_RESTART_MS = 14000;
const RESTART_DELAY_MS = 450;
const MAX_RESTART_ATTEMPTS = 8;
const OPENAI_CHUNK_MS = 4200;
const LOCAL_CHUNK_MS = 2200;
const LOCAL_MIN_AUDIO_SECONDS = 0.35;
const LOCAL_MIN_RMS = 0.006;
const LOCAL_MIN_PEAK = 0.035;
const LOCAL_SPEECH_RMS = 0.014;
const LOCAL_SPEECH_PEAK = 0.12;
const LOCAL_TARGET_SAMPLE_RATE = 16000;
const OPENAI_ASR_LABEL = "OpenAI gpt-4o-transcribe";
const LOCAL_ASR_LABEL = "SenseVoice Small";
const WEB_SPEECH_LABEL = SpeechRecognition ? "Web Speech API" : "No ASR";
const ASR_ENGINE_LABELS = {
  local: LOCAL_ASR_LABEL,
  openai: OPENAI_ASR_LABEL,
  webspeech: WEB_SPEECH_LABEL,
};
const PERSONAL_GLOSSARY_KEY = "linguaCue.personalGlossary.v1";
const CORRECTION_MEMORY_KEY = "linguaCue.correctionMemory.v1";
const FOCUS_MODE_KEY = "linguaCue.focusMode.v1";
const SUPPRESSED_CUE_TERMS_KEY = "linguaCue.suppressedCueTerms.v1";
const CUE_RECENCY_WINDOW_MS = 45_000;
const HIGHLIGHT_CACHE_LIMIT = 180;
const CONTEXT_HISTORY_LIMIT = 160;
const UI_TRANSCRIPT_LIMIT = 26;
const MANUAL_SELECTION_LOCK_MS = 18_000;
const SYSTEM_NOTICE_CLEAR_MS = 12_000;

const TERMS = [
  {
    term: "GTM",
    pattern: /\bGTM\b|go[-\s]?to[-\s]?market/i,
    meaning: "Go-to-market，产品进入市场和拿到客户的打法。",
    contexts: {
      startup: "通常包含定位、渠道、定价、销售动作和发布节奏。",
      product: "产品侧会关心目标用户、价值主张和启动市场。",
    },
    evidence: ["launch", "market", "sales", "渠道", "发布", "客户", "增长", "commercial"],
    ambiguity: "也可能只是泛指商业化计划。",
  },
  {
    term: "PMM",
    pattern: /\bPMM\b|product marketing/i,
    meaning: "Product Marketing Manager，连接产品、市场和销售的角色。",
    contexts: {
      startup: "常负责定位、竞品、销售材料和发布叙事。",
      career: "面试里可能指产品市场经理岗位或合作对象。",
    },
    evidence: ["positioning", "launch", "sales", "enablement", "市场", "定位", "物料"],
  },
  {
    term: "ICP",
    pattern: /\bICP\b|ideal customer profile/i,
    meaning: "Ideal Customer Profile，最适合购买产品的理想客户画像。",
    contexts: {
      startup: "常用于判断优先卖给哪类公司、团队或人群。",
      product: "增长和销售会拿它来筛选线索与定义细分市场。",
    },
    evidence: ["customer", "segment", "lead", "persona", "客户", "画像", "行业", "规模"],
    ambiguity: "在中国语境里也可能指ICP备案；当前上下文会影响判断。",
  },
  {
    term: "ARR",
    pattern: /\bARR\b|annual recurring revenue/i,
    meaning: "Annual Recurring Revenue，年度经常性收入。",
    contexts: {
      startup: "SaaS 公司常用它衡量订阅收入规模。",
      finance: "投资人会用它估算增长、估值和留存质量。",
    },
    evidence: ["SaaS", "revenue", "subscription", "growth", "收入", "订阅", "估值", "增长"],
  },
  {
    term: "MRR",
    pattern: /\bMRR\b|monthly recurring revenue/i,
    meaning: "Monthly Recurring Revenue，月度经常性收入。",
    contexts: {
      startup: "比 ARR 更适合看早期增长节奏。",
      finance: "常用于拆解收入质量和续费变化。",
    },
    evidence: ["monthly", "revenue", "subscription", "收入", "月", "订阅", "续费"],
  },
  {
    term: "CAC",
    pattern: /\bCAC\b|customer acquisition cost/i,
    meaning: "Customer Acquisition Cost，获取一个客户所花的成本。",
    contexts: {
      startup: "常和 LTV 一起看，判断获客是否健康。",
      finance: "投资人会关心 CAC payback，也就是多久收回获客成本。",
    },
    evidence: ["customer", "acquisition", "LTV", "payback", "获客", "成本", "回本"],
  },
  {
    term: "LTV",
    pattern: /\bLTV\b|lifetime value/i,
    meaning: "Lifetime Value，客户生命周期价值。",
    contexts: {
      startup: "常与 CAC 对比，衡量客户长期收益是否覆盖获客成本。",
      finance: "模型里会用它评估增长效率和利润潜力。",
    },
    evidence: ["CAC", "retention", "churn", "value", "留存", "流失", "价值"],
  },
  {
    term: "NDR",
    pattern: /\bNDR\b|net dollar retention/i,
    meaning: "Net Dollar Retention，老客户收入净留存。",
    contexts: {
      startup: "大于 100% 通常表示老客户扩容超过流失和降级。",
      finance: "投资人常用它判断产品粘性和扩张潜力。",
    },
    evidence: ["retention", "expansion", "churn", "renewal", "留存", "扩容", "续费"],
  },
  {
    term: "Churn",
    pattern: /\bchurn\b|流失率/i,
    meaning: "客户或收入流失，通常看用户取消、降级或不续费。",
    contexts: {
      startup: "早期团队会用它判断产品是否真的留住客户。",
      product: "产品侧会追查触发流失的体验、价值或定价问题。",
    },
    evidence: ["retention", "renewal", "cancel", "留存", "续费", "取消", "降级"],
  },
  {
    term: "Enablement",
    pattern: /\benablement\b|sales enablement/i,
    meaning: "赋能，常指给销售提供培训、材料和话术，让他们更会卖。",
    contexts: {
      startup: "常见于 PMM、销售和客户成功之间的协作。",
      product: "产品发布后会准备 demo、battlecard、FAQ 等材料。",
    },
    evidence: ["sales", "training", "deck", "battlecard", "销售", "培训", "材料", "话术"],
  },
  {
    term: "Alignment",
    pattern: /\balignment\b|align\b|对齐/i,
    meaning: "对齐，指团队对目标、判断或下一步动作形成共识。",
    contexts: {
      career: "coffee chat 里常表示沟通顺畅、方向一致。",
      product: "产品团队常用它处理跨职能协作。",
    },
    evidence: ["team", "stakeholder", "goal", "sync", "团队", "目标", "共识", "同步"],
  },
  {
    term: "Ownership",
    pattern: /\bownership\b|owner\b/i,
    meaning: "责任归属或主人翁意识，表示谁负责把事情推进到底。",
    contexts: {
      career: "面试和 coffee chat 里常用来评价候选人的主动性。",
      product: "项目中会指某个模块、指标或决策由谁负责。",
    },
    evidence: ["responsible", "drive", "lead", "负责", "推进", "主导", "owner"],
  },
  {
    term: "Stakeholder",
    pattern: /\bstakeholder(s)?\b/i,
    meaning: "利益相关方，指会影响或被影响的人或团队。",
    contexts: {
      product: "常包括工程、设计、销售、法务、管理层和客户。",
      career: "面试中常考察你如何管理不同人的期待。",
    },
    evidence: ["cross-functional", "team", "legal", "sales", "跨部门", "管理", "期待"],
  },
  {
    term: "Deck",
    pattern: /\bdeck\b|pitch deck/i,
    meaning: "演示文稿，通常是用于汇报、融资或销售的一组 slides。",
    contexts: {
      startup: "可能指融资 pitch deck、销售 deck 或产品发布材料。",
      finance: "VC 场景里多半是融资材料。",
    },
    evidence: ["slide", "pitch", "fundraising", "investor", "PPT", "融资", "汇报"],
  },
  {
    term: "Pipeline",
    pattern: /\bpipeline\b/i,
    meaning: "销售漏斗或候选机会池，指一批正在推进的客户、项目或候选人。",
    contexts: {
      startup: "销售语境里多指从线索到签约的机会队列。",
      career: "招聘语境里也可能指候选人池。",
    },
    evidence: ["sales", "lead", "deal", "recruiting", "销售", "线索", "客户", "候选人"],
    ambiguity: "工程语境里也可能指数据或部署流水线。",
  },
  {
    term: "Bandwidth",
    pattern: /\bbandwidth\b/i,
    meaning: "时间和精力余量，不是网络带宽时常指“有没有空”。",
    contexts: {
      career: "coffee chat 中可能是在委婉表达资源或时间有限。",
      product: "项目排期里常用来讨论团队是否接得住新任务。",
    },
    evidence: ["time", "capacity", "resource", "忙", "时间", "资源", "优先级"],
  },
  {
    term: "North Star Metric",
    pattern: /\bnorth star metric\b|northstar|北极星指标/i,
    meaning: "北极星指标，最能代表产品长期价值的核心指标。",
    contexts: {
      product: "产品和增长团队用它统一方向，避免只追短期局部指标。",
      startup: "创始团队会用它凝聚增长策略和产品优先级。",
    },
    evidence: ["metric", "growth", "retention", "指标", "增长", "留存", "核心"],
  },
  {
    term: "MVP",
    pattern: /\bMVP\b|minimum viable product/i,
    meaning: "Minimum Viable Product，最小可行产品，用最小范围验证核心假设。",
    contexts: {
      startup: "早期团队常用它快速验证需求、付费意愿或增长假设。",
      product: "产品侧会用它控制范围，先证明核心价值再扩展功能。",
    },
    evidence: ["product", "validate", "launch", "scope", "验证", "产品", "功能", "上线"],
  },
  {
    term: "DM",
    pattern: /\bDM\b|direct message|decision maker/i,
    meaning: "可能是 Direct Message，也可能是 Decision Maker。",
    contexts: {
      career: "如果聊社交、networking，多半是私信或直接发消息。",
      startup: "如果聊销售、采购、客户组织，多半是决策人。",
    },
    evidence: ["message", "LinkedIn", "sales", "buyer", "私信", "消息", "决策", "客户"],
    ambiguity: "DM 是高歧义缩写，需要结合上下文判断。",
  },
  {
    term: "KPI",
    pattern: /\bKPI\b|key performance indicator/i,
    meaning: "Key Performance Indicator，关键绩效指标。",
    contexts: {
      product: "通常用于衡量产品、增长或团队目标是否达成。",
      career: "也可能指岗位或团队考核指标。",
    },
    evidence: ["metric", "goal", "target", "绩效", "指标", "目标", "考核"],
  },
  {
    term: "OKR",
    pattern: /\bOKR\b|objectives and key results/i,
    meaning: "Objectives and Key Results，目标与关键结果。",
    contexts: {
      startup: "团队用它把方向和可衡量结果对齐。",
      product: "产品团队常用 OKR 连接路线图和业务结果。",
    },
    evidence: ["objective", "key result", "goal", "目标", "关键结果", "对齐"],
  },
  {
    term: "ROI",
    pattern: /\bROI\b|return on investment/i,
    meaning: "Return on Investment，投资回报率或投入产出比。",
    contexts: {
      finance: "投资语境里常指资本投入后的回报。",
      startup: "客户购买软件时也会问业务回报是否值得。",
    },
    evidence: ["return", "investment", "cost", "回报", "投入", "成本", "收益"],
  },
  {
    term: "POC",
    pattern: /\bPOC\b|proof of concept/i,
    meaning: "Proof of Concept，概念验证，用小范围试验证明方案可行。",
    contexts: {
      startup: "B2B 销售里常指客户正式采购前的小规模验证。",
      product: "产品或技术方案落地前会先做 POC 降低风险。",
    },
    evidence: ["pilot", "test", "customer", "验证", "试点", "客户", "可行"],
  },
  {
    term: "PRD",
    pattern: /\bPRD\b|product requirements document/i,
    meaning: "Product Requirements Document，产品需求文档。",
    contexts: {
      product: "通常写目标用户、问题、需求范围、验收标准和上线计划。",
      career: "产品面试里常用来考察结构化表达和需求判断。",
    },
    evidence: ["requirement", "spec", "feature", "需求", "文档", "功能", "验收"],
  },
  {
    term: "API",
    pattern: /\bAPI\b|application programming interface/i,
    meaning: "Application Programming Interface，应用程序接口。",
    contexts: {
      product: "产品讨论里常指系统之间如何交换能力或数据。",
      startup: "SaaS 公司会把 API 当作集成和平台化能力。",
    },
    evidence: ["integration", "data", "endpoint", "接口", "集成", "数据", "开发"],
  },
  {
    term: "SDK",
    pattern: /\bSDK\b|software development kit/i,
    meaning: "Software Development Kit，软件开发工具包。",
    contexts: {
      product: "通常给开发者更快接入某项能力。",
      startup: "开发者平台、支付、AI、数据产品常会提供 SDK。",
    },
    evidence: ["developer", "integration", "API", "开发者", "接入", "集成"],
  },
  {
    term: "CRM",
    pattern: /\bCRM\b|customer relationship management/i,
    meaning: "Customer Relationship Management，客户关系管理系统或流程。",
    contexts: {
      startup: "销售团队常用 CRM 管线索、客户、机会和跟进记录。",
      product: "也可能指围绕客户生命周期管理的产品类别。",
    },
    evidence: ["sales", "customer", "pipeline", "客户", "销售", "线索", "跟进"],
  },
  {
    term: "TAM",
    pattern: /\bTAM\b|total addressable market/i,
    meaning: "Total Addressable Market，可服务的总市场规模。",
    contexts: {
      finance: "投资人常用 TAM 判断赛道天花板。",
      startup: "融资材料里常和 SAM、SOM 一起出现。",
    },
    evidence: ["market", "SAM", "SOM", "市场", "规模", "赛道", "融资"],
  },
  {
    term: "B2B",
    pattern: /\bB2B\b|business to business/i,
    meaning: "Business-to-business，面向企业客户的业务。",
    contexts: {
      startup: "B2B 公司通常销售周期更长，决策链更复杂。",
      product: "产品上会更重视权限、集成、安全和团队协作。",
    },
    evidence: ["enterprise", "sales", "customer", "企业", "客户", "销售", "采购"],
  },
  {
    term: "B2C",
    pattern: /\bB2C\b|business to consumer/i,
    meaning: "Business-to-consumer，面向个人消费者的业务。",
    contexts: {
      startup: "B2C 更常关注获客、留存、品牌和用户增长。",
      product: "产品侧通常更强调用户体验、转化和规模化增长。",
    },
    evidence: ["consumer", "user", "growth", "用户", "消费者", "转化", "增长"],
  },
  {
    term: "Startup",
    pattern: /\bstartup\b|start[-\s]?up/i,
    meaning: "创业公司，通常指仍在探索产品、市场和增长模式的早期公司。",
    contexts: {
      startup: "coffee chat 里常用于讨论公司阶段、商业模式、融资、团队和增长问题。",
      finance: "投资语境里会关注赛道、增长、收入质量、团队和融资阶段。",
    },
    evidence: ["company", "founder", "funding", "team", "problem", "公司", "创业", "融资", "团队", "问题"],
  },
  {
    term: "AE",
    pattern: /\bAE\b|account executive/i,
    meaning: "Account Executive，负责推进销售机会和签约的销售角色。",
    contexts: {
      startup: "B2B 团队里 AE 常接 SDR 传来的线索，推进 demo、谈判和成交。",
      career: "聊销售岗位时 AE 通常是核心一线销售。",
    },
    evidence: ["sales", "deal", "demo", "quota", "销售", "签约", "客户", "指标"],
  },
  {
    term: "SDR",
    pattern: /\bSDR\b|sales development representative/i,
    meaning: "Sales Development Representative，主要负责开发线索和约到销售机会。",
    contexts: {
      startup: "SDR 常负责 cold outreach、资格筛选和预约 demo。",
      career: "销售职业路径里 SDR 经常是进入 B2B sales 的起点。",
    },
    evidence: ["lead", "outreach", "demo", "线索", "开发", "约", "销售"],
  },
  {
    term: "CSM",
    pattern: /\bCSM\b|customer success manager/i,
    meaning: "Customer Success Manager，客户成功经理。",
    contexts: {
      startup: "CSM 负责让客户用起来、续费、扩容并减少流失。",
      product: "产品团队会从 CSM 那里获得客户反馈和痛点。",
    },
    evidence: ["customer", "success", "renewal", "客户", "成功", "续费", "扩容"],
  },
  {
    term: "BD",
    pattern: /\bBD\b|business development/i,
    meaning: "Business Development，商务拓展或业务合作。",
    contexts: {
      startup: "常负责合作伙伴、渠道、战略合作或新业务机会。",
      career: "岗位语境里可能指商务拓展角色。",
    },
    evidence: ["partner", "channel", "deal", "合作", "渠道", "商务", "拓展"],
  },
  {
    term: "Sync",
    pattern: /\bsync\b|同步/i,
    meaning: "同步信息或短会，通常是让团队更新进展、风险和下一步。",
    contexts: {
      career: "coffee chat 里可能指约个时间再聊或同步近况。",
      product: "跨职能项目里常用 sync 保持节奏一致。",
    },
    evidence: ["meeting", "update", "team", "同步", "会议", "进展", "对齐"],
  },
  {
    term: "Follow-up",
    pattern: /\bfollow[-\s]?up\b|跟进/i,
    meaning: "跟进，指会后继续推进某个问题、动作或联系。",
    contexts: {
      career: "coffee chat 后常会 follow up，表示发感谢、补资料或继续联系。",
      startup: "销售或项目里指继续推进客户和任务。",
    },
    evidence: ["email", "next step", "after", "邮件", "下一步", "会后", "联系"],
  },
  {
    term: "Deep Dive",
    pattern: /\bdeep dive\b/i,
    meaning: "深入研究或详细拆解某个问题。",
    contexts: {
      product: "常指深入看数据、用户反馈或某个功能模块。",
      finance: "投资或研究中常指对公司、行业或指标做细看。",
    },
    evidence: ["detail", "data", "research", "深入", "拆解", "数据", "研究"],
  },
  {
    term: "Tradeoff",
    pattern: /\btrade[-\s]?off\b|取舍/i,
    meaning: "取舍，在两个或多个目标之间做权衡。",
    contexts: {
      product: "产品决策常在速度、质量、范围、成本之间做 tradeoff。",
      career: "面试中常用来考察判断力和优先级意识。",
    },
    evidence: ["priority", "scope", "cost", "优先级", "范围", "成本", "速度"],
  },
  {
    term: "PM",
    pattern: /\bPM\b/i,
    meaning: "可能是 Product Manager，也可能是 Project Manager。",
    contexts: {
      product: "如果旁边出现 roadmap、feature、user，多半是产品经理。",
      career: "求职语境里常见是 Product Manager 岗位；如果旁边出现 timeline、delivery、dependency，也可能是 Project Manager。",
    },
    evidence: ["product", "roadmap", "feature", "user", "timeline", "delivery", "产品", "项目", "排期"],
    ambiguity: "PM 是高歧义缩写，需要结合上下文判断。",
  },
  {
    term: "IC",
    pattern: /\bIC\b/i,
    meaning: "常见含义是 Individual Contributor，非管理岗的独立贡献者。",
    contexts: {
      career: "职业发展里常和 manager track 对比。",
      finance: "VC/基金语境里也可能是 Investment Committee，投委会。",
    },
    evidence: ["manager", "track", "career", "investment", "committee", "职业", "管理", "投委会"],
    ambiguity: "如果聊投资决策，IC 可能是投委会。",
  },
];

function buildExtraTerm(spec) {
  if (!spec?.term || !spec?.pattern || !spec?.meaning || !spec?.contexts || !spec?.evidence) return null;
  return {
    term: spec.term,
    pattern: new RegExp(spec.pattern, spec.flags ?? "i"),
    meaning: spec.meaning,
    contexts: spec.contexts,
    evidence: spec.evidence,
    ...(spec.ambiguity ? { ambiguity: spec.ambiguity } : {}),
  };
}

const EXTRA_TERMS = Array.isArray(window.LINGUA_CUE_EXTRA_TERMS)
  ? window.LINGUA_CUE_EXTRA_TERMS.map(buildExtraTerm).filter(Boolean)
  : [];

TERMS.push(...EXTRA_TERMS);

const LETTERED_ACRONYM_SKIP = new Set(["SAFE", "RICE", "STAR"]);
const LETTERED_ACRONYM_CORRECTIONS = Array.from(
  new Set(
    TERMS.map((term) => term.term).filter(
      (term) => /^[A-Z][A-Z0-9]{1,6}$/.test(term) && !LETTERED_ACRONYM_SKIP.has(term)
    )
  )
).map((term) => ({
  term,
  pattern: new RegExp(`\\b${term.split("").join("\\s*")}\\b`, "gi"),
}));

const MIXED_LANGUAGE_TERM_PATTERN = Array.from(
  new Set(
    ["RAG", ...TERMS.map((term) => term.term)].filter((term) => /^[A-Za-z0-9][A-Za-z0-9./:+-]{1,13}$/.test(term))
  )
)
  .sort((a, b) => b.length - a.length)
  .map(escapeRegExp)
  .join("|");

const VIBE_CODING_MISHEAR_PATTERN_SOURCE = String.raw`\b(?:web|wave|wipe|wife)\s+(?:cod(?:e|ing)|coating)\b|\b(?:web|wave|wipe|wife)(?:cod(?:e|ing)|coating)\b|(?:外部|外边|歪部|外不)\s*(?:coating|coding|code|扣丁|口丁)`;
const TERM_RESCUE_MAX_AUTO_CORRECTIONS = 2;
const TERM_RESCUE_MAX_HINTS = 2;
const TERM_RESCUE_AUTO_SCORE = 0.94;
const TERM_RESCUE_CONTEXT_SCORE = 0.86;
const TERM_RESCUE_HINT_SCORE = 0.8;
const TERM_RESCUE_WORD_MAP = {
  web: "vibe",
  wave: "vibe",
  wipe: "vibe",
  wife: "vibe",
  wives: "vibe",
  vibe: "vibe",
  vibes: "vibe",
  code: "coding",
  coded: "coding",
  codin: "coding",
  codeing: "coding",
  coating: "coding",
  coatings: "coding",
  cash: "cache",
  cached: "cache",
  caching: "cache",
  register: "registry",
  registration: "registry",
  registries: "registry",
  asian: "agent",
  ancient: "agent",
  urgent: "agent",
};
const TERM_RESCUE_PROTECTED_WEB_CONTEXT =
  /\b(?:HTML|CSS|JavaScript|TypeScript|React|Vue|Angular|Svelte|frontend|front-end|website|web app|webpage|browser|DOM)\b|网页|前端|网站|浏览器|页面开发|Web开发|web开发/i;
const TERM_RESCUE_PROTECTED_COATING_CONTEXT =
  /\b(?:paint|surface|film|polymer|chemical|material|manufacturing|spray|powder)\b|涂层|镀膜|喷涂|材料|化学|表面|防水|粉末|制造/i;
const TERM_RESCUE_PROTECTED_CASH_CONTEXT =
  /\b(?:runway|burn|funding|finance|valuation|ARR|revenue|margin|VC)\b|现金|融资|估值|收入|基金|投资/i;

const DOMAIN_LABELS = {
  startup: "Startup / SaaS",
  career: "求职 / 面试",
  finance: "VC / 金融",
  product: "产品 / 增长",
  engineering: "技术 / 工程",
};

const DEFAULT_DOMAIN = "startup";
const DOMAIN_KEYWORDS = {
  startup: [
    ["startup", 10],
    ["saas", 9],
    ["gtm", 8],
    ["arr", 8],
    ["mrr", 8],
    ["cac", 7],
    ["ltv", 7],
    ["ndr", 7],
    ["nrr", 7],
    ["churn", 7],
    ["pipeline", 6],
    ["sales", 6],
    ["customer", 5],
    ["revenue", 6],
    ["founder", 6],
    ["mvp", 6],
    ["icp", 6],
    ["创业", 10],
    ["公司", 4],
    ["客户", 6],
    ["收入", 6],
    ["销售", 6],
    ["增长", 5],
    ["商业化", 6],
  ],
  career: [
    ["interview", 10],
    ["role", 8],
    ["offer", 8],
    ["recruiter", 9],
    ["hiring manager", 10],
    ["resume", 8],
    ["referral", 8],
    ["behavioral", 8],
    ["onsite", 7],
    ["comp", 7],
    ["salary", 8],
    ["career", 8],
    ["manager track", 8],
    ["面试", 10],
    ["求职", 10],
    ["岗位", 8],
    ["简历", 8],
    ["内推", 8],
    ["薪酬", 8],
    ["晋升", 8],
    ["经理", 5],
  ],
  finance: [
    ["vc", 10],
    ["investor", 9],
    ["fund", 8],
    ["term sheet", 10],
    ["safe", 8],
    ["cap table", 9],
    ["valuation", 9],
    ["liquidation", 9],
    ["dilution", 8],
    ["equity", 7],
    ["lp", 7],
    ["gp", 7],
    ["carry", 8],
    ["irr", 8],
    ["moic", 8],
    ["dpi", 8],
    ["融资", 8],
    ["投资", 10],
    ["基金", 9],
    ["估值", 9],
    ["股权", 8],
    ["条款", 7],
    ["天使轮", 8],
    ["A轮", 8],
  ],
  product: [
    ["product", 9],
    ["roadmap", 9],
    ["feature", 8],
    ["user", 7],
    ["ux", 8],
    ["ui", 6],
    ["prd", 8],
    ["backlog", 8],
    ["sprint", 7],
    ["activation", 8],
    ["retention", 7],
    ["conversion", 7],
    ["funnel", 7],
    ["experiment", 7],
    ["metric", 7],
    ["产品", 10],
    ["用户", 8],
    ["功能", 8],
    ["需求", 8],
    ["指标", 7],
    ["留存", 7],
    ["转化", 7],
    ["设计", 7],
    ["路线图", 8],
  ],
  engineering: [
    ["code", 9],
    ["coding", 8],
    ["repo", 9],
    ["codebase", 9],
    ["github", 8],
    ["git", 8],
    ["pr", 7],
    ["pull request", 10],
    ["merge", 8],
    ["branch", 7],
    ["ci", 7],
    ["cd", 6],
    ["build", 7],
    ["test", 7],
    ["deploy", 8],
    ["api", 7],
    ["database", 8],
    ["schema", 7],
    ["queue", 8],
    ["kafka", 8],
    ["airflow", 8],
    ["incident", 8],
    ["sre", 8],
    ["on-call", 8],
    ["工程", 10],
    ["技术", 8],
    ["代码", 10],
    ["仓库", 8],
    ["分支", 8],
    ["合并", 8],
    ["冲突", 8],
    ["构建", 8],
    ["测试", 7],
    ["部署", 8],
    ["数据库", 8],
    ["消息队列", 9],
    ["事件总线", 9],
    ["告警", 8],
    ["事故", 8],
    ["运维", 8],
  ],
};

const ACRONYM_HINTS = {
  AI: {
    meaning: "Artificial Intelligence，人工智能。",
    context: "产品、自动化、数据分析、搜索、客服和内容生成场景都常见。",
    ambiguity: "通常较明确；如果对方在讲具体技术，可能还需要区分传统 AI、ML 或 LLM。",
    confidence: 76,
  },
  ML: {
    meaning: "Machine Learning，机器学习。",
    context: "通常指通过数据训练模型来做预测、分类、推荐或生成。",
    ambiguity: "如果上下文是工程或数据团队，多半就是机器学习。",
    confidence: 72,
  },
  GT: {
    meaning: "GT 是高歧义缩写，可能是 Growth Team、Graduate Trainee，或某个团队内部简称。",
    context: "如果聊增长或业务，可能和增长团队相关；如果聊校招或岗位，可能是管培生。",
    ambiguity: "建议直接追问：这里的 GT 指 growth team 还是别的？",
    confidence: 46,
  },
  ARPM: {
    meaning: "ARPM 不是通用高频缩写，可能是公司内部岗位、指标，或语音识别把 ARPU / ARR / PM 混在一起了。",
    context: "如果对方在聊收入指标，留意是否其实是 ARPU；如果在聊岗位，可能和 PM 角色有关。",
    ambiguity: "低置信候选，最好当场确认具体展开。",
    confidence: 38,
  },
  LLM: {
    meaning: "Large Language Model，大语言模型。",
    context: "AI 产品、自动化、客服、搜索和内容生成场景里常见。",
    ambiguity: "也可能是法学硕士 LL.M.，需看上下文。",
    confidence: 70,
  },
};

const ACRONYM_SKIPLIST = new Set(["OK"]);

const FALLBACK_KNOWLEDGE = [
  {
    term: "RAG",
    aliases: ["retrieval augmented generation"],
    meaning: "Retrieval-Augmented Generation，先检索资料再让模型生成答案。",
    context: "AI 应用里常用它把公司文档、知识库或数据库接进回答流程。",
    ambiguity: "如果上下文不是 AI，也可能是内部项目名；当前解释按 AI 语境处理。",
    evidence: ["retrieval", "knowledge", "vector", "search", "检索", "知识库", "向量"],
    confidence: 74,
  },
  {
    term: "MCP",
    aliases: ["model context protocol"],
    meaning: "Model Context Protocol，一种让 AI 应用连接工具、数据源和上下文的协议。",
    context: "如果在聊 agent、工具调用、插件或数据接入，通常是在讲模型如何拿到外部上下文。",
    ambiguity: "MCP 也可能是公司内部简称；如果没有 AI/工具语境，需要确认。",
    evidence: ["agent", "tool", "context", "plugin", "server", "工具", "上下文", "协议"],
    confidence: 70,
  },
  {
    term: "eval harness",
    aliases: ["evaluation harness"],
    meaning: "评测框架，用固定数据、指标和流程系统性测试模型或产品表现。",
    context: "AI 团队会用它比较 prompt、模型、检索策略或安全策略的效果。",
    ambiguity: "如果对方在讲普通工程测试，也可能只是测试脚手架。",
    evidence: ["eval", "benchmark", "metric", "model", "测试", "评测", "指标"],
    confidence: 78,
  },
  {
    term: "guardrail tuning",
    aliases: ["guardrails", "guardrail"],
    meaning: "调整安全边界或行为约束，让系统更少越界、更稳定地遵守规则。",
    context: "AI 产品里常用于减少幻觉、敏感输出、错误工具调用或不符合品牌语气的回答。",
    ambiguity: "guardrail 在非 AI 语境里也可以泛指流程控制或风控边界。",
    evidence: ["safety", "policy", "risk", "model", "安全", "边界", "风控"],
    confidence: 72,
  },
  {
    term: "context engineering",
    aliases: ["context eng"],
    meaning: "上下文工程，系统化设计模型能看到的指令、工具、记忆和资料。",
    context: "常见于 agent、RAG、长上下文和企业知识助手场景。",
    ambiguity: "这个词仍在演化，不同团队可能定义不同。",
    evidence: ["prompt", "agent", "memory", "context", "上下文", "记忆", "提示词"],
    confidence: 68,
  },
  {
    term: "vibe coding",
    aliases: ["vibecoding", "vibe code"],
    meaning: "用自然语言和 AI 快速协作写代码，强调边试边改的开发方式。",
    context: "通常出现在原型、个人工具、早期产品验证或 AI 编程工具讨论里。",
    ambiguity: "语气可能偏口语或玩笑，不一定是正式工程流程。",
    evidence: ["code", "prototype", "AI", "coding", "代码", "原型", "开发"],
    confidence: 66,
  },
  {
    term: "agentic workflow",
    aliases: ["agentic workflows", "agentic"],
    meaning: "让 AI 像代理一样分解任务、调用工具、检查结果并持续推进的工作流。",
    context: "常见于自动化、开发助手、数据分析、客服和运营任务。",
    ambiguity: "agentic 有时只是营销说法，需要看是否真的有工具调用和闭环验证。",
    evidence: ["agent", "workflow", "tool", "automation", "代理", "自动化", "工具"],
    confidence: 70,
  },
  {
    term: "tool calling",
    aliases: ["function calling"],
    meaning: "模型根据上下文选择并调用外部工具或函数，再用结果继续回答。",
    context: "AI 应用里常用于查数据库、发请求、改文件、排日程或执行工作流。",
    ambiguity: "不同平台叫法可能不同，例如 function calling、tools、actions。",
    evidence: ["function", "agent", "API", "工具", "函数", "调用"],
    confidence: 78,
  },
  {
    term: "AI infra",
    aliases: ["AI infrastructure", "ai infrastructure"],
    meaning: "AI 基础设施，支撑模型训练、推理、评测、部署和监控的一组系统能力。",
    context: "创业或平台团队会用它指模型服务、向量库、评测、数据管道、成本和可靠性层。",
    ambiguity: "不同团队范围差异很大，有时只是泛指 AI 平台工程。",
    evidence: ["model", "serving", "eval", "deployment", "模型", "平台", "部署", "评测"],
    confidence: 70,
  },
  {
    term: "RAGOps",
    aliases: ["RAG ops", "rag ops"],
    meaning: "围绕 RAG 系统的运维和优化，包括检索质量、索引更新、评测和监控。",
    context: "企业知识库、客服助手和搜索增强问答里会出现这个说法。",
    ambiguity: "不是所有团队都会用这个正式叫法，可能只是内部命名。",
    evidence: ["RAG", "retrieval", "index", "eval", "检索", "索引", "知识库"],
    confidence: 62,
  },
  {
    term: "LLMOps",
    aliases: ["LLM ops", "llm ops"],
    meaning: "围绕大语言模型应用的工程运维，包括评测、监控、版本、成本和安全。",
    context: "类似 MLOps，但更关注 prompt、模型调用、上下文、工具和输出质量。",
    ambiguity: "行业里边界仍在变化，不同团队可能定义不同。",
    evidence: ["LLM", "monitoring", "eval", "prompt", "模型", "评测", "监控"],
    confidence: 64,
  },
  {
    term: "DevEx",
    aliases: ["developer experience", "developer-experience"],
    meaning: "Developer Experience，开发者体验。",
    context: "常用于讨论 API、SDK、文档、工具链、示例代码和接入流程是否顺滑。",
    ambiguity: "如果不是开发者平台语境，也可能是内部团队名。",
    evidence: ["developer", "API", "SDK", "docs", "开发者", "文档", "接入"],
    confidence: 72,
  },
];

const TERM_RESCUE_INDEX = buildTermRescueIndex();

const sampleLines = [
  "我现在的这个step有很大的问题。",
  "我们 Q3 主要 focus 在 GTM，PMM 会和 sales 做 enablement。",
  "如果 ICP 再清楚一点，pipeline 质量应该会比现在好很多。",
  "他们 ARR 增长不错，但 CAC payback 和 churn 还要再看。",
  "这个 PM role 很看重 ownership，也要能和 stakeholder 做 alignment。",
  "VC 那边会问 NDR、LTV 和 deck 里的 north star metric。",
  "AI 团队最近在搭 eval harness，也在调 RAG 和 guardrail tuning。",
];

const state = {
  listening: false,
  paused: false,
  asrEngine: "local",
  recognition: null,
  recognitionActive: false,
  recognitionRestarting: false,
  restartAttempts: 0,
  restartTimer: null,
  watchdogTimer: null,
  lastSpeechAt: 0,
  lastRecognitionStartAt: 0,
  mediaStream: null,
  mediaRecorder: null,
  openaiChunkIndex: 0,
  openaiPendingChunks: 0,
  openaiStatusChecked: false,
  localAudio: null,
  localDraftRecognition: null,
  localDraftClearTimer: null,
  localDraftRestartTimer: null,
  localDraftText: "",
  localDraftUpdatedAt: 0,
  localChunkIndex: 0,
  localPendingChunks: 0,
  localBlankChunks: 0,
  asrProxyBase: "",
  transcript: [],
  contextHistory: [],
  interimText: "",
  interimCorrection: null,
  cues: [],
  selectedCueId: null,
  manualSelectionLockedUntil: 0,
  currentDomain: "startup",
  lastProcessedText: "",
  lastProcessAt: 0,
  lastSystemNotice: "",
  lastSystemNoticeAt: 0,
  systemNoticeText: "",
  systemNoticeTimer: null,
  micBlocked: false,
  fallbackEnabled: true,
  focusMode: loadFocusMode(),
  enrichmentTimers: new Map(),
  personalGlossary: loadPersonalGlossary(),
  suppressedCueTerms: loadSuppressedCueTerms(),
  sessionHiddenTerms: new Set(),
  personalGlossaryVersion: 0,
  highlightCache: new Map(),
  correctionMemory: loadCorrectionMemory(),
  sampleTimer: null,
  micLevel: 0,
  wavePhase: 0,
};

const els = {
  listenButton: document.querySelector("#listenButton"),
  pauseButton: document.querySelector("#pauseButton"),
  sampleButton: document.querySelector("#sampleButton"),
  clearButton: document.querySelector("#clearButton"),
  fallbackToggle: document.querySelector("#fallbackToggle"),
  focusModeToggle: document.querySelector("#focusModeToggle"),
  asrSelect: document.querySelector("#asrSelect"),
  micLevelBar: document.querySelector("#micLevelBar"),
  micLevelText: document.querySelector("#micLevelText"),
  transcriptFeed: document.querySelector("#transcriptFeed"),
  cueList: document.querySelector("#cueList"),
  cueCount: document.querySelector("#cueCount"),
  detailCard: document.querySelector("#detailCard"),
  sessionNotice: document.querySelector("#sessionNotice"),
  manualForm: document.querySelector("#manualForm"),
  manualInput: document.querySelector("#manualInput"),
  statusDot: document.querySelector("#statusDot"),
  statusText: document.querySelector("#statusText"),
  latencyReadout: document.querySelector("#latencyReadout"),
  confidenceReadout: document.querySelector("#confidenceReadout"),
  engineReadout: document.querySelector("#engineReadout"),
  speedMetric: document.querySelector("#speedMetric"),
  accuracyMetric: document.querySelector("#accuracyMetric"),
  waveCanvas: document.querySelector("#waveCanvas"),
  transcriptTemplate: document.querySelector("#transcriptItemTemplate"),
  cueTemplate: document.querySelector("#cueItemTemplate"),
};

function nowLabel() {
  return new Intl.DateTimeFormat("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(new Date());
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function cleanText(text) {
  return text.replace(/\s+/g, " ").trim();
}

function escapeHTML(value) {
  return value.replace(/[&<>"']/g, (char) => {
    const entities = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
    return entities[char];
  });
}

function loadPersonalGlossary() {
  try {
    const raw = localStorage.getItem(PERSONAL_GLOSSARY_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch (error) {
    return {};
  }
}

function savePersonalGlossary() {
  localStorage.setItem(PERSONAL_GLOSSARY_KEY, JSON.stringify(state.personalGlossary));
}

function loadSuppressedCueTerms() {
  try {
    const raw = localStorage.getItem(SUPPRESSED_CUE_TERMS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch (error) {
    return {};
  }
}

function saveSuppressedCueTerms() {
  localStorage.setItem(SUPPRESSED_CUE_TERMS_KEY, JSON.stringify(state.suppressedCueTerms));
}

function loadCorrectionMemory() {
  try {
    const raw = localStorage.getItem(CORRECTION_MEMORY_KEY);
    if (!raw) return { acceptedLines: {}, rejectedLines: {} };
    const parsed = JSON.parse(raw);
    return {
      acceptedLines: parsed?.acceptedLines && typeof parsed.acceptedLines === "object" ? parsed.acceptedLines : {},
      rejectedLines: parsed?.rejectedLines && typeof parsed.rejectedLines === "object" ? parsed.rejectedLines : {},
    };
  } catch (error) {
    return { acceptedLines: {}, rejectedLines: {} };
  }
}

function saveCorrectionMemory() {
  localStorage.setItem(CORRECTION_MEMORY_KEY, JSON.stringify(state.correctionMemory));
}

function loadFocusMode() {
  try {
    const stored = localStorage.getItem(FOCUS_MODE_KEY);
    return stored === null ? true : stored === "1";
  } catch (error) {
    return true;
  }
}

function saveFocusMode() {
  localStorage.setItem(FOCUS_MODE_KEY, state.focusMode ? "1" : "0");
}

function clearHighlightCache() {
  state.highlightCache.clear();
}

function getHighlightCacheKey(text) {
  return `${state.personalGlossaryVersion}:${text}`;
}

function rememberHighlightCache(key, html) {
  state.highlightCache.set(key, html);
  if (state.highlightCache.size <= HIGHLIGHT_CACHE_LIMIT) return;

  const [oldestKey] = state.highlightCache.keys();
  state.highlightCache.delete(oldestKey);
}

function makeLineId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function addContextHistoryLine(item) {
  if (!item?.text || item.kind !== "speech") return;
  state.contextHistory.push({
    id: item.id,
    time: item.time,
    text: item.text,
  });
  state.contextHistory = state.contextHistory.slice(-CONTEXT_HISTORY_LIMIT);
}

function updateContextHistoryLine(item) {
  if (!item?.id) return;
  const entry = state.contextHistory.find((line) => line.id === item.id);
  if (entry) entry.text = item.text;
}

function renderSystemNotice() {
  if (!els.sessionNotice) return;
  els.sessionNotice.hidden = !state.systemNoticeText;
  els.sessionNotice.textContent = state.systemNoticeText;
}

function clearSystemNotice() {
  state.systemNoticeText = "";
  if (state.systemNoticeTimer) {
    clearTimeout(state.systemNoticeTimer);
    state.systemNoticeTimer = null;
  }
  renderSystemNotice();
}

function cueFromPersonalGlossary(entry, text) {
  const domain = inferDomain(text);
  return {
    id: `${entry.term}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    term: entry.term,
    meaning: entry.meaning,
    context: entry.context,
    ambiguity: entry.ambiguity || "来自个人词库，仍建议结合现场上下文确认。",
    confidence: Math.max(68, entry.confidence || 72),
    evidence: ["个人词库"],
    sourceText: text,
    domain: domain.label,
    domainKey: domain.key,
    contextOptions: [],
    createdAt: Date.now(),
    source: "personal",
  };
}

function applyTranscriptCorrections(text) {
  let corrected = cleanText(text);
  const corrections = [];
  const memoryKey = correctionMemoryKey(corrected);

  if (state.correctionMemory.rejectedLines[memoryKey]) {
    return {
      text: corrected,
      corrections: [],
      rescueCandidates: [],
      originalText: "",
    };
  }

  const remembered = state.correctionMemory.acceptedLines[memoryKey];
  if (remembered) {
    return {
      text: remembered.text || remembered,
      corrections: ["个人纠错"],
      rescueCandidates: [],
      originalText: corrected,
    };
  }

  corrected = replaceWithCorrection(corrected, /\bstart[-\s]+up\b/gi, "startup", "start up -> startup", corrections);
  corrected = replaceWithCorrection(corrected, /\bS\s*A\s*A\s*S\b/gi, "SaaS", "S A A S -> SaaS", corrections);
  corrected = replaceWithCorrection(corrected, /\bG\s*T\s*M\b/gi, "GTM", "G T M -> GTM", corrections);
  corrected = replaceWithCorrection(corrected, /\bP\s*M\s*M\b/gi, "PMM", "P M M -> PMM", corrections);
  corrected = replaceWithCorrection(corrected, /\bP\s*M\b/gi, "PM", "P M -> PM", corrections);
  corrected = replaceWithCorrection(corrected, /\bvibe\s+code\b/gi, "vibe coding", "vibe code -> vibe coding", corrections);
  LETTERED_ACRONYM_CORRECTIONS.forEach(({ term, pattern }) => {
    corrected = replaceWithCorrection(corrected, pattern, term, `${term.split("").join(" ")} -> ${term}`, corrections);
  });

  if (shouldUseVibeCodingBias(corrected)) {
    corrected = replaceWithCorrection(
      corrected,
      new RegExp(VIBE_CODING_MISHEAR_PATTERN_SOURCE, "gi"),
      "vibe coding",
      "web/coating -> vibe coding",
      corrections
    );
  }

  const rescue = rescueMisheardTerms(corrected);
  corrected = rescue.text;
  corrections.push(...rescue.corrections);

  if (shouldUseStartupBias(corrected)) {
    const before = corrected;
    corrected = corrected.replace(
      /((?:我现在的这个|我们现在的这个|我这个|我们这个|我的这个|我们的这个|做的这个|这个|那个))step(?=(?:有|是|很|问题|融资|产品|市场|客户|团队|公司))/gi,
      "$1 startup"
    );
    if (corrected !== before) corrections.push("step -> startup");
  }

  corrected = normalizeMixedTermSpacing(corrected);

  return {
    text: corrected,
    corrections: Array.from(new Set(corrections)),
    rescueCandidates: rescue.candidates,
    originalText: corrected === text ? "" : text,
  };
}

function normalizeMixedTermSpacing(text) {
  if (!MIXED_LANGUAGE_TERM_PATTERN) return text.replace(/\s+/g, " ").trim();
  return text
    .replace(/([\u4e00-\u9fa5])\s*(vibe coding)\b/gi, "$1 $2")
    .replace(/\b(vibe coding)\s*([\u4e00-\u9fa5])/gi, "$1 $2")
    .replace(new RegExp(`([\\u4e00-\\u9fa5])\\s*(${MIXED_LANGUAGE_TERM_PATTERN})\\b`, "gi"), "$1 $2")
    .replace(new RegExp(`\\b(${MIXED_LANGUAGE_TERM_PATTERN})\\s*([\\u4e00-\\u9fa5])`, "gi"), "$1 $2")
    .replace(/\s+/g, " ")
    .trim();
}

function replaceWithCorrection(text, pattern, replacement, label, corrections) {
  const next = text.replace(pattern, replacement);
  if (next !== text) corrections.push(label);
  return next;
}

function correctionMemoryKey(text) {
  return cleanText(text).toLowerCase();
}

function rememberTranscriptCorrection(item) {
  const raw = cleanText(item?.rawText || item?.originalText || "");
  const corrected = cleanText(item?.text || "");
  if (!raw || !corrected || raw === corrected) return;

  const key = correctionMemoryKey(raw);
  state.correctionMemory.acceptedLines[key] = {
    text: corrected,
    savedAt: new Date().toISOString(),
  };
  delete state.correctionMemory.rejectedLines[key];
  item.correctionSaved = true;
  saveCorrectionMemory();
  renderTranscript();
}

function rejectTranscriptCorrection(item) {
  const raw = cleanText(item?.rawText || item?.originalText || "");
  if (!raw) return;

  const key = correctionMemoryKey(raw);
  state.correctionMemory.rejectedLines[key] = {
    correctedText: item.text,
    rejectedAt: new Date().toISOString(),
  };
  delete state.correctionMemory.acceptedLines[key];

  item.text = raw;
  item.rawText = "";
  item.corrections = [];
  item.correctionRejected = true;
  updateContextHistoryLine(item);
  saveCorrectionMemory();
  renderTranscript();
  rebuildCuesFromTranscript();
}

function buildTermRescueIndex() {
  const seen = new Set();
  const entries = [];

  TERMS.forEach((term) => {
    addTermRescueEntry(entries, seen, {
      term: term.term,
      aliases: [],
      meaning: term.meaning,
      contexts: term.contexts,
      ambiguity: term.ambiguity || "",
      evidence: term.evidence,
      confidence: 62,
      source: "term",
    });
  });

  FALLBACK_KNOWLEDGE.forEach((item) => {
    addTermRescueEntry(entries, seen, {
      term: item.term,
      aliases: item.aliases,
      meaning: item.meaning,
      contexts: { startup: item.context, product: item.context },
      ambiguity: item.ambiguity,
      evidence: item.evidence,
      confidence: item.confidence,
      source: "fallback",
    });
  });

  return entries.sort((a, b) => b.term.length - a.term.length);
}

function addTermRescueEntry(entries, seen, spec) {
  if (!isRescueEligibleTerm(spec.term)) return;
  const key = normalizeTermKey(spec.term);
  if (seen.has(key)) return;
  seen.add(key);

  const targetPhrases = Array.from(new Set([spec.term, ...(spec.aliases || [])]))
    .filter(isRescueEligiblePhrase)
    .map((phrase) => ({
      phrase,
      normalized: normalizeRescuePhrase(phrase),
      wordCount: countRescueWords(phrase),
    }))
    .filter((target) => target.normalized.length >= 5);

  if (!targetPhrases.length) return;
  entries.push({
    ...spec,
    targets: targetPhrases,
  });
}

function isRescueEligibleTerm(term) {
  if (!isRescueEligiblePhrase(term)) return false;
  const wordCount = countRescueWords(term);
  return wordCount >= 2 && wordCount <= 4;
}

function isRescueEligiblePhrase(value) {
  return /^[A-Za-z0-9][A-Za-z0-9+.#&/' -]{4,42}$/.test(value || "");
}

function countRescueWords(value) {
  return (String(value).match(/[A-Za-z0-9]+/g) || []).length;
}

function rescueMisheardTerms(text) {
  const phrases = extractTermRescuePhrases(text);
  if (!phrases.length) return { text, corrections: [], candidates: [] };

  const context = getRecentContextText(text);
  const matches = [];
  const hints = [];

  phrases.forEach((phrase) => {
    const best = findBestTermRescueMatch(phrase, context);
    if (!best) return;
    if (best.auto) matches.push(best);
    else hints.push(best);
  });

  const selected = selectNonOverlappingRescues(matches, TERM_RESCUE_MAX_AUTO_CORRECTIONS);
  const nextText = applyTermRescueMatches(text, selected);
  const corrections = selected.map((match) => `${match.original} -> ${match.term}`);
  const candidates = selectNonOverlappingRescues(hints, TERM_RESCUE_MAX_HINTS).map((match) =>
    buildTermRescueCandidate(match, nextText)
  );

  return {
    text: nextText,
    corrections,
    candidates,
  };
}

function extractTermRescuePhrases(text) {
  const tokens = [];
  const tokenPattern = /[A-Za-z][A-Za-z0-9+.#&/-]*/g;
  let match;

  while ((match = tokenPattern.exec(text))) {
    tokens.push({
      text: match[0],
      start: match.index,
      end: match.index + match[0].length,
    });
  }

  const phrases = [];
  for (let start = 0; start < tokens.length; start += 1) {
    for (let length = 1; length <= 4 && start + length <= tokens.length; length += 1) {
      const first = tokens[start];
      const last = tokens[start + length - 1];
      const value = text.slice(first.start, last.end);
      if (!/^[A-Za-z0-9+.#&/'\s-]+$/.test(value)) continue;
      if (value.length < 5 || value.length > 44) continue;
      phrases.push({
        original: value,
        start: first.start,
        end: last.end,
        wordCount: length,
        normalized: normalizeRescuePhrase(value),
      });
    }
  }

  return phrases;
}

function normalizeRescuePhrase(value) {
  return String(value)
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[+.#&/-]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => TERM_RESCUE_WORD_MAP[word] || word)
    .join("");
}

function findBestTermRescueMatch(phrase, context) {
  if (!phrase.normalized) return null;
  let best = null;

  TERM_RESCUE_INDEX.forEach((entry) => {
    entry.targets.forEach((target) => {
      if (Math.abs(phrase.wordCount - target.wordCount) > 1) return;
      if (phraseAlreadyMatchesTarget(phrase.original, target.phrase)) return;
      if (hasProtectedRescueContext(phrase.original, target.phrase, context)) return;

      const score = rescueSimilarity(phrase.normalized, target.normalized);
      const evidenceHits = rescueEvidenceHits(entry, context);
      const hasHomophoneSignal = hasRescueHomophoneSignal(phrase.original, target.phrase);
      const needsContext = rescueNeedsContextEvidence(phrase.original, target.phrase);
      const hasEnoughContext = evidenceHits.length > 0 || isVibeCodingRescue(phrase.original, target.phrase);
      const auto =
        (score >= TERM_RESCUE_AUTO_SCORE && (!needsContext || hasEnoughContext)) ||
        (score >= TERM_RESCUE_CONTEXT_SCORE &&
          (!needsContext || hasEnoughContext) &&
          (evidenceHits.length > 0 || hasHomophoneSignal));
      const hint = score >= TERM_RESCUE_HINT_SCORE && (evidenceHits.length > 0 || hasHomophoneSignal);
      if (!auto && !hint) return;

      const candidate = {
        ...phrase,
        term: entry.term,
        entry,
        score,
        evidenceHits,
        auto,
      };

      if (!best || candidate.score > best.score || (candidate.auto && !best.auto)) {
        best = candidate;
      }
    });
  });

  return best;
}

function phraseAlreadyMatchesTarget(phrase, target) {
  return cleanText(phrase).toLowerCase() === cleanText(target).toLowerCase();
}

function hasProtectedRescueContext(phrase, target, context) {
  const phraseLower = phrase.toLowerCase();
  const targetLower = target.toLowerCase();
  if (/\bweb\b/.test(phraseLower) && !/\bweb\b/.test(targetLower) && TERM_RESCUE_PROTECTED_WEB_CONTEXT.test(context)) {
    return true;
  }
  if (/\bcoatings?\b/.test(phraseLower) && !/\bcoatings?\b/.test(targetLower) && TERM_RESCUE_PROTECTED_COATING_CONTEXT.test(context)) {
    return true;
  }
  if (/\bcash\b/.test(phraseLower) && /\bcache\b/.test(targetLower) && TERM_RESCUE_PROTECTED_CASH_CONTEXT.test(context)) {
    return true;
  }
  return false;
}

function rescueEvidenceHits(entry, context) {
  const lower = tokenizeContext(context);
  return (entry.evidence || []).filter((word) => lower.includes(String(word).toLowerCase()));
}

function hasRescueHomophoneSignal(phrase, target) {
  const phraseLower = phrase.toLowerCase();
  const targetLower = target.toLowerCase();
  if (targetLower.includes("vibe") && /\b(?:web|wave|wipe|wife|coating|code)\b/.test(phraseLower)) return true;
  if (targetLower.includes("cache") && /\bcash\b/.test(phraseLower)) return true;
  if (targetLower.includes("registry") && /\bregister|registration\b/.test(phraseLower)) return true;
  if (targetLower.includes("agent") && /\basian|ancient|urgent\b/.test(phraseLower)) return true;
  return false;
}

function rescueNeedsContextEvidence(phrase, target) {
  const phraseLower = phrase.toLowerCase();
  const targetLower = target.toLowerCase();
  if (targetLower.includes("agent") && /\b(?:asian|ancient|urgent)\b/.test(phraseLower)) return true;
  if (targetLower.includes("cache") && /\bcash\b/.test(phraseLower)) return true;
  if (targetLower.includes("registry") && /\b(?:register|registration)\b/.test(phraseLower)) return true;
  return false;
}

function isVibeCodingRescue(phrase, target) {
  return target.toLowerCase().includes("vibe") && hasRescueHomophoneSignal(phrase, target);
}

function rescueSimilarity(left, right) {
  if (!left || !right) return 0;
  if (left === right) return 1;
  const distance = levenshteinDistance(left, right);
  return 1 - distance / Math.max(left.length, right.length);
}

function levenshteinDistance(left, right) {
  const previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  const current = Array(right.length + 1).fill(0);

  for (let i = 1; i <= left.length; i += 1) {
    current[0] = i;
    for (let j = 1; j <= right.length; j += 1) {
      const cost = left[i - 1] === right[j - 1] ? 0 : 1;
      current[j] = Math.min(
        current[j - 1] + 1,
        previous[j] + 1,
        previous[j - 1] + cost
      );
    }
    previous.splice(0, previous.length, ...current);
  }

  return previous[right.length];
}

function selectNonOverlappingRescues(matches, limit) {
  const selected = [];
  const sorted = [...matches].sort((a, b) => b.score - a.score || b.original.length - a.original.length);

  sorted.forEach((match) => {
    if (selected.length >= limit) return;
    const overlaps = selected.some((item) => match.start < item.end && item.start < match.end);
    if (!overlaps) selected.push(match);
  });

  return selected.sort((a, b) => a.start - b.start);
}

function applyTermRescueMatches(text, matches) {
  if (!matches.length) return text;

  let cursor = 0;
  let output = "";
  matches.forEach((match) => {
    output += text.slice(cursor, match.start);
    output += match.term;
    cursor = match.end;
  });
  output += text.slice(cursor);
  return output;
}

function buildTermRescueCandidate(match, sourceText) {
  const term = {
    term: match.entry.term,
    meaning: match.entry.meaning,
    contexts: match.entry.contexts,
    ambiguity: match.entry.ambiguity,
    evidence: match.entry.evidence || [],
  };
  const domain = selectTermDomain(term, sourceText);
  const confidence = Math.max(42, Math.min(64, Math.round(match.score * 72)));

  return {
    id: `${match.entry.term}-rescue-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    term: match.entry.term,
    meaning: match.entry.meaning,
    context: getDomainContext(term, domain.key),
    ambiguity: `ASR 可能把「${match.original}」听成了接近音。置信度还不够自动改原文，建议结合聊天确认。`,
    confidence,
    evidence: match.evidenceHits.length ? match.evidenceHits : [`疑似误识别：${match.original}`],
    sourceText,
    domain: domain.label,
    domainKey: domain.key,
    contextOptions: getContextOptions(term, domain.key),
    hasContextAmbiguity: true,
    createdAt: Date.now(),
    source: "rescue",
    isCandidate: true,
    enrichmentStatus: "hinted",
  };
}

function shouldUseStartupBias(text) {
  if (/\bstartup\b|start[-\s]?up/i.test(text)) return false;
  return /(?:我现在的这个|我们现在的这个|我这个|我们这个|我的这个|我们的这个|做的这个|这个|那个)step(?=(?:有|是|很|问题|融资|产品|市场|客户|团队|公司))/i.test(text);
}

function shouldUseVibeCodingBias(text) {
  if (/\bvibe[-\s]?coding\b|\bvibecoding\b/i.test(text)) return false;
  if (!new RegExp(VIBE_CODING_MISHEAR_PATTERN_SOURCE, "i").test(text)) return false;

  const context = getRecentContextText(text);
  const hasAiCodingContext =
    /\b(?:AI|GPT|LLM|Claude|Cursor|Copilot|Codex|agent|prompt|prototype|MVP|codegen|IDE)\b/i.test(context) ||
    /大模型|模型|代码助手|编程助手|原型|智能体|自动生成|协作写代码|自然语言.*写代码|用.*写代码/i.test(context);
  const hasExplicitWebDevContext =
    /\b(?:HTML|CSS|JavaScript|TypeScript|React|Vue|Angular|Svelte|frontend|front-end|website|web app|webpage|browser|DOM)\b/i.test(
      context
    ) || /网页|前端|网站|浏览器|页面开发|Web开发|web开发/i.test(context);
  const hasExplicitCoatingContext =
    /\b(?:paint|surface|film|polymer|chemical|material|manufacturing|spray|powder)\b/i.test(context) ||
    /涂层|镀膜|喷涂|材料|化学|表面|防水|粉末|制造/i.test(context);

  return !hasExplicitCoatingContext && (hasAiCodingContext || !hasExplicitWebDevContext);
}

function tokenizeContext(text) {
  return text.toLowerCase();
}

function confidenceLabel(score) {
  if (score >= 84) return "高";
  if (score >= 68) return "中";
  return "待确认";
}

function getDomainLabel(domainKey) {
  return DOMAIN_LABELS[domainKey] || DOMAIN_LABELS[DEFAULT_DOMAIN];
}

function keywordAppears(text, keyword) {
  const normalizedText = text.toLowerCase();
  const normalizedKeyword = keyword.toLowerCase();
  if (/^[a-z0-9+./#\s-]+$/i.test(keyword)) {
    return new RegExp(`(^|[^a-z0-9])${escapeRegExp(normalizedKeyword)}([^a-z0-9]|$)`, "i").test(normalizedText);
  }
  return normalizedText.includes(normalizedKeyword);
}

function getRecentContextText(text) {
  const recent = state.contextHistory
    .slice(-18)
    .map((item) => item.text)
    .join(" ");
  return cleanText(`${recent} ${text}`);
}

function inferDomain(text, term = null) {
  const contextText = getRecentContextText(text);
  const scores = {
    startup: 8,
    career: 0,
    finance: 0,
    product: 0,
    engineering: 0,
  };

  Object.entries(DOMAIN_KEYWORDS).forEach(([domain, entries]) => {
    entries.forEach(([keyword, weight]) => {
      if (keywordAppears(contextText, keyword)) scores[domain] += weight;
    });
  });

  Object.keys(term?.contexts || {}).forEach((domain) => {
    if (scores[domain] !== undefined) scores[domain] += 5;
  });

  if (state.currentDomain && scores[state.currentDomain] !== undefined) {
    scores[state.currentDomain] += 2;
  }

  const [key] = Object.entries(scores).sort((a, b) => b[1] - a[1])[0] || [DEFAULT_DOMAIN, 0];
  return {
    key,
    label: getDomainLabel(key),
    scores,
  };
}

function selectTermDomain(term, text) {
  const inferred = inferDomain(text, term);
  const available = Object.keys(term?.contexts || {});
  if (!available.length || available.includes(inferred.key)) return inferred;

  const [fallbackKey] = available.sort((a, b) => (inferred.scores[b] || 0) - (inferred.scores[a] || 0));
  return {
    ...inferred,
    key: fallbackKey,
    label: getDomainLabel(fallbackKey),
  };
}

function getDomainContext(term, domainKey = DEFAULT_DOMAIN) {
  return term.contexts[domainKey] || Object.values(term.contexts)[0] || "根据当前上下文给出通用解释。";
}

function getContextOptions(term, selectedDomainKey) {
  return Object.entries(term?.contexts || {}).map(([key, text]) => ({
    key,
    label: getDomainLabel(key),
    text,
    selected: key === selectedDomainKey,
  }));
}

function hasContextAmbiguity(term) {
  return Boolean(term?.ambiguity);
}

function scoreTerm(term, text, domainKey = DEFAULT_DOMAIN) {
  const lower = tokenizeContext(text);
  const evidenceHits = term.evidence.filter((word) => lower.includes(word.toLowerCase()));
  let score = 58 + Math.min(evidenceHits.length * 9, 27);

  if (term.contexts[domainKey]) score += 8;
  if (term.ambiguity) score -= evidenceHits.length ? 2 : 12;
  if (text.length < 16) score -= 8;

  return {
    score: Math.max(38, Math.min(96, score)),
    evidenceHits,
  };
}

function findTerms(text) {
  const clean = cleanText(text);
  if (!clean) return [];

  const knownMatches = TERMS.flatMap((term) => {
    if (!term.pattern.test(clean)) return [];
    term.pattern.lastIndex = 0;
    const domain = selectTermDomain(term, clean);
    const { score, evidenceHits } = scoreTerm(term, clean, domain.key);
    return [
      {
        id: `${term.term}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        term: term.term,
        meaning: term.meaning,
        context: getDomainContext(term, domain.key),
        ambiguity: term.ambiguity || "",
        confidence: score,
        evidence: evidenceHits,
        sourceText: clean,
        domain: domain.label,
        domainKey: domain.key,
        contextOptions: getContextOptions(term, domain.key),
        hasContextAmbiguity: hasContextAmbiguity(term),
        createdAt: Date.now(),
      },
    ];
  });

  const personalMatches = findPersonalMatches(clean, knownMatches);
  const baseMatches = [...knownMatches, ...personalMatches];
  const fallbackPhraseCandidates = findFallbackPhraseCandidates(clean, baseMatches);
  const emergingCandidates = findEmergingTermCandidates(clean, [...baseMatches, ...fallbackPhraseCandidates]);
  const candidateBase = [...baseMatches, ...fallbackPhraseCandidates, ...emergingCandidates];

  return [
    ...candidateBase,
    ...findUnknownAcronyms(clean, candidateBase),
  ];
}

function findPersonalMatches(text, knownMatches) {
  const alreadyMatched = new Set(knownMatches.map((match) => match.term.toUpperCase()));
  return Object.values(state.personalGlossary)
    .filter((entry) => entry?.term && entry?.meaning)
    .filter((entry) => !alreadyMatched.has(entry.term.toUpperCase()))
    .filter((entry) => termAppearsInText(entry.term, text))
    .map((entry) => cueFromPersonalGlossary(entry, text));
}

function termAppearsInText(term, text) {
  const escaped = term.trim().split(/\s+/).map(escapeRegExp).join("[-\\s]+");
  return new RegExp(`(^|[^A-Za-z0-9])${escaped}($|[^A-Za-z0-9])`, "i").test(text);
}

function findFallbackPhraseCandidates(text, existingMatches) {
  const matchedTerms = new Set(existingMatches.map((match) => match.term.toUpperCase()));

  return FALLBACK_KNOWLEDGE.filter((item) => item.term.includes(" ") || item.aliases.some((alias) => alias.includes(" ")))
    .filter((item) => !matchedTerms.has(item.term.toUpperCase()))
    .filter((item) => knowledgeItemAppears(item, text))
    .map((item) => buildFallbackCandidate(item.term, text));
}

function knowledgeItemAppears(item, text) {
  return [item.term, ...item.aliases].some((alias) => termAppearsInText(alias, text));
}

function buildFallbackCandidate(term, text) {
  const domain = inferDomain(text);
  return {
    id: `${term}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    term,
    meaning: "未收录短语候选，正在异步补全解释。",
    context: "先标记出来，不阻塞实时对话；补全完成后会更新这张卡。",
    ambiguity: "补全前不做确定解释。",
    confidence: 36,
    evidence: [],
    sourceText: text,
    domain: domain.label,
    domainKey: domain.key,
    contextOptions: [],
    createdAt: Date.now(),
    isCandidate: true,
    enrichmentStatus: state.fallbackEnabled ? "queued" : "off",
  };
}

function findEmergingTermCandidates(text, existingMatches) {
  const matchedTerms = new Set(existingMatches.map((match) => match.term.toUpperCase()));
  const matches = text.match(/\b(?:[A-Z]{2,}[a-z][A-Za-z0-9]{1,}|[A-Z][a-z]+[A-Z][A-Za-z0-9]+|[A-Za-z]+Ops)\b/g) || [];
  const unique = Array.from(new Set(matches));

  return unique
    .filter((term) => !matchedTerms.has(term.toUpperCase()))
    .filter((term) => !ACRONYM_SKIPLIST.has(term.toUpperCase()))
    .map((term) => buildFallbackCandidate(term, text));
}

function findUnknownAcronyms(text, knownMatches) {
  const knownNames = new Set(TERMS.map((term) => term.term.toUpperCase()));
  knownMatches.forEach((match) => knownNames.add(match.term.toUpperCase()));

  const rawMatches = text.match(/\b[A-Z][A-Z0-9]{1,7}\b/g) || [];
  const unique = Array.from(new Set(rawMatches.map((value) => value.toUpperCase())));

  return unique
    .filter((term) => !knownNames.has(term))
    .filter((term) => !ACRONYM_SKIPLIST.has(term))
    .map((term) => {
      const quarterCue = buildQuarterCue(term, text);
      if (quarterCue) return quarterCue;

      const hint = ACRONYM_HINTS[term];
      const hasHint = Boolean(hint);
      const domain = inferDomain(text);
      return {
        id: `${term}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        term,
        meaning: hint?.meaning || "未收录缩写候选，可能是内部简称、岗位名、指标，或语音识别误差。",
        context:
          hint?.context ||
          `当前词库还没有 ${term} 的确定解释。先把它标出来，避免你在聊天里错过可能重要的缩写。`,
        ambiguity:
          hint?.ambiguity ||
          "低置信候选。适合追问一句：这里这个缩写具体指什么？",
        confidence: hint?.confidence || 34,
        evidence: [],
        sourceText: text,
        domain: domain.label,
        domainKey: domain.key,
        contextOptions: [],
        createdAt: Date.now(),
        source: hasHint ? "hint" : undefined,
        isCandidate: true,
        enrichmentStatus: hasHint ? "hinted" : state.fallbackEnabled ? "queued" : "off",
      };
    });
}

function buildQuarterCue(term, text) {
  if (!/^Q[1-4]$/.test(term)) return null;

  const quarter = term.slice(1);
  const domain = inferDomain(text);
  return {
    id: `${term}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    term,
    meaning: `${term} 指第 ${quarter} 季度。`,
    context: "商业、产品和财务聊天里常用于描述年度里的季度目标、计划或结果。",
    ambiguity: "通常较明确；如果对方在讲版本号或项目代号，再结合上下文确认。",
    confidence: 78,
    evidence: [],
    sourceText: text,
    domain: domain.label,
    domainKey: domain.key,
    contextOptions: [
      {
        key: domain.key,
        label: domain.label,
        text: "商业、产品和财务聊天里常用于描述年度里的季度目标、计划或结果。",
        selected: true,
      },
    ],
    createdAt: Date.now(),
    source: "hint",
    isCandidate: true,
    enrichmentStatus: "hinted",
  };
}

function shouldMergeCue(existing, incoming) {
  return existing.term === incoming.term && Date.now() - existing.createdAt < 1000 * 60 * 6;
}

function normalizeCueTerm(term) {
  return String(term || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function isNestedCue(parent, child) {
  const parentTerm = normalizeCueTerm(parent.term);
  const childTerm = normalizeCueTerm(child.term);
  if (!parentTerm || !childTerm || parentTerm === childTerm) return false;
  if (parentTerm.length <= childTerm.length) return false;
  return new RegExp(`(^|\\s)${escapeRegExp(childTerm)}(\\s|$)`, "i").test(parentTerm);
}

function shouldSuppressNestedCue(candidate, candidates) {
  if (candidate.source === "personal" || candidate.source === "rescue") return false;

  const sourceText = cleanText(candidate.sourceText || "");
  return candidates.some((other) => {
    if (other === candidate) return false;
    if (other.source === "personal") return false;
    if (cleanText(other.sourceText || "") !== sourceText) return false;
    if (!isNestedCue(other, candidate)) return false;
    return other.confidence >= candidate.confidence - 12;
  });
}

function suppressNestedCues(candidates) {
  return candidates.filter((candidate) => !shouldSuppressNestedCue(candidate, candidates));
}

function cueSourceWeight(cue) {
  if (cue.source === "personal") return 44;
  if (!cue.isCandidate && !cue.source) return 30;
  if (cue.source === "rescue") return 26;
  if (cue.source === "ai-fallback") return 22;
  if (cue.source === "hint") return 10;
  return cue.isCandidate ? -10 : 0;
}

function cueSpecificityWeight(cue) {
  const normalized = normalizeCueTerm(cue.term);
  const wordCount = normalized ? normalized.split(/\s+/).length : 0;
  return Math.min(normalized.length, 34) * 0.45 + (wordCount > 1 ? 4 : 0);
}

function cueDisplayScore(cue) {
  let score = cue.confidence + cueSourceWeight(cue) + cueSpecificityWeight(cue);
  if (cue.hasContextAmbiguity) score += 3;
  if (cue.enrichmentStatus === "uncertain") score -= 18;
  if (cue.enrichmentStatus === "loading" || cue.enrichmentStatus === "queued") score -= 6;
  return score;
}

function sortCuesForDisplay(cues) {
  return [...cues].sort((a, b) => {
    const timeGap = b.createdAt - a.createdAt;
    if (Math.abs(timeGap) > CUE_RECENCY_WINDOW_MS) return timeGap;
    return cueDisplayScore(b) - cueDisplayScore(a) || timeGap;
  });
}

function isManualSelectionLocked() {
  if (Date.now() > state.manualSelectionLockedUntil) return false;
  return getDisplayCues().some((cue) => cue.id === state.selectedCueId);
}

function shouldAutoSelectCue(candidate) {
  if (!candidate) return false;
  if (!state.selectedCueId) return true;
  const selectedVisible = getDisplayCues().some((cue) => cue.id === state.selectedCueId);
  if (!selectedVisible) return true;
  return !isManualSelectionLocked();
}

function selectCue(cue, manual = false) {
  state.selectedCueId = cue?.id || null;
  if (manual) {
    state.manualSelectionLockedUntil = Date.now() + MANUAL_SELECTION_LOCK_MS;
  }
  renderCues();
  renderDetail(cue || getSelectedCue());
  updateMetrics();
}

function addCues(candidates) {
  const filteredCandidates = suppressNestedCues(candidates.filter((candidate) => !isCueTermSuppressed(candidate)));
  if (!filteredCandidates.length) return;
  const needsEnrichment = [];
  const touchedIds = [];

  filteredCandidates.forEach((candidate) => {
    const duplicate = state.cues.find((cue) => shouldMergeCue(cue, candidate));
    if (duplicate) {
      touchedIds.push(duplicate.id);
      duplicate.confidence = Math.max(duplicate.confidence, candidate.confidence);
      if (duplicate.enrichmentStatus !== "done" || candidate.source === "personal") {
        duplicate.meaning = candidate.meaning;
        duplicate.context = candidate.context;
        duplicate.ambiguity = candidate.ambiguity;
      }
      duplicate.domain = candidate.domain;
      duplicate.domainKey = candidate.domainKey;
      duplicate.contextOptions = candidate.contextOptions || [];
      duplicate.hasContextAmbiguity = candidate.hasContextAmbiguity;
      duplicate.evidence = Array.from(new Set([...duplicate.evidence, ...candidate.evidence]));
      duplicate.sourceText = candidate.sourceText;
      duplicate.createdAt = candidate.createdAt;
      if (candidate.enrichmentStatus && duplicate.enrichmentStatus !== "done") {
        duplicate.enrichmentStatus = candidate.enrichmentStatus;
      }
      if (candidate.isCandidate) needsEnrichment.push(duplicate);
    } else {
      state.cues.unshift(candidate);
      touchedIds.push(candidate.id);
      if (candidate.isCandidate) needsEnrichment.push(candidate);
    }
  });

  state.cues = sortCuesForDisplay(state.cues).slice(0, 18);
  const selectable = sortCuesForDisplay(
    state.cues.filter((cue) => touchedIds.includes(cue.id)).filter((cue) => !state.focusMode || isHighSignalCue(cue))
  );
  if (shouldAutoSelectCue(selectable[0])) state.selectedCueId = selectable[0].id;
  renderCues();
  renderDetail(getSelectedCue());
  updateMetrics();
  needsEnrichment.forEach(scheduleFallbackEnrichment);
}

function clearEnrichmentTimers() {
  state.enrichmentTimers.forEach((timer) => clearTimeout(timer));
  state.enrichmentTimers.clear();
}

function rebuildCuesFromTranscript() {
  clearEnrichmentTimers();
  state.cues = [];
  state.selectedCueId = null;
  state.lastProcessedText = "";
  state.lastProcessAt = 0;

  state.transcript
    .filter((item) => item.kind === "speech")
    .forEach((item) => {
      processText(item.text, { force: true });
    });

  renderCues();
  renderDetail(getSelectedCue());
  updateMetrics();
}

function scheduleFallbackEnrichment(cue) {
  if (!state.fallbackEnabled || !cue?.isCandidate) return;
  if (cue.enrichmentStatus === "loading" || cue.enrichmentStatus === "done" || cue.enrichmentStatus === "hinted") return;
  if (state.enrichmentTimers.has(cue.id)) return;

  cue.enrichmentStatus = "loading";
  renderCues();
  if (cue.id === state.selectedCueId) renderDetail(cue);

  const timer = setTimeout(() => {
    state.enrichmentTimers.delete(cue.id);
    enrichCue(cue.id);
  }, 850 + Math.round(Math.random() * 550));

  state.enrichmentTimers.set(cue.id, timer);
}

function enrichCue(cueId) {
  const cue = state.cues.find((item) => item.id === cueId);
  if (!cue) return;

  const suggestion = generateFallbackExplanation(cue);

  if (suggestion) {
    cue.meaning = suggestion.meaning;
    cue.context = suggestion.context;
    cue.ambiguity = suggestion.ambiguity;
    cue.confidence = Math.max(cue.confidence, suggestion.confidence);
    cue.evidence = suggestion.evidence;
    cue.source = "ai-fallback";
    cue.isCandidate = false;
    cue.enrichmentStatus = "done";
  } else {
    cue.meaning = `${cue.term} 暂时没有足够可靠的解释。`;
    cue.context = "这个词可能是内部简称、新词、名字或语音识别误差。应用先保留候选，避免你错过它。";
    cue.ambiguity = "建议直接追问：这个缩写/短语具体展开是什么？";
    cue.confidence = Math.min(cue.confidence, 34);
    cue.evidence = [];
    cue.enrichmentStatus = "uncertain";
  }

  renderCues();
  if (cue.id === state.selectedCueId) renderDetail(cue);
  updateMetrics();
}

function generateFallbackExplanation(cue) {
  const item = findFallbackKnowledge(cue.term, cue.sourceText);
  if (!item) return null;

  const lower = tokenizeContext(cue.sourceText);
  const evidence = item.evidence.filter((word) => lower.includes(word.toLowerCase()));
  const score = Math.min(90, item.confidence + Math.min(evidence.length * 4, 12));

  return {
    meaning: item.meaning,
    context: item.context,
    ambiguity: item.ambiguity,
    confidence: score,
    evidence: evidence.length ? evidence : ["fallback 知识库"],
  };
}

function findFallbackKnowledge(term, text) {
  const normalized = normalizeTermKey(term);
  return FALLBACK_KNOWLEDGE.find((item) => {
    if (normalizeTermKey(item.term) === normalized) return true;
    return item.aliases.some((alias) => normalizeTermKey(alias) === normalized);
  });
}

function normalizeTermKey(term) {
  return term.toLowerCase().replace(/[-_\s.]/g, "");
}

function cueTermKey(term) {
  return normalizeTermKey(String(term || ""));
}

function isCueTermSuppressed(cue) {
  if (!cue || cue.source === "personal") return false;
  const key = cueTermKey(cue.term);
  if (!key) return false;
  return state.sessionHiddenTerms.has(key) || Boolean(state.suppressedCueTerms[key]);
}

function hideCueForSession(cue) {
  const key = cueTermKey(cue?.term);
  if (!key) return;
  state.sessionHiddenTerms.add(key);
  removeCuesByKey(key);
}

function suppressCueTermForFuture(cue) {
  const key = cueTermKey(cue?.term);
  if (!key) return;
  const existing = state.suppressedCueTerms[key] || {};
  state.suppressedCueTerms[key] = {
    term: cue.term,
    count: (existing.count || 0) + 1,
    lastSuppressedAt: new Date().toISOString(),
  };
  saveSuppressedCueTerms();
  removeCuesByKey(key);
}

function removeCuesByKey(key) {
  state.cues = state.cues.filter((cue) => cueTermKey(cue.term) !== key);
  if (state.selectedCueId && !state.cues.some((cue) => cue.id === state.selectedCueId)) {
    state.selectedCueId = null;
    state.manualSelectionLockedUntil = 0;
  }
  renderCues();
  renderDetail(getSelectedCue());
  updateMetrics();
}

function processText(text, options = {}) {
  const started = performance.now();
  const clean = cleanText(text);
  if (!clean) return;

  const elapsedSinceLast = performance.now() - state.lastProcessAt;
  if (!options.force && elapsedSinceLast < 320 && clean === state.lastProcessedText) return;

  state.lastProcessAt = performance.now();
  state.lastProcessedText = clean;
  state.currentDomain = inferDomain(clean).key;

  const candidates = findTerms(clean);
  const latency = Math.round(performance.now() - started + Math.min(elapsedSinceLast, 350));
  els.latencyReadout.textContent = `${latency} ms`;
  els.speedMetric.textContent = `${Math.min(Math.max(latency, 80), 450)} ms`;
  addCues(candidates);
}

function highlightTerms(text) {
  const cacheKey = getHighlightCacheKey(text);
  const cached = state.highlightCache.get(cacheKey);
  if (cached) return cached;

  let highlighted = escapeHTML(text);
  const knownTerms = TERMS.filter((term) => {
    term.pattern.lastIndex = 0;
    return term.pattern.test(text);
  }).map((term) => term.term);
  const fallbackTerms = FALLBACK_KNOWLEDGE.flatMap((item) => [item.term, ...item.aliases]).filter((term) =>
    termAppearsInText(term, text)
  );
  const personalTerms = Object.values(state.personalGlossary)
    .map((entry) => entry.term)
    .filter((term) => termAppearsInText(term, text));
  const acronymTerms = text.match(/\b[A-Z][A-Z0-9]{1,7}\b/g) || [];
  const emergingTerms =
    text.match(/\b(?:[A-Z]{2,}[a-z][A-Za-z0-9]{1,}|[A-Z][a-z]+[A-Z][A-Za-z0-9]+|[A-Za-z]+Ops)\b/g) || [];
  const foundTerms = Array.from(
    new Set([...knownTerms, ...fallbackTerms, ...personalTerms, ...acronymTerms, ...emergingTerms])
  ).sort((a, b) => b.length - a.length);

  foundTerms.forEach((term) => {
    const re = new RegExp(`\\b(${escapeRegExp(escapeHTML(term))})\\b`, "gi");
    highlighted = highlighted.replace(re, '<span class="term-highlight">$1</span>');
  });
  TERMS.forEach((term) => {
    term.pattern.lastIndex = 0;
  });
  rememberHighlightCache(cacheKey, highlighted);
  return highlighted;
}

function addTranscriptLine(text, isInterim = false) {
  const clean = cleanText(text);
  if (!clean) return;
  const corrected = applyTranscriptCorrections(clean);

  if (isInterim) {
    state.interimText = corrected.text;
    state.interimCorrection = corrected;
  } else {
    const draftText = state.interimText && state.asrEngine === "local" ? state.interimText : "";
    state.interimText = "";
    state.interimCorrection = null;
    const item = {
      id: makeLineId(),
      time: nowLabel(),
      text: corrected.text,
      rawText: corrected.originalText,
      draftText: draftText && draftText !== corrected.text ? draftText : "",
      corrections: corrected.corrections,
      kind: "speech",
    };
    state.transcript.push(item);
    addContextHistoryLine(item);
    state.transcript = state.transcript.slice(-UI_TRANSCRIPT_LIMIT);
  }

  renderTranscript();
  processText(corrected.text, { force: !isInterim });
  if (!isInterim && corrected.rescueCandidates?.length) {
    addCues(corrected.rescueCandidates);
  }
}

function updateDraftLine(text) {
  const clean = cleanText(text);
  if (!clean) return;
  const corrected = applyTranscriptCorrections(clean);
  state.interimText = corrected.text;
  state.interimCorrection = corrected;
  renderTranscript();
}

function addSystemNotice(text, detail = "") {
  const clean = cleanText(detail ? `${text} ${detail}` : text);
  const now = Date.now();
  if (state.lastSystemNotice === clean && now - state.lastSystemNoticeAt < 6000) return;

  state.lastSystemNotice = clean;
  state.lastSystemNoticeAt = now;
  state.systemNoticeText = clean;
  renderSystemNotice();

  if (state.systemNoticeTimer) clearTimeout(state.systemNoticeTimer);
  state.systemNoticeTimer = setTimeout(() => {
    state.systemNoticeTimer = null;
    if (Date.now() - state.lastSystemNoticeAt >= SYSTEM_NOTICE_CLEAR_MS - 120) {
      clearSystemNotice();
    }
  }, SYSTEM_NOTICE_CLEAR_MS);
}

function renderTranscript() {
  els.transcriptFeed.textContent = "";

  if (!state.transcript.length && !state.interimText) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = SpeechRecognition
      ? "麦克风启动后，对话会出现在这里。"
      : "当前浏览器不支持 Web Speech API，可以使用样例或手动输入。";
    els.transcriptFeed.append(empty);
    return;
  }

  state.transcript.forEach((item) => {
    const node = els.transcriptTemplate.content.firstElementChild.cloneNode(true);
    if (item.kind === "system") node.classList.add("system");
    node.querySelector(".time-badge").textContent = item.time;
    node.querySelector("p").innerHTML =
      item.kind === "system" ? escapeHTML(item.text) : highlightTerms(item.text);
    appendDraftNote(node, item);
    appendCorrectionNote(node, item);
    els.transcriptFeed.append(node);
  });

  if (state.interimText) {
    const node = els.transcriptTemplate.content.firstElementChild.cloneNode(true);
    node.classList.add("interim");
    node.querySelector(".time-badge").textContent =
      state.asrEngine === "local" ? "草稿" : "实时";
    node.querySelector("p").innerHTML = highlightTerms(state.interimText);
    appendCorrectionNote(node, state.interimCorrection);
    els.transcriptFeed.append(node);
  }

  els.transcriptFeed.scrollTop = els.transcriptFeed.scrollHeight;
}

function appendDraftNote(node, item) {
  if (!item?.draftText) return;

  const note = document.createElement("div");
  note.className = "draft-note";
  note.textContent = `草稿收束：${item.draftText}`;
  node.append(note);
}

function appendCorrectionNote(node, item) {
  if (!item?.corrections?.length) return;

  const note = document.createElement("div");
  note.className = "correction-note";
  const original = item.rawText || item.originalText;
  const copy = original
    ? `已纠正：${item.corrections.join("；")} · 原始识别：${original}`
    : `已纠正：${item.corrections.join("；")}`;
  const copyNode = document.createElement("span");
  copyNode.textContent = copy;
  note.append(copyNode);

  if (item.kind === "speech" && original) {
    const actions = document.createElement("span");
    actions.className = "correction-actions";

    const rememberButton = document.createElement("button");
    rememberButton.type = "button";
    rememberButton.textContent = item.correctionSaved ? "已记住" : "记住";
    rememberButton.disabled = Boolean(item.correctionSaved);
    rememberButton.addEventListener("click", (event) => {
      event.stopPropagation();
      rememberTranscriptCorrection(item);
    });

    const undoButton = document.createElement("button");
    undoButton.type = "button";
    undoButton.textContent = "撤销";
    undoButton.addEventListener("click", (event) => {
      event.stopPropagation();
      rejectTranscriptCorrection(item);
    });

    actions.append(rememberButton, undoButton);
    note.append(actions);
  }

  node.append(note);
}

function renderCues() {
  els.cueList.textContent = "";
  const visibleCues = getDisplayCues();
  const hiddenCount = state.cues.length - visibleCues.length;
  els.cueCount.textContent = state.focusMode && hiddenCount > 0 ? `${visibleCues.length}/${state.cues.length}` : state.cues.length;

  if (!visibleCues.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent =
      state.cues.length && state.focusMode
        ? "低打扰模式已隐藏低置信候选。"
        : "识别到 GTM、ARR、PMM、alignment 等词时，会自动沉到这里。";
    els.cueList.append(empty);
    return;
  }

  visibleCues.forEach((cue) => {
    const node = els.cueTemplate.content.firstElementChild.cloneNode(true);
    node.dataset.id = cue.id;
    node.classList.toggle("selected", cue.id === state.selectedCueId);
    node.classList.toggle("enriching", cue.enrichmentStatus === "queued" || cue.enrichmentStatus === "loading");
    node.classList.toggle("enriched", cue.source === "ai-fallback");
    node.querySelector(".cue-term").textContent = cue.term;
    node.querySelector(".cue-meaning").textContent = cue.meaning;
    node.querySelector(".cue-meta").textContent = `${sourceLabel(cue)} · ${confidenceLabel(cue.confidence)} · ${cue.confidence}% · 当前：${cue.domain || "自动语境"}${cue.hasContextAmbiguity ? " · 有歧义" : ""}`;
    node.addEventListener("click", () => {
      selectCue(cue, true);
    });
    els.cueList.append(node);
  });

  if (state.focusMode && hiddenCount > 0) {
    const summary = document.createElement("div");
    summary.className = "quiet-summary";
    summary.textContent = `低打扰模式隐藏了 ${hiddenCount} 个低置信候选。关闭“低打扰”可查看全部。`;
    els.cueList.append(summary);
  }
}

function sourceLabel(cue) {
  if (cue.source === "personal") return "个人词库";
  if (cue.source === "ai-fallback") return "术语补全";
  if (cue.source === "rescue") return "术语救援";
  if (cue.source === "hint") return "候选";
  if (cue.enrichmentStatus === "loading") return "补全中";
  if (cue.enrichmentStatus === "queued") return "待补全";
  if (cue.enrichmentStatus === "uncertain") return "需确认";
  return cue.isCandidate ? "候选" : "词库";
}

function getDisplayCues() {
  if (!state.focusMode) return sortCuesForDisplay(state.cues);
  return sortCuesForDisplay(state.cues.filter(isHighSignalCue));
}

function isHighSignalCue(cue) {
  if (!cue) return false;
  if (cue.source === "personal") return true;
  if (!cue.source && !cue.isCandidate) return cue.confidence >= 56 || cue.hasContextAmbiguity;
  if (cue.source === "ai-fallback") return cue.confidence >= 66;
  if (cue.source === "rescue") return cue.confidence >= 62;
  if (cue.enrichmentStatus === "loading") return false;
  if (cue.isCandidate && cue.confidence < 58) return false;
  return cue.confidence >= 62 || cue.hasContextAmbiguity;
}

function getSelectedCue() {
  const visibleCues = getDisplayCues();
  return visibleCues.find((cue) => cue.id === state.selectedCueId) || visibleCues[0] || null;
}

function renderContextOptions(cue) {
  const options = cue.contextOptions || [];
  if (options.length < 2 && !cue.hasContextAmbiguity) return "";

  return `
    <div class="detail-row context-options">
      <span>${cue.hasContextAmbiguity ? "不同场景含义" : "不同场景参考"}</span>
      <div class="context-option-list">
        ${options
          .map(
            (option) => `
              <div class="context-option ${option.selected ? "selected" : ""}">
                <strong>${option.selected ? "当前最可能 · " : ""}${escapeHTML(option.label)}</strong>
                <p>${escapeHTML(option.text)}</p>
              </div>
            `
          )
          .join("")}
      </div>
    </div>
  `;
}

function renderDetail(cue) {
  if (!cue) {
    els.detailCard.innerHTML = `
      <p class="empty-title">等待术语出现</p>
      <p class="empty-copy">实时识别到缩写或短语后，这里会自动判断当前语境，并在有歧义时列出其它场景里的含义。</p>
    `;
    return;
  }

  const evidenceText = cue.evidence.length ? cue.evidence.join(" / ") : "暂无强证据，按当前语境给出低置信解释";
  const ambiguity = cue.ambiguity || "未发现明显歧义。";
  const enrichmentText = getEnrichmentStatusText(cue);
  const saved = isCueSaved(cue);

  els.detailCard.innerHTML = `
    <h3>${escapeHTML(cue.term)}</h3>
    <p class="meaning-line">${escapeHTML(cue.meaning)}</p>
    <div class="confidence-bar" aria-label="置信度">
      <span style="width: ${cue.confidence}%"></span>
    </div>
    <div class="detail-grid">
      <div class="detail-row">
        <span>当前最可能语境</span>
        <strong class="context-badge">${escapeHTML(cue.domain || "自动语境")}</strong>
        <p>${escapeHTML(cue.context)}</p>
      </div>
      ${renderContextOptions(cue)}
      <div class="detail-row">
        <span>上下文证据</span>
        ${escapeHTML(evidenceText)}
      </div>
      <div class="detail-row">
        <span>歧义处理</span>
        ${escapeHTML(ambiguity)}
      </div>
      <div class="detail-row">
        <span>来源</span>
        ${escapeHTML(sourceLabel(cue))}${enrichmentText ? ` · ${escapeHTML(enrichmentText)}` : ""}
      </div>
      <div class="detail-row">
        <span>原句</span>
        ${escapeHTML(cue.sourceText)}
      </div>
    </div>
    <div class="detail-actions">
      <button id="saveCueButton" class="${saved ? "saved" : ""}" type="button">
        ${saved ? "已记住" : "记住解释"}
      </button>
      <button id="hideCueButton" type="button">本轮隐藏</button>
      <button id="suppressCueButton" type="button">以后少提示</button>
    </div>
  `;

  const saveButton = els.detailCard.querySelector("#saveCueButton");
  saveButton?.addEventListener("click", () => {
    saveCueToPersonalGlossary(cue);
    renderDetail(cue);
  });

  els.detailCard.querySelector("#hideCueButton")?.addEventListener("click", () => {
    hideCueForSession(cue);
  });

  els.detailCard.querySelector("#suppressCueButton")?.addEventListener("click", () => {
    suppressCueTermForFuture(cue);
  });
}

function getEnrichmentStatusText(cue) {
  if (cue.enrichmentStatus === "loading") return "正在异步查上下文";
  if (cue.enrichmentStatus === "queued") return "等待异步补全";
  if (cue.enrichmentStatus === "done") return "已完成异步补全";
  if (cue.enrichmentStatus === "uncertain") return "仍然不确定，建议追问";
  if (cue.enrichmentStatus === "hinted") return "已有本地候选提示";
  if (cue.enrichmentStatus === "off") return "术语补全已关闭";
  return "";
}

function isCueSaved(cue) {
  return Boolean(state.personalGlossary[cue.term.toUpperCase()]);
}

function saveCueToPersonalGlossary(cue) {
  state.personalGlossary[cue.term.toUpperCase()] = {
    term: cue.term,
    meaning: cue.meaning,
    context: cue.context,
    ambiguity: cue.ambiguity,
    confidence: cue.confidence,
    savedAt: new Date().toISOString(),
  };
  savePersonalGlossary();
  state.personalGlossaryVersion += 1;
  clearHighlightCache();
  renderTranscript();
}

function updateMetrics() {
  const selected = getSelectedCue();
  const confidence = selected ? selected.confidence : 0;
  els.confidenceReadout.textContent = `${confidence}%`;
  els.accuracyMetric.textContent = selected ? confidenceLabel(confidence) : "上下文";
}

function updateMicLevel(stats = null) {
  let level = 0;

  if (stats) {
    const rmsLevel = Math.min(1, (stats.rms || 0) / 0.075);
    const peakLevel = Math.min(1, (stats.peak || 0) / 0.65);
    level = Math.max(rmsLevel, peakLevel * 0.72);
  }

  const percent = Math.max(0, Math.min(100, Math.round(level * 100)));
  state.micLevel = percent;
  if (els.micLevelBar) els.micLevelBar.style.width = `${percent}%`;
  if (els.micLevelText) {
    els.micLevelText.textContent = percent < 4 ? "输入静音" : `输入 ${percent}%`;
  }
}

function setStatus(mode) {
  els.statusDot.className = "status-dot";

  if (mode === "active") {
    els.statusDot.classList.add("active");
    els.statusText.textContent = "聆听中";
  } else if (mode === "paused") {
    els.statusDot.classList.add("paused");
    els.statusText.textContent = "已暂停";
  } else if (mode === "sample") {
    els.statusDot.classList.add("active");
    els.statusText.textContent = "样例播放";
  } else if (mode === "processing") {
    els.statusDot.classList.add("active");
    els.statusText.textContent = "识别中";
  } else if (mode === "restarting") {
    els.statusDot.classList.add("paused");
    els.statusText.textContent = "重连中";
  } else if (mode === "blocked") {
    els.statusDot.classList.add("blocked");
    els.statusText.textContent = "麦克风受限";
  } else {
    els.statusText.textContent = "待机";
  }
}

function getSpeechErrorCopy(error) {
  const copies = {
    "not-allowed": {
      title: "麦克风权限被当前浏览器拒绝。",
      detail: "可以在浏览器地址栏或站点设置里允许麦克风；如果是在内置浏览器里预览，通常只能先用样例或手动输入测试。",
    },
    "service-not-allowed": {
      title: "当前浏览器不允许使用语音识别服务。",
      detail: "请换 Chrome / Edge，或继续用样例和手动输入验证术语解释。",
    },
    "audio-capture": {
      title: "没有检测到可用麦克风。",
      detail: "请检查系统输入设备和浏览器麦克风权限。",
    },
    network: {
      title: "语音识别网络服务暂不可用。",
      detail: "术语解释仍可通过样例和手动输入测试。",
    },
  };

  return (
    copies[error] || {
      title: "语音识别暂不可用。",
      detail: `错误类型：${error || "unknown"}。可以先使用样例或手动输入。`,
    }
  );
}

function getMicrophoneStartErrorCopy(error, fallbackTitle) {
  const name = error?.name || "";
  const message = error?.message || "";

  if (name === "NotAllowedError" || /permission denied/i.test(message)) {
    return getSpeechErrorCopy("not-allowed");
  }

  if (name === "NotFoundError" || name === "DevicesNotFoundError") {
    return getSpeechErrorCopy("audio-capture");
  }

  return {
    title: fallbackTitle,
    detail: message || "请确认麦克风权限和本地 ASR 配置。",
  };
}

function syncAsrEngineUI() {
  els.engineReadout.textContent = ASR_ENGINE_LABELS[state.asrEngine] || WEB_SPEECH_LABEL;
  if (els.asrSelect.value !== state.asrEngine) {
    els.asrSelect.value = state.asrEngine;
  }
}

function getOpenAIMimeType() {
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4",
    "audio/ogg;codecs=opus",
  ];
  return candidates.find((type) => MediaRecorder.isTypeSupported(type)) || "";
}

function buildAsrPrompt() {
  const hotwords = Array.from(new Set([
    "vibe coding",
    "vibecoding",
    "AI coding agent",
    "coding agent",
    "Cursor",
    "Claude Code",
    "MCP",
    "A2A",
    "startup",
    "SaaS",
    ...TERMS.map((term) => term.term).filter((term) => term.length <= 28),
    ...FALLBACK_KNOWLEDGE.map((term) => term.term),
  ])).slice(0, 120);

  return `Coffee chat 中英混合语音。请保留英文缩写和英文术语，不要把 startup 听成 step，不要把 vibe coding 听成 web coding、web coating、web code 或 外部 coating。常见词包括：${hotwords.join(", ")}。`;
}

function getAsrProxyCandidates() {
  const candidates = [];
  const isHttp = window.location.protocol.startsWith("http");
  const isLocalHost = ["localhost", "127.0.0.1", "::1"].includes(window.location.hostname);

  if (isHttp && (!isLocalHost || window.location.port === "5174")) {
    candidates.push("");
  }

  if (!isHttp || isLocalHost) {
    candidates.push("http://localhost:5174");
  }

  if (!candidates.includes("")) candidates.push("");
  return candidates;
}

function asrApiURL(path) {
  return `${state.asrProxyBase || ""}${path}`;
}

async function fetchAsrStatus() {
  const errors = [];

  for (const base of getAsrProxyCandidates()) {
    try {
      const response = await fetch(`${base}/api/asr/status`, {
        cache: "no-store",
        mode: base ? "cors" : "same-origin",
      });
      if (!response.ok) throw new Error(`ASR status HTTP ${response.status}`);
      state.asrProxyBase = base;
      return response.json();
    } catch (error) {
      errors.push(error?.message || String(error));
    }
  }

  throw new Error(errors.join("; "));
}

async function ensureLocalAsrConfigured() {
  try {
    const status = await fetchAsrStatus();
    if (status.local?.configured) return true;
    addSystemNotice("本地 SenseVoice 还没配置。", "请安装 funasr-onnx，并用 `node server.mjs` 启动本地 ASR 服务；whisper.cpp 会作为备用。");
  } catch (error) {
    addSystemNotice("没有连接到本地 ASR 代理。", "请用 `node server.mjs` 打开 http://localhost:5174，而不是普通静态服务器。");
  }
  return false;
}

async function ensureOpenAIAsrConfigured() {
  try {
    const status = await fetchAsrStatus();
    if (status.configured) return true;
    addSystemNotice("OpenAI ASR 没有配置 API key。", "如果只想免费本地识别，请使用本地 SenseVoice；OpenAI ASR 只是可选云端模式。");
  } catch (error) {
    addSystemNotice("没有连接到 ASR 代理。", "请用 `node server.mjs` 打开 http://localhost:5174。");
  }
  return false;
}

function mergeFloat32Buffers(buffers) {
  const length = buffers.reduce((sum, buffer) => sum + buffer.length, 0);
  const merged = new Float32Array(length);
  let offset = 0;

  buffers.forEach((buffer) => {
    merged.set(buffer, offset);
    offset += buffer.length;
  });

  return merged;
}

function mixAudioBufferToMono(audioBuffer) {
  const samples = new Float32Array(audioBuffer.length);

  for (let channel = 0; channel < audioBuffer.numberOfChannels; channel += 1) {
    const data = audioBuffer.getChannelData(channel);
    for (let index = 0; index < data.length; index += 1) {
      samples[index] += data[index] / audioBuffer.numberOfChannels;
    }
  }

  return samples;
}

function getAudioStats(samples) {
  if (!samples?.length) return { rms: 0, peak: 0, durationMs: 0 };

  let sumSquares = 0;
  let peak = 0;

  for (const sample of samples) {
    const abs = Math.abs(sample);
    sumSquares += sample * sample;
    if (abs > peak) peak = abs;
  }

  return {
    durationMs: 0,
    peak,
    rms: Math.sqrt(sumSquares / samples.length),
  };
}

function shouldSkipQuietAudio(stats) {
  return stats && stats.rms < LOCAL_MIN_RMS && stats.peak < LOCAL_MIN_PEAK;
}

function hasLikelySpeech(stats) {
  if (!stats) return false;
  return stats.rms >= LOCAL_SPEECH_RMS || (stats.rms >= LOCAL_MIN_RMS && stats.peak >= LOCAL_SPEECH_PEAK);
}

function ignoreQuietLocalChunk() {
  state.localBlankChunks = 0;
  updateMicLevel();
  if (state.listening && !state.paused && state.localPendingChunks === 0) {
    setStatus("active");
  }
}

function trimQuietEdges(samples, sampleRate, stats) {
  if (!samples?.length || shouldSkipQuietAudio(stats)) return samples;

  const threshold = Math.max(0.008, Math.min(0.025, stats.peak * 0.12));
  const padding = Math.round(sampleRate * 0.25);
  let start = 0;
  let end = samples.length - 1;

  while (start < samples.length && Math.abs(samples[start]) < threshold) start += 1;
  while (end > start && Math.abs(samples[end]) < threshold) end -= 1;

  if (start === samples.length) return samples;

  const paddedStart = Math.max(0, start - padding);
  const paddedEnd = Math.min(samples.length, end + padding);
  return samples.slice(paddedStart, paddedEnd);
}

function resampleLinear(samples, sourceRate, targetRate) {
  if (!samples?.length || sourceRate === targetRate) return samples;

  const targetLength = Math.max(1, Math.round((samples.length * targetRate) / sourceRate));
  const resampled = new Float32Array(targetLength);
  const ratio = samples.length > 1 && targetLength > 1 ? (samples.length - 1) / (targetLength - 1) : 0;

  for (let index = 0; index < targetLength; index += 1) {
    const position = index * ratio;
    const before = Math.floor(position);
    const after = Math.min(samples.length - 1, before + 1);
    const fraction = position - before;
    resampled[index] = samples[before] + (samples[after] - samples[before]) * fraction;
  }

  return resampled;
}

function prepareLocalWav(samples, sampleRate) {
  const rawStats = {
    ...getAudioStats(samples),
    durationMs: Math.round((samples.length / sampleRate) * 1000),
    sourceSampleRate: sampleRate,
    targetSampleRate: LOCAL_TARGET_SAMPLE_RATE,
  };

  if (shouldSkipQuietAudio(rawStats)) return { blob: null, stats: rawStats };

  const trimmedSamples = trimQuietEdges(samples, sampleRate, rawStats);
  const resampledSamples = resampleLinear(trimmedSamples, sampleRate, LOCAL_TARGET_SAMPLE_RATE);
  const stats = {
    ...rawStats,
    trimmedDurationMs: Math.round((trimmedSamples.length / sampleRate) * 1000),
    encodedDurationMs: Math.round((resampledSamples.length / LOCAL_TARGET_SAMPLE_RATE) * 1000),
  };

  return {
    blob: new Blob([encodeWav(resampledSamples, LOCAL_TARGET_SAMPLE_RATE)], { type: "audio/wav" }),
    stats,
  };
}

async function decodeCompressedAudioToWav(blob, audioContext) {
  if (!blob || blob.size < 1200) return null;

  const encoded = await blob.arrayBuffer();
  const audioBuffer = await audioContext.decodeAudioData(encoded.slice(0));
  if (audioBuffer.length < audioBuffer.sampleRate * LOCAL_MIN_AUDIO_SECONDS) return null;

  const samples = mixAudioBufferToMono(audioBuffer);
  return prepareLocalWav(samples, audioBuffer.sampleRate);
}

function encodeWav(samples, sampleRate) {
  const bytesPerSample = 2;
  const dataSize = samples.length * bytesPerSample;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  writeAscii(view, 0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeAscii(view, 8, "WAVE");
  writeAscii(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * bytesPerSample, true);
  view.setUint16(32, bytesPerSample, true);
  view.setUint16(34, 16, true);
  writeAscii(view, 36, "data");
  view.setUint32(40, dataSize, true);

  let offset = 44;
  samples.forEach((sample) => {
    const clamped = Math.max(-1, Math.min(1, sample));
    view.setInt16(offset, clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff, true);
    offset += 2;
  });

  return buffer;
}

function writeAscii(view, offset, value) {
  for (let index = 0; index < value.length; index += 1) {
    view.setUint8(offset + index, value.charCodeAt(index));
  }
}

function isFatalSpeechError(error) {
  return ["not-allowed", "service-not-allowed", "audio-capture"].includes(error);
}

function getRecoverableSpeechMessage(error) {
  const messages = {
    "no-speech": "短时间没有检测到语音，正在自动续听。",
    aborted: "浏览器中断了本轮识别，正在自动重连。",
    network: "语音识别网络抖动，正在自动重连。",
  };

  return messages[error] || "语音识别本轮结束，正在自动续听。";
}

async function ensureMicrophoneAccess() {
  if (!navigator.mediaDevices?.getUserMedia) {
    return { ok: true };
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach((track) => track.stop());
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error?.name === "NotAllowedError" ? "not-allowed" : "audio-capture",
    };
  }
}

function createRecognition() {
  if (!SpeechRecognition) return null;

  const recognition = new SpeechRecognition();
  recognition.lang = "zh-CN";
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.maxAlternatives = 1;

  recognition.onstart = () => {
    state.recognitionActive = true;
    state.recognitionRestarting = false;
    state.restartAttempts = 0;
    state.lastRecognitionStartAt = Date.now();
    state.lastSpeechAt = Date.now();
    setStatus("active");
  };

  recognition.onresult = (event) => {
    let finalText = "";
    let interim = "";
    state.lastSpeechAt = Date.now();

    for (let i = event.resultIndex; i < event.results.length; i += 1) {
      const result = event.results[i];
      const transcript = result[0]?.transcript || "";
      if (result.isFinal) {
        finalText += transcript;
      } else {
        interim += transcript;
      }
    }

    if (interim) addTranscriptLine(interim, true);
    if (finalText) addTranscriptLine(finalText, false);
  };

  recognition.onerror = (event) => {
    state.recognitionActive = false;

    if (isFatalSpeechError(event.error)) {
      const copy = getSpeechErrorCopy(event.error);
      teardownRecognition();
      setStatus(event.error === "not-allowed" || event.error === "service-not-allowed" ? "blocked" : "idle");
      state.listening = false;
      state.micBlocked = event.error === "not-allowed" || event.error === "service-not-allowed";
      els.listenButton.querySelector("span:last-child").textContent = "开始聆听";
      els.pauseButton.disabled = true;
      addSystemNotice(copy.title, copy.detail);
      return;
    }

    addSystemNotice(getRecoverableSpeechMessage(event.error));
    scheduleRecognitionRestart(event.error);
  };

  recognition.onend = () => {
    state.recognitionActive = false;
    if (state.listening && !state.paused) {
      scheduleRecognitionRestart("end");
    }
  };

  return recognition;
}

function clearRestartTimer() {
  if (!state.restartTimer) return;
  clearTimeout(state.restartTimer);
  state.restartTimer = null;
}

function startWatchdog() {
  stopWatchdog();
  state.watchdogTimer = setInterval(() => {
    if (!state.listening || state.paused || state.sampleTimer) return;

    const idleFor = Date.now() - state.lastSpeechAt;
    if (idleFor > SILENCE_RESTART_MS) {
      scheduleRecognitionRestart("silence");
    }
  }, WATCHDOG_INTERVAL_MS);
}

function stopWatchdog() {
  if (!state.watchdogTimer) return;
  clearInterval(state.watchdogTimer);
  state.watchdogTimer = null;
}

function teardownRecognition() {
  clearRestartTimer();
  stopWatchdog();

  if (state.recognition) {
    state.recognition.onend = null;
    state.recognition.onerror = null;
    state.recognition.onresult = null;
    state.recognition.onstart = null;
    try {
      state.recognition.stop();
    } catch (error) {
      // Some browser implementations throw if stop is called after implicit end.
    }
  }

  state.recognition = null;
  state.recognitionActive = false;
  state.recognitionRestarting = false;
}

function teardownOpenAIRecognition() {
  if (state.mediaRecorder && state.mediaRecorder.state !== "inactive") {
    try {
      state.mediaRecorder.stop();
    } catch (error) {
      // MediaRecorder may already be stopped after a stream error.
    }
  }

  if (state.mediaStream) {
    state.mediaStream.getTracks().forEach((track) => track.stop());
  }

  state.mediaRecorder = null;
  state.mediaStream = null;
  state.openaiPendingChunks = 0;
}

function clearLocalDraftRestartTimer() {
  if (!state.localDraftRestartTimer) return;
  clearTimeout(state.localDraftRestartTimer);
  state.localDraftRestartTimer = null;
}

function clearLocalDraftClearTimer() {
  if (!state.localDraftClearTimer) return;
  clearTimeout(state.localDraftClearTimer);
  state.localDraftClearTimer = null;
}

function clearLocalDraftText({ render = true } = {}) {
  clearLocalDraftClearTimer();
  state.localDraftText = "";
  state.localDraftUpdatedAt = 0;
  if (state.asrEngine === "local") {
    state.interimText = "";
    state.interimCorrection = null;
    if (render) renderTranscript();
  }
}

function scheduleLocalDraftClear(delay = 3200) {
  clearLocalDraftClearTimer();
  state.localDraftClearTimer = setTimeout(() => {
    state.localDraftClearTimer = null;
    if (state.asrEngine === "local" && Date.now() - state.localDraftUpdatedAt >= delay - 120) {
      clearLocalDraftText();
    }
  }, delay);
}

function teardownLocalDraftRecognition() {
  clearLocalDraftRestartTimer();
  clearLocalDraftClearTimer();

  if (state.localDraftRecognition) {
    state.localDraftRecognition.onend = null;
    state.localDraftRecognition.onerror = null;
    state.localDraftRecognition.onresult = null;
    state.localDraftRecognition.onstart = null;
    try {
      state.localDraftRecognition.stop();
    } catch (error) {
      // Already stopped by the browser.
    }
  }

  state.localDraftRecognition = null;
  clearLocalDraftText({ render: false });
}

function closeAudioContext(context) {
  if (!context) return;

  try {
    void context.close().catch(() => {});
  } catch (error) {
    // Already closed or not closeable in this browser.
  }
}

function teardownLocalRecognition() {
  const localAudio = state.localAudio;
  teardownLocalDraftRecognition();

  if (localAudio?.cycleTimer) {
    clearTimeout(localAudio.cycleTimer);
  }

  if (localAudio?.recorder && localAudio.recorder.state !== "inactive") {
    try {
      localAudio.recorder.stop();
    } catch (error) {
      // MediaRecorder may already be stopped after the final data event.
    }
  }

  if (state.localAudio?.timer) {
    clearInterval(state.localAudio.timer);
  }

  if (state.localAudio?.processor) {
    state.localAudio.processor.disconnect();
  }

  if (state.localAudio?.source) {
    state.localAudio.source.disconnect();
  }

  if (state.localAudio?.context) {
    closeAudioContext(state.localAudio.context);
  }

  if (state.localAudio?.decodeContext) {
    closeAudioContext(state.localAudio.decodeContext);
  }

  if (state.localAudio?.stream) {
    state.localAudio.stream.getTracks().forEach((track) => track.stop());
  }

  state.localAudio = null;
  state.localPendingChunks = 0;
  state.localBlankChunks = 0;
  updateMicLevel();
}

function startRecognitionEngine() {
  if (!state.listening || state.paused) return;

  if (!state.recognition) state.recognition = createRecognition();

  try {
    state.recognition.start();
    state.lastRecognitionStartAt = Date.now();
    state.lastSpeechAt = Date.now();
  } catch (error) {
    scheduleRecognitionRestart("start-failed");
  }
}

async function startOpenAIListening() {
  stopSample();

  if (!(await ensureOpenAIAsrConfigured())) return;

  if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
    addSystemNotice("当前浏览器不支持本地录音分片。", "请使用 Chrome / Edge，或切换到浏览器 ASR。");
    return;
  }

  state.listening = true;
  state.paused = false;
  state.openaiChunkIndex = 0;
  state.openaiPendingChunks = 0;
  state.lastSpeechAt = Date.now();
  setStatus("active");
  syncAsrEngineUI();
  els.listenButton.querySelector("span:last-child").textContent = "停止聆听";
  els.pauseButton.disabled = false;

  try {
    await startOpenAIRecorder();
  } catch (error) {
    const copy = getMicrophoneStartErrorCopy(error, "OpenAI ASR 启动失败。");
    state.listening = false;
    teardownOpenAIRecognition();
    setStatus("idle");
    els.listenButton.querySelector("span:last-child").textContent = "开始聆听";
    els.pauseButton.disabled = true;
    addSystemNotice(copy.title, copy.detail);
  }
}

async function startLocalListening() {
  stopSample();

  if (!(await ensureLocalAsrConfigured())) return;

  if (!navigator.mediaDevices?.getUserMedia) {
    addSystemNotice("当前浏览器不支持本地录音。", "请使用 Chrome / Edge，或切换到浏览器 ASR。");
    return;
  }

  state.listening = true;
  state.paused = false;
  state.localChunkIndex = 0;
  state.localPendingChunks = 0;
  state.localBlankChunks = 0;
  state.lastSpeechAt = Date.now();
  setStatus("active");
  syncAsrEngineUI();
  els.listenButton.querySelector("span:last-child").textContent = "停止聆听";
  els.pauseButton.disabled = false;

  try {
    await startLocalRecorder();
    startLocalDraftRecognition();
  } catch (error) {
    const copy = getMicrophoneStartErrorCopy(error, "本地 SenseVoice 启动失败。");
    state.listening = false;
    teardownLocalRecognition();
    setStatus("idle");
    els.listenButton.querySelector("span:last-child").textContent = "开始聆听";
    els.pauseButton.disabled = true;
    addSystemNotice(copy.title, copy.detail);
  }
}

function createLocalDraftRecognition() {
  if (!SpeechRecognition) return null;

  const recognition = new SpeechRecognition();
  recognition.lang = "zh-CN";
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.maxAlternatives = 1;

  recognition.onresult = (event) => {
    const latest = event.results[event.results.length - 1];
    state.lastSpeechAt = Date.now();
    const draft = cleanText(latest?.[0]?.transcript || "");
    if (!draft) return;

    state.localDraftText = draft;
    state.localDraftUpdatedAt = Date.now();
    updateDraftLine(draft);
    scheduleLocalDraftClear();
  };

  recognition.onerror = (event) => {
    if (!state.listening || state.paused || state.asrEngine !== "local") return;
    if (isFatalSpeechError(event.error)) {
      teardownLocalDraftRecognition();
      return;
    }
    if (state.localDraftRecognition === recognition) state.localDraftRecognition = null;
    scheduleLocalDraftRestart();
  };

  recognition.onend = () => {
    if (state.localDraftRecognition === recognition) state.localDraftRecognition = null;
    if (state.listening && !state.paused && state.asrEngine === "local") {
      scheduleLocalDraftRestart();
    }
  };

  return recognition;
}

function scheduleLocalDraftRestart() {
  if (!state.listening || state.paused || state.asrEngine !== "local") return;
  if (state.localDraftRestartTimer) return;

  state.localDraftRestartTimer = setTimeout(() => {
    state.localDraftRestartTimer = null;
    startLocalDraftRecognition();
  }, RESTART_DELAY_MS);
}

function startLocalDraftRecognition() {
  if (!SpeechRecognition || !state.listening || state.paused || state.asrEngine !== "local") return;
  if (state.localDraftRecognition) return;

  const recognition = createLocalDraftRecognition();
  if (!recognition) return;
  state.localDraftRecognition = recognition;

  try {
    recognition.start();
  } catch (error) {
    state.localDraftRecognition = null;
  }
}

async function startLocalRecorder() {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    },
  });

  if (typeof MediaRecorder !== "undefined") {
    await startLocalMediaRecorder(stream);
    return;
  }

  await startLocalAudioProcessor(stream);
}

async function startLocalMediaRecorder(stream) {
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) {
    stream.getTracks().forEach((track) => track.stop());
    throw new Error("当前浏览器不能解码录音分片，请切换到浏览器 ASR。");
  }

  const mimeType = getOpenAIMimeType();
  const decodeContext = new AudioContext();
  const localAudio = {
    mode: "mediarecorder",
    chunks: [],
    cycleTimer: null,
    decodeContext,
    mimeType,
    recorder: null,
    stream,
  };

  state.localAudio = localAudio;
  startLocalMediaRecorderCycle(localAudio);
}

function startLocalMediaRecorderCycle(localAudio) {
  if (!state.listening || state.paused || state.localAudio !== localAudio) return;

  const recorder = new MediaRecorder(
    localAudio.stream,
    localAudio.mimeType ? { mimeType: localAudio.mimeType } : undefined
  );

  localAudio.chunks = [];
  localAudio.recorder = recorder;

  recorder.ondataavailable = (event) => {
    if (event.data?.size) localAudio.chunks.push(event.data);
  };

  recorder.onerror = () => {
    addSystemNotice("本地录音分片出错。", "已停止聆听，请重新开始一次。");
    stopListening();
  };

  recorder.onstop = () => {
    if (localAudio.cycleTimer) {
      clearTimeout(localAudio.cycleTimer);
      localAudio.cycleTimer = null;
    }

    const blob = new Blob(localAudio.chunks, { type: recorder.mimeType || localAudio.mimeType || "audio/webm" });
    localAudio.chunks = [];

    if (state.listening && !state.paused && state.localAudio === localAudio) {
      submitCompressedLocalChunk(blob, localAudio);
      startLocalMediaRecorderCycle(localAudio);
    }
  };

  recorder.start();
  localAudio.cycleTimer = setTimeout(() => {
    if (recorder.state !== "inactive") recorder.stop();
  }, LOCAL_CHUNK_MS);
}

async function submitCompressedLocalChunk(blob, localAudio) {
  try {
    const wav = await decodeCompressedAudioToWav(blob, localAudio.decodeContext);
    if (!wav || !state.listening || state.paused || state.localAudio !== localAudio) return;
    updateMicLevel(wav.stats);

    if (!wav.blob || shouldSkipQuietAudio(wav.stats)) {
      ignoreQuietLocalChunk();
      return;
    }

    submitLocalChunk(wav.blob, wav.stats);
  } catch (error) {
    if (state.listening && state.localAudio === localAudio) {
      addSystemNotice("本地录音分片解码失败。", "正在切换到兼容录音模式。");
      await switchLocalRecorderToAudioProcessor(localAudio);
    }
  }
}

async function switchLocalRecorderToAudioProcessor(localAudio) {
  if (state.localAudio !== localAudio) return;

  if (localAudio.cycleTimer) clearTimeout(localAudio.cycleTimer);
  if (localAudio.recorder && localAudio.recorder.state !== "inactive") {
    try {
      localAudio.recorder.onstop = null;
      localAudio.recorder.stop();
    } catch (error) {
      // Already stopped.
    }
  }
  if (localAudio.decodeContext) {
    closeAudioContext(localAudio.decodeContext);
  }

  await startLocalAudioProcessor(localAudio.stream);
}

async function startLocalAudioProcessor(stream) {
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  const context = new AudioContext();
  const source = context.createMediaStreamSource(stream);
  const processor = context.createScriptProcessor(4096, 1, 1);
  const buffers = [];

  processor.onaudioprocess = (event) => {
    if (!state.listening || state.paused) return;
    buffers.push(new Float32Array(event.inputBuffer.getChannelData(0)));
  };

  source.connect(processor);
  processor.connect(context.destination);

  const localAudio = {
    buffers,
    context,
    mode: "audioprocessor",
    processor,
    source,
    stream,
    timer: null,
  };

  localAudio.timer = setInterval(() => {
    flushLocalAudioChunk(localAudio);
  }, LOCAL_CHUNK_MS);

  state.localAudio = localAudio;

  if (context.state === "suspended") {
    await context.resume();
  }
}

function flushLocalAudioChunk(localAudio = state.localAudio) {
  if (!localAudio || !localAudio.buffers.length) return;

  const buffers = localAudio.buffers.splice(0, localAudio.buffers.length);
  const samples = mergeFloat32Buffers(buffers);
  if (samples.length < localAudio.context.sampleRate * LOCAL_MIN_AUDIO_SECONDS) return;
  const wav = prepareLocalWav(samples, localAudio.context.sampleRate);
  updateMicLevel(wav.stats);

  if (!wav.blob || shouldSkipQuietAudio(wav.stats)) {
    ignoreQuietLocalChunk();
    return;
  }

  submitLocalChunk(wav.blob, wav.stats);
}

async function submitLocalChunk(blob, stats = null) {
  const chunkId = ++state.localChunkIndex;
  const started = performance.now();
  state.localPendingChunks += 1;
  if (state.listening && !state.paused) setStatus("processing");

  try {
    const response = await fetch(asrApiURL(`/api/local-transcribe?prompt=${encodeURIComponent(buildAsrPrompt())}`), {
      method: "POST",
      mode: state.asrProxyBase ? "cors" : "same-origin",
      headers: {
        "Content-Type": "audio/wav",
        "X-Chunk-Id": String(chunkId),
      },
      body: blob,
    });

    if (!response.ok) {
      const message = await response.text();
      throw new Error(message || `HTTP ${response.status}`);
    }

    const payload = await response.json();
    const transcript = cleanText(payload.text || payload.transcript || "");
    const latency = Math.round(performance.now() - started);
    els.latencyReadout.textContent = `${latency} ms`;
    els.speedMetric.textContent = SpeechRecognition ? "草稿 <1s" : `${Math.max(latency, LOCAL_CHUNK_MS)} ms`;
    if (transcript) {
      state.localBlankChunks = 0;
      clearLocalDraftText({ render: false });
      state.lastSpeechAt = Date.now();
      addTranscriptLine(transcript, false);
    } else if (state.listening && !state.paused) {
      if (!hasLikelySpeech(stats)) {
        ignoreQuietLocalChunk();
        return;
      }
      if (state.localDraftText && Date.now() - state.localDraftUpdatedAt < LOCAL_CHUNK_MS * 2) {
        scheduleLocalDraftClear(2400);
        return;
      }
      state.localBlankChunks += 1;
      if (state.localBlankChunks <= 2) {
        const volumeCopy = stats
          ? `当前音量 RMS ${stats.rms.toFixed(3)}，峰值 ${stats.peak.toFixed(2)}。`
          : "";
        addSystemNotice("SenseVoice 收到声音，但这段没有解码成文字。", `${volumeCopy}请连续说 2-3 秒，或换到更安静的位置再试。`);
      }
    }
  } catch (error) {
    addSystemNotice("本地 SenseVoice 暂不可用。", "请确认 funasr-onnx / SenseVoiceSmall 已安装；whisper.cpp 会作为备用。");
    stopListening();
  } finally {
    state.localPendingChunks = Math.max(0, state.localPendingChunks - 1);
    if (state.listening && !state.paused && state.localPendingChunks === 0) setStatus("active");
  }
}

async function startOpenAIRecorder() {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    },
  });
  const mimeType = getOpenAIMimeType();
  const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);

  state.mediaStream = stream;
  state.mediaRecorder = recorder;

  recorder.ondataavailable = (event) => {
    if (!state.listening || state.paused || !event.data || event.data.size < 1200) return;
    submitOpenAIChunk(event.data);
  };

  recorder.onerror = () => {
    addSystemNotice("本地录音分片出错。", "正在停止 OpenAI ASR，请重新开始聆听。");
    stopListening();
  };

  recorder.onstop = () => {
    state.mediaRecorder = null;
  };

  recorder.start(OPENAI_CHUNK_MS);
}

async function submitOpenAIChunk(blob) {
  const chunkId = ++state.openaiChunkIndex;
  const started = performance.now();
  state.openaiPendingChunks += 1;

  try {
    const response = await fetch(asrApiURL(`/api/transcribe?prompt=${encodeURIComponent(buildAsrPrompt())}`), {
      method: "POST",
      mode: state.asrProxyBase ? "cors" : "same-origin",
      headers: {
        "Content-Type": blob.type || "audio/webm",
        "X-Chunk-Id": String(chunkId),
      },
      body: blob,
    });

    if (!response.ok) {
      const message = await response.text();
      throw new Error(message || `HTTP ${response.status}`);
    }

    const payload = await response.json();
    const transcript = cleanText(payload.text || payload.transcript || "");
    if (transcript) {
      state.lastSpeechAt = Date.now();
      addTranscriptLine(transcript, false);
      const latency = Math.round(performance.now() - started);
      els.latencyReadout.textContent = `${latency} ms`;
      els.speedMetric.textContent = `${Math.max(latency, OPENAI_CHUNK_MS)} ms`;
    }
  } catch (error) {
    addSystemNotice("OpenAI ASR 暂不可用。", "请确认用 `npm run dev` 启动本地代理，并设置 OPENAI_API_KEY。");
    stopListening();
  } finally {
    state.openaiPendingChunks = Math.max(0, state.openaiPendingChunks - 1);
  }
}

function scheduleRecognitionRestart(reason) {
  if (!state.listening || state.paused) return;
  if (state.restartTimer) return;

  state.restartAttempts += 1;
  state.recognitionRestarting = true;
  setStatus("restarting");

  if (state.restartAttempts > MAX_RESTART_ATTEMPTS) {
    addSystemNotice("浏览器语音识别连续重连失败。", "请点一次停止再开始，或换 Chrome / Edge 测试；生产版建议接入可控的流式 ASR。");
    stopListening();
    return;
  }

  const delay = RESTART_DELAY_MS + Math.min(state.restartAttempts * 120, 900);
  state.restartTimer = setTimeout(() => {
    state.restartTimer = null;

    if (!state.listening || state.paused) return;

    if (state.recognition) {
      state.recognition.onend = null;
      try {
        state.recognition.stop();
      } catch (error) {
        // Already stopped.
      }
    }

    state.recognition = createRecognition();
    startRecognitionEngine();
  }, delay);
}

async function startListening() {
  if (state.asrEngine === "local") {
    await startLocalListening();
    return;
  }

  if (state.asrEngine === "openai") {
    await startOpenAIListening();
    return;
  }

  await startWebSpeechListening();
}

async function startWebSpeechListening() {
  stopSample();

  if (!SpeechRecognition) {
    addSystemNotice("当前浏览器不支持 Web Speech API。", "请用 Chrome / Edge 打开，或先使用样例和手动输入。");
    return;
  }

  const micAccess = await ensureMicrophoneAccess();
  if (!micAccess.ok) {
    const copy = getSpeechErrorCopy(micAccess.error);
    state.micBlocked = true;
    setStatus("blocked");
    addSystemNotice(copy.title, copy.detail);
    return;
  }

  state.listening = true;
  state.paused = false;
  state.restartAttempts = 0;
  state.lastSpeechAt = Date.now();
  setStatus("active");
  els.listenButton.querySelector("span:last-child").textContent = "停止聆听";
  els.pauseButton.disabled = false;
  startWatchdog();
  startRecognitionEngine();
}

function stopListening() {
  teardownRecognition();
  teardownOpenAIRecognition();
  teardownLocalRecognition();
  state.listening = false;
  state.paused = false;
  state.micBlocked = false;
  state.interimText = "";
  state.interimCorrection = null;
  setStatus("idle");
  els.listenButton.querySelector("span:last-child").textContent = "开始聆听";
  els.pauseButton.disabled = true;
  renderTranscript();
}

function toggleListening() {
  if (state.listening) {
    stopListening();
  } else {
    startListening();
  }
}

function togglePause() {
  if (!state.listening) return;

  if (state.asrEngine === "openai") {
    toggleOpenAIPause();
    return;
  }

  if (state.asrEngine === "local") {
    toggleLocalPause();
    return;
  }

  if (state.paused) {
    state.paused = false;
    setStatus("active");
    els.pauseButton.setAttribute("aria-label", "暂停");
    els.pauseButton.title = "暂停";
    els.pauseButton.querySelector("span").textContent = "Ⅱ";
    state.restartAttempts = 0;
    state.lastSpeechAt = Date.now();
    startWatchdog();
    startRecognitionEngine();
  } else {
    state.paused = true;
    clearRestartTimer();
    stopWatchdog();
    if (state.recognition) {
      state.recognition.onend = null;
      try {
        state.recognition.stop();
      } catch (error) {
        // Already stopped.
      }
      state.recognition = null;
    }
    state.recognitionActive = false;
    state.recognitionRestarting = false;
    setStatus("paused");
    els.pauseButton.setAttribute("aria-label", "继续");
    els.pauseButton.title = "继续";
    els.pauseButton.querySelector("span").textContent = "▶";
  }
}

async function toggleOpenAIPause() {
  if (state.paused) {
    state.paused = false;
    setStatus("active");
    els.pauseButton.setAttribute("aria-label", "暂停");
    els.pauseButton.title = "暂停";
    els.pauseButton.querySelector("span").textContent = "Ⅱ";

    try {
      await startOpenAIRecorder();
    } catch (error) {
      const copy = getMicrophoneStartErrorCopy(error, "OpenAI ASR 恢复失败。");
      addSystemNotice(copy.title, copy.detail);
      stopListening();
    }
  } else {
    state.paused = true;
    teardownOpenAIRecognition();
    setStatus("paused");
    els.pauseButton.setAttribute("aria-label", "继续");
    els.pauseButton.title = "继续";
    els.pauseButton.querySelector("span").textContent = "▶";
  }
}

async function toggleLocalPause() {
  if (state.paused) {
    state.paused = false;
    setStatus("active");
    els.pauseButton.setAttribute("aria-label", "暂停");
    els.pauseButton.title = "暂停";
    els.pauseButton.querySelector("span").textContent = "Ⅱ";

    try {
      await startLocalRecorder();
      startLocalDraftRecognition();
    } catch (error) {
      const copy = getMicrophoneStartErrorCopy(error, "本地 SenseVoice 恢复失败。");
      addSystemNotice(copy.title, copy.detail);
      stopListening();
    }
  } else {
    state.paused = true;
    teardownLocalRecognition();
    setStatus("paused");
    els.pauseButton.setAttribute("aria-label", "继续");
    els.pauseButton.title = "继续";
    els.pauseButton.querySelector("span").textContent = "▶";
  }
}

function stopSample() {
  if (state.sampleTimer) {
    clearInterval(state.sampleTimer);
    state.sampleTimer = null;
    els.sampleButton.querySelector("span").textContent = "▶";
    if (!state.listening) setStatus("idle");
  }
}

function playSample() {
  if (state.sampleTimer) {
    stopSample();
    return;
  }

  stopListening();
  setStatus("sample");
  els.sampleButton.querySelector("span").textContent = "■";

  let index = 0;
  addTranscriptLine(sampleLines[index], false);
  index += 1;

  state.sampleTimer = setInterval(() => {
    if (index >= sampleLines.length) {
      stopSample();
      return;
    }
    addTranscriptLine(sampleLines[index], false);
    index += 1;
  }, 1300);
}

function clearSession() {
  stopSample();
  stopListening();
  state.enrichmentTimers.forEach((timer) => clearTimeout(timer));
  state.enrichmentTimers.clear();
  state.transcript = [];
  state.contextHistory = [];
  state.interimText = "";
  state.interimCorrection = null;
  state.cues = [];
  state.selectedCueId = null;
  state.manualSelectionLockedUntil = 0;
  state.sessionHiddenTerms.clear();
  state.lastProcessedText = "";
  clearHighlightCache();
  clearSystemNotice();
  updateMicLevel();
  els.latencyReadout.textContent = "0 ms";
  renderTranscript();
  renderCues();
  renderDetail(null);
  updateMetrics();
}

function drawWave() {
  const canvas = els.waveCanvas;
  const ctx = canvas.getContext("2d");
  const { width, height } = canvas;
  ctx.clearRect(0, 0, width, height);
  ctx.lineWidth = 3;
  ctx.lineCap = "round";

  const active = state.listening || state.sampleTimer;
  const colors = ["#007c7a", "#d95f3f", "#315cbb"];

  colors.forEach((color, colorIndex) => {
    ctx.beginPath();
    ctx.strokeStyle = color;
    for (let x = 0; x < width; x += 8) {
      const amplitude = active ? 9 + colorIndex * 3 : 3 + colorIndex;
      const y =
        height / 2 +
        Math.sin((x + state.wavePhase + colorIndex * 34) / 18) * amplitude;
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  });

  state.wavePhase += active ? 2.2 : 0.45;
  requestAnimationFrame(drawWave);
}

els.listenButton.addEventListener("click", toggleListening);
els.pauseButton.addEventListener("click", togglePause);
els.sampleButton.addEventListener("click", playSample);
els.clearButton.addEventListener("click", clearSession);
els.asrSelect.addEventListener("change", (event) => {
  const wasListening = state.listening;
  if (wasListening) stopListening();
  state.asrEngine = event.target.value;
  syncAsrEngineUI();
  if (state.asrEngine === "local") {
    addSystemNotice("已切换到本地 SenseVoice。", "默认使用 SenseVoiceSmall，whisper.cpp 只作为备用。");
  } else if (state.asrEngine === "openai") {
    addSystemNotice("已切换到 OpenAI ASR。", "请使用 `OPENAI_API_KEY=... node server.mjs` 启动本地代理。");
  }
});
els.fallbackToggle.addEventListener("change", (event) => {
  state.fallbackEnabled = event.target.checked;

  if (state.fallbackEnabled) {
    state.cues.forEach(scheduleFallbackEnrichment);
  } else {
    state.enrichmentTimers.forEach((timer) => clearTimeout(timer));
    state.enrichmentTimers.clear();
    state.cues.forEach((cue) => {
      if (cue.enrichmentStatus === "queued" || cue.enrichmentStatus === "loading") {
        cue.enrichmentStatus = "off";
      }
    });
  }

  renderCues();
  renderDetail(getSelectedCue());
});
els.focusModeToggle.checked = state.focusMode;
els.focusModeToggle.addEventListener("change", (event) => {
  state.focusMode = event.target.checked;
  saveFocusMode();
  renderCues();
  renderDetail(getSelectedCue());
  updateMetrics();
});

els.manualForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const value = els.manualInput.value;
  addTranscriptLine(value, false);
  els.manualInput.value = "";
});

renderTranscript();
renderCues();
renderDetail(null);
updateMetrics();
syncAsrEngineUI();
updateMicLevel();
renderSystemNotice();
drawWave();
