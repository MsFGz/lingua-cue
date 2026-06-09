import Foundation

enum ListeningState: Equatable {
    case idle
    case requestingPermission
    case listening
    case paused
    case blocked(String)

    var label: String {
        switch self {
        case .idle:
            return "待机"
        case .requestingPermission:
            return "请求权限"
        case .listening:
            return "聆听中"
        case .paused:
            return "已暂停"
        case .blocked:
            return "受限"
        }
    }

    var isListening: Bool {
        if case .listening = self { return true }
        return false
    }
}

struct TranscriptLine: Identifiable, Equatable {
    let id = UUID()
    let text: String
    let timestamp: Date
    let isSystem: Bool
}

struct GlossaryTerm: Identifiable, Hashable {
    let id = UUID()
    let term: String
    let aliases: [String]
    let meaning: String
    let context: String
    let ambiguity: String
    let evidence: [String]
    let baseConfidence: Int
}

struct DetectedCue: Identifiable, Equatable {
    let id = UUID()
    let term: String
    let meaning: String
    let context: String
    let ambiguity: String
    let confidence: Int
    let sourceText: String
    let matchedAlias: String
    let createdAt: Date
}

