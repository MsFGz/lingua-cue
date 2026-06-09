import AppIntents

struct OpenLinguaCueIntent: AppIntent {
    static var title: LocalizedStringResource = "Open Lingua Cue"
    static var description = IntentDescription("Open Lingua Cue for a coffee chat terminology session.")
    static var openAppWhenRun = true

    @MainActor
    func perform() async throws -> some IntentResult {
        .result()
    }
}

struct LinguaCueShortcuts: AppShortcutsProvider {
    static var appShortcuts: [AppShortcut] {
        AppShortcut(
            intent: OpenLinguaCueIntent(),
            phrases: [
                "Open \(.applicationName)",
                "Start coffee chat in \(.applicationName)",
                "Use \(.applicationName)"
            ],
            shortTitle: "Start Chat",
            systemImageName: "waveform.and.mic"
        )
    }
}

