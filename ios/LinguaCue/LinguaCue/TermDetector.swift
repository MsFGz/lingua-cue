import Foundation

struct TermDetector {
    func detect(in text: String, existing cues: [DetectedCue]) -> [DetectedCue] {
        let clean = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !clean.isEmpty else { return [] }

        let existingKeys = Set(cues.map { Self.key($0.term) })
        return Glossary.terms.compactMap { term in
            guard let alias = matchingAlias(for: term, in: clean) else { return nil }
            let confidence = confidence(for: term, text: clean, alias: alias)
            guard confidence >= 42 else { return nil }
            if existingKeys.contains(Self.key(term.term)), confidence < 76 { return nil }

            return DetectedCue(
                term: term.term,
                meaning: term.meaning,
                context: term.context,
                ambiguity: term.ambiguity,
                confidence: confidence,
                sourceText: clean,
                matchedAlias: alias,
                createdAt: Date()
            )
        }
        .sorted { $0.confidence > $1.confidence }
    }

    private func matchingAlias(for term: GlossaryTerm, in text: String) -> String? {
        let lowerText = text.lowercased()

        for alias in term.aliases {
            let lowerAlias = alias.lowercased()
            if lowerAlias.count <= 4, lowerAlias.allSatisfy({ $0.isLetter || $0.isNumber }) {
                if containsToken(lowerAlias, in: lowerText) { return alias }
            } else if lowerText.localizedCaseInsensitiveContains(lowerAlias) {
                return alias
            }
        }

        return nil
    }

    private func confidence(for term: GlossaryTerm, text: String, alias: String) -> Int {
        let lower = text.lowercased()
        let evidenceHits = term.evidence.filter { lower.localizedCaseInsensitiveContains($0.lowercased()) }.count
        let aliasBonus = alias.caseInsensitiveCompare(term.term) == .orderedSame ? 4 : 0
        let lengthPenalty = text.count < 12 ? 8 : 0
        return min(94, max(34, term.baseConfidence + evidenceHits * 5 + aliasBonus - lengthPenalty))
    }

    private func containsToken(_ token: String, in text: String) -> Bool {
        let pattern = #"(?<![A-Za-z0-9])\#(NSRegularExpression.escapedPattern(for: token))(?![A-Za-z0-9])"#
        return text.range(of: pattern, options: [.regularExpression, .caseInsensitive]) != nil
    }

    private static func key(_ value: String) -> String {
        value.lowercased().filter { $0.isLetter || $0.isNumber }
    }
}

