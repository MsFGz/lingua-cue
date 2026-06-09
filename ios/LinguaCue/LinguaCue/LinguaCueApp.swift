import SwiftUI

@main
struct LinguaCueApp: App {
    @StateObject private var session = ConversationSession()

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(session)
        }
    }
}

