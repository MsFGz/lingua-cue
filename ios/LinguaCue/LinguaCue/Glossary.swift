import Foundation

enum Glossary {
    static let terms: [GlossaryTerm] = [
        GlossaryTerm(
            term: "GTM",
            aliases: ["GTM", "go to market", "go-to-market"],
            meaning: "Go-to-market，产品进入市场和拿到客户的打法。",
            context: "通常包含定位、渠道、定价、销售动作和发布节奏。",
            ambiguity: "如果对方在讲具体项目代号，可能需要追问这个缩写是否是内部简称。",
            evidence: ["launch", "sales", "market", "customer", "pricing", "渠道", "销售", "发布"],
            baseConfidence: 76
        ),
        GlossaryTerm(
            term: "PM",
            aliases: ["PM", "product manager", "project manager"],
            meaning: "可能是 Product Manager，也可能是 Project Manager。",
            context: "如果旁边出现 roadmap、feature、user，多半是产品经理。",
            ambiguity: "高歧义缩写，需要结合上下文判断。",
            evidence: ["roadmap", "feature", "user", "timeline", "项目", "产品"],
            baseConfidence: 58
        ),
        GlossaryTerm(
            term: "PMM",
            aliases: ["PMM", "product marketing manager"],
            meaning: "Product Marketing Manager，产品营销经理。",
            context: "常负责 positioning、launch、messaging 和 sales enablement。",
            ambiguity: "如果上下文没有营销或发布语境，置信度应降低。",
            evidence: ["positioning", "launch", "messaging", "enablement", "营销", "发布"],
            baseConfidence: 76
        ),
        GlossaryTerm(
            term: "MVP",
            aliases: ["MVP", "minimum viable product"],
            meaning: "Minimum Viable Product，最小可行产品。",
            context: "用于快速验证核心假设，不等于粗糙 demo。",
            ambiguity: "体育语境里也可能是 Most Valuable Player。",
            evidence: ["prototype", "validate", "launch", "假设", "验证", "产品"],
            baseConfidence: 82
        ),
        GlossaryTerm(
            term: "ARR",
            aliases: ["ARR", "annual recurring revenue"],
            meaning: "Annual Recurring Revenue，年度经常性收入。",
            context: "SaaS 融资、增长和财务聊天里非常常见。",
            ambiguity: "少数技术语境里可能不是财务指标。",
            evidence: ["revenue", "SaaS", "subscription", "finance", "收入", "订阅"],
            baseConfidence: 82
        ),
        GlossaryTerm(
            term: "CAC",
            aliases: ["CAC", "customer acquisition cost"],
            meaning: "Customer Acquisition Cost，获客成本。",
            context: "常和 LTV、payback、growth、渠道效率一起出现。",
            ambiguity: "如果没有商业语境，需要确认是不是其它内部指标。",
            evidence: ["LTV", "payback", "growth", "channel", "获客", "增长"],
            baseConfidence: 78
        ),
        GlossaryTerm(
            term: "LTV",
            aliases: ["LTV", "lifetime value"],
            meaning: "Lifetime Value，客户生命周期价值。",
            context: "常和 CAC 一起判断增长模型是否健康。",
            ambiguity: "金融或广告语境可能有更具体口径。",
            evidence: ["CAC", "retention", "customer", "收入", "留存", "获客"],
            baseConfidence: 78
        ),
        GlossaryTerm(
            term: "ICP",
            aliases: ["ICP", "ideal customer profile"],
            meaning: "Ideal Customer Profile，理想客户画像。",
            context: "用于定义最值得服务和销售的客户类型。",
            ambiguity: "技术或设计领域也可能有其它含义。",
            evidence: ["customer", "segment", "persona", "客户", "画像", "细分"],
            baseConfidence: 74
        ),
        GlossaryTerm(
            term: "Workflow",
            aliases: ["workflow", "work flow", "工作流"],
            meaning: "工作流，一组任务、角色和状态之间的流转方式。",
            context: "产品、自动化和 AI agent 场景都常见。",
            ambiguity: "如果只是日常口语，也可能泛指做事步骤。",
            evidence: ["automation", "process", "agent", "流程", "自动化", "任务"],
            baseConfidence: 72
        ),
        GlossaryTerm(
            term: "Vibe coding",
            aliases: ["vibe coding", "vibecoding", "web coding", "web coating", "外部 coating"],
            meaning: "用自然语言和 AI 快速协作写代码，强调边试边改的开发方式。",
            context: "AI 编程、原型开发和 agent 工具讨论里常见。",
            ambiguity: "语音识别常把 vibe coding 听成 web coding 或 coating，需要靠上下文纠正。",
            evidence: ["AI", "code", "prototype", "agent", "代码", "编程", "原型"],
            baseConfidence: 80
        ),
        GlossaryTerm(
            term: "RAG",
            aliases: ["RAG", "retrieval augmented generation"],
            meaning: "Retrieval-Augmented Generation，检索增强生成。",
            context: "让模型回答前先检索知识库或文档。",
            ambiguity: "没有 AI 语境时可能只是普通缩写。",
            evidence: ["retrieval", "vector", "knowledge", "LLM", "检索", "知识库"],
            baseConfidence: 78
        ),
        GlossaryTerm(
            term: "MCP",
            aliases: ["MCP", "model context protocol"],
            meaning: "Model Context Protocol，让模型连接工具和外部上下文的协议。",
            context: "AI agent、工具调用和开发者平台讨论里常见。",
            ambiguity: "传统技术语境中 MCP 也可能有其它展开。",
            evidence: ["agent", "tool", "context", "protocol", "工具", "上下文"],
            baseConfidence: 72
        ),
        GlossaryTerm(
            term: "API",
            aliases: ["API", "application programming interface"],
            meaning: "Application Programming Interface，应用程序接口。",
            context: "用于系统之间调用能力或数据。",
            ambiguity: "通常较明确。",
            evidence: ["endpoint", "integration", "SDK", "接口", "调用", "集成"],
            baseConfidence: 86
        ),
        GlossaryTerm(
            term: "SDK",
            aliases: ["SDK", "software development kit"],
            meaning: "Software Development Kit，软件开发工具包。",
            context: "通常包括库、示例、文档和集成工具。",
            ambiguity: "通常较明确。",
            evidence: ["API", "library", "docs", "开发", "集成", "工具包"],
            baseConfidence: 84
        ),
        GlossaryTerm(
            term: "OKR",
            aliases: ["OKR", "objectives and key results"],
            meaning: "Objectives and Key Results，目标与关键结果。",
            context: "用于对齐团队目标、节奏和衡量指标。",
            ambiguity: "通常较明确。",
            evidence: ["goal", "metric", "quarter", "目标", "指标", "季度"],
            baseConfidence: 82
        )
    ]
}

