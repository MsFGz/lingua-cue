import Foundation

@MainActor
final class ConversationSession: ObservableObject {
    @Published private(set) var state: ListeningState = .idle
    @Published private(set) var transcript: [TranscriptLine] = []
    @Published private(set) var draftText: String = ""
    @Published private(set) var cues: [DetectedCue] = []
    @Published var selectedCueID: DetectedCue.ID?

    private let speech = SpeechRecognitionService()
    private let detector = TermDetector()
    private var lastFinalText = ""

    var selectedCue: DetectedCue? {
        if let selectedCueID, let cue = cues.first(where: { $0.id == selectedCueID }) {
            return cue
        }
        return cues.first
    }

    var averageConfidence: Int {
        guard !cues.isEmpty else { return 0 }
        return cues.map(\.confidence).reduce(0, +) / cues.count
    }

    func toggleListening() {
        if state.isListening {
            stopListening()
        } else {
            Task { await startListening() }
        }
    }

    func startListening() async {
        state = .requestingPermission
        guard await speech.requestAuthorization() else {
            state = .blocked("需要开启麦克风和语音识别权限。")
            addSystemLine("麦克风或语音识别权限未开启。")
            return
        }

        do {
            try speech.start { [weak self] text, isFinal in
                guard let self else { return }
                self.handleSpeech(text: text, isFinal: isFinal)
            }
            state = .listening
        } catch {
            state = .blocked(error.localizedDescription)
            addSystemLine(error.localizedDescription)
        }
    }

    func stopListening() {
        speech.stop()
        if !draftText.isEmpty {
            addTranscript(draftText)
        }
        draftText = ""
        state = .idle
    }

    func clear() {
        speech.stop()
        transcript = []
        draftText = ""
        cues = []
        selectedCueID = nil
        lastFinalText = ""
        state = .idle
    }

    func addManualText(_ text: String) {
        addTranscript(text)
    }

    private func handleSpeech(text: String, isFinal: Bool) {
        let clean = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !clean.isEmpty else { return }

        if isFinal {
            if clean != lastFinalText {
                addTranscript(clean)
                lastFinalText = clean
            }
            draftText = ""
        } else {
            draftText = clean
            addCues(from: clean)
        }
    }

    private func addTranscript(_ text: String) {
        let clean = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !clean.isEmpty else { return }
        transcript.append(TranscriptLine(text: clean, timestamp: Date(), isSystem: false))
        transcript = Array(transcript.suffix(80))
        addCues(from: clean)
    }

    private func addSystemLine(_ text: String) {
        transcript.append(TranscriptLine(text: text, timestamp: Date(), isSystem: true))
    }

    private func addCues(from text: String) {
        let incoming = detector.detect(in: text, existing: cues)
        guard !incoming.isEmpty else { return }

        for cue in incoming.reversed() {
            cues.removeAll { $0.term.caseInsensitiveCompare(cue.term) == .orderedSame }
            cues.insert(cue, at: 0)
        }

        cues = Array(cues.prefix(18))
        if selectedCueID == nil {
            selectedCueID = cues.first?.id
        }
    }
}

