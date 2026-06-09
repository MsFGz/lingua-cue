import SwiftUI

struct ContentView: View {
    @EnvironmentObject private var session: ConversationSession
    @State private var manualText = ""

    var body: some View {
        NavigationStack {
            GeometryReader { proxy in
                VStack(spacing: 12) {
                    HeaderView()
                    ControlBar(manualText: $manualText)

                    if proxy.size.width >= 860 {
                        HStack(spacing: 12) {
                            TranscriptPanel()
                                .frame(maxWidth: .infinity)
                            CuePanel()
                                .frame(width: 300)
                            DetailPanel()
                                .frame(width: 320)
                        }
                    } else {
                        VStack(spacing: 12) {
                            TranscriptPanel()
                                .frame(height: min(380, proxy.size.height * 0.42))
                            CuePanel()
                                .frame(height: min(260, proxy.size.height * 0.30))
                            DetailPanel()
                                .frame(height: min(300, proxy.size.height * 0.34))
                        }
                    }
                }
                .padding(14)
                .frame(width: proxy.size.width, height: proxy.size.height, alignment: .top)
                .background(Color.appBackground)
            }
            .navigationBarTitleDisplayMode(.inline)
        }
    }
}

struct HeaderView: View {
    @EnvironmentObject private var session: ConversationSession

    var body: some View {
        HStack(spacing: 12) {
            BrandMark()
            VStack(alignment: .leading, spacing: 2) {
                Text("COFFEE CHAT COPILOT")
                    .font(.caption.weight(.bold))
                    .tracking(1.8)
                    .foregroundStyle(.secondary)
                Text("Lingua Cue")
                    .font(.largeTitle.weight(.heavy))
                    .minimumScaleFactor(0.72)
            }
            Spacer(minLength: 12)
            StatusPill(
                label: session.state.label,
                confidence: session.averageConfidence
            )
        }
        .padding(16)
        .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 12))
        .overlay(RoundedRectangle(cornerRadius: 12).stroke(Color.cardStroke))
    }
}

struct BrandMark: View {
    var body: some View {
        HStack(alignment: .bottom, spacing: 4) {
            Capsule().fill(Color.tealAccent).frame(width: 9, height: 16)
            Capsule().fill(Color.coralAccent).frame(width: 9, height: 28)
            Capsule().fill(Color.goldAccent).frame(width: 9, height: 22)
        }
        .padding(10)
        .frame(width: 54, height: 54)
        .background(Color.ink, in: RoundedRectangle(cornerRadius: 10))
    }
}

struct StatusPill: View {
    let label: String
    let confidence: Int

    var body: some View {
        HStack(spacing: 8) {
            Circle().fill(Color.tealAccent).frame(width: 10, height: 10)
            Text(label)
            Divider().frame(height: 18)
            Text("\(confidence)%")
        }
        .font(.callout.weight(.semibold))
        .foregroundStyle(.secondary)
        .padding(.horizontal, 12)
        .frame(height: 38)
        .background(Color.white.opacity(0.82), in: Capsule())
        .overlay(Capsule().stroke(Color.cardStroke))
    }
}

struct ControlBar: View {
    @EnvironmentObject private var session: ConversationSession
    @Binding var manualText: String

    var body: some View {
        VStack(spacing: 10) {
            HStack(spacing: 10) {
                Button {
                    session.toggleListening()
                } label: {
                    Label(session.state.isListening ? "停止聆听" : "开始聆听", systemImage: "record.circle.fill")
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(PrimaryButtonStyle(isActive: session.state.isListening))

                Button {
                    session.clear()
                } label: {
                    Image(systemName: "xmark")
                        .frame(width: 44, height: 44)
                }
                .buttonStyle(IconButtonStyle())
            }

            HStack(spacing: 10) {
                TextField("输入一句中英混合表达来测试", text: $manualText)
                    .textFieldStyle(.plain)
                    .padding(.horizontal, 12)
                    .frame(height: 44)
                    .background(Color.white, in: RoundedRectangle(cornerRadius: 8))
                    .overlay(RoundedRectangle(cornerRadius: 8).stroke(Color.cardStroke))

                Button("分析") {
                    session.addManualText(manualText)
                    manualText = ""
                }
                .buttonStyle(CompactButtonStyle())
                .disabled(manualText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
            }
        }
        .padding(12)
        .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 12))
        .overlay(RoundedRectangle(cornerRadius: 12).stroke(Color.cardStroke))
    }
}

struct TranscriptPanel: View {
    @EnvironmentObject private var session: ConversationSession

    var body: some View {
        Panel(title: "对话流", eyebrow: "LIVE TRANSCRIPT") {
            ScrollViewReader { proxy in
                ScrollView {
                    LazyVStack(spacing: 10) {
                        if session.transcript.isEmpty && session.draftText.isEmpty {
                            EmptyState(text: "开始聆听后，对话会出现在这里。")
                        }

                        ForEach(session.transcript) { line in
                            TranscriptRow(line: line)
                                .id(line.id)
                        }

                        if !session.draftText.isEmpty {
                            DraftRow(text: session.draftText)
                                .id("draft")
                        }
                    }
                    .padding(12)
                }
                .onChange(of: session.transcript.count) { _, _ in
                    scrollToBottom(proxy)
                }
                .onChange(of: session.draftText) { _, _ in
                    scrollToBottom(proxy)
                }
            }
        }
    }

    private func scrollToBottom(_ proxy: ScrollViewProxy) {
        withAnimation(.easeOut(duration: 0.18)) {
            if !session.draftText.isEmpty {
                proxy.scrollTo("draft", anchor: .bottom)
            } else if let last = session.transcript.last {
                proxy.scrollTo(last.id, anchor: .bottom)
            }
        }
    }
}

struct TranscriptRow: View {
    let line: TranscriptLine

    var body: some View {
        HStack(alignment: .top, spacing: 10) {
            Text(line.timestamp, style: .time)
                .font(.caption.weight(.bold))
                .foregroundStyle(.secondary)
                .frame(width: 58, alignment: .leading)
            Text(line.text)
                .font(.body.weight(line.isSystem ? .semibold : .regular))
                .foregroundStyle(line.isSystem ? Color.coralAccent : Color.primary)
                .frame(maxWidth: .infinity, alignment: .leading)
        }
        .padding(12)
        .background(line.isSystem ? Color.coralAccent.opacity(0.08) : Color.white, in: RoundedRectangle(cornerRadius: 10))
        .overlay(RoundedRectangle(cornerRadius: 10).stroke(line.isSystem ? Color.coralAccent.opacity(0.35) : Color.cardStroke))
    }
}

struct DraftRow: View {
    let text: String

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("草稿")
                .font(.caption.weight(.bold))
                .foregroundStyle(Color.tealAccent)
            Text(text)
                .frame(maxWidth: .infinity, alignment: .leading)
        }
        .padding(12)
        .background(Color.tealAccent.opacity(0.08), in: RoundedRectangle(cornerRadius: 10))
        .overlay(RoundedRectangle(cornerRadius: 10).stroke(Color.tealAccent.opacity(0.35)))
    }
}

struct CuePanel: View {
    @EnvironmentObject private var session: ConversationSession

    var body: some View {
        Panel(title: "术语提示", eyebrow: "DETECTED CUES", badge: "\(session.cues.count)") {
            ScrollView {
                LazyVStack(spacing: 10) {
                    if session.cues.isEmpty {
                        EmptyState(text: "识别到 GTM、ARR、workflow 等词时，会自动沉到这里。")
                    }

                    ForEach(session.cues) { cue in
                        CueRow(cue: cue, selected: cue.id == session.selectedCueID)
                            .onTapGesture {
                                session.selectedCueID = cue.id
                            }
                    }
                }
                .padding(12)
            }
        }
    }
}

struct CueRow: View {
    let cue: DetectedCue
    let selected: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: 7) {
            HStack {
                Text(cue.term)
                    .font(.headline.weight(.heavy))
                    .foregroundStyle(Color.tealAccent)
                Spacer()
                Text("\(cue.confidence)%")
                    .font(.caption.weight(.bold))
                    .foregroundStyle(.secondary)
            }
            Text(cue.meaning)
                .font(.callout)
                .lineLimit(3)
            Text("命中：\(cue.matchedAlias)")
                .font(.caption.weight(.semibold))
                .foregroundStyle(.secondary)
        }
        .padding(12)
        .background(selected ? Color.tealAccent.opacity(0.12) : Color.white, in: RoundedRectangle(cornerRadius: 10))
        .overlay(RoundedRectangle(cornerRadius: 10).stroke(selected ? Color.tealAccent.opacity(0.62) : Color.cardStroke))
    }
}

struct DetailPanel: View {
    @EnvironmentObject private var session: ConversationSession

    var body: some View {
        Panel(title: "解释卡片", eyebrow: "CONTEXT") {
            ScrollView {
                if let cue = session.selectedCue {
                    VStack(alignment: .leading, spacing: 14) {
                        Text(cue.term)
                            .font(.title.weight(.heavy))
                        Text(cue.meaning)
                            .font(.headline)
                            .foregroundStyle(.secondary)
                        ConfidenceBar(value: cue.confidence)
                        DetailBlock(title: "场景判断", text: cue.context)
                        DetailBlock(title: "歧义处理", text: cue.ambiguity)
                        DetailBlock(title: "原句", text: cue.sourceText)
                    }
                    .padding(14)
                } else {
                    EmptyState(text: "等待术语出现。")
                        .padding(12)
                }
            }
        }
    }
}

struct Panel<Content: View>: View {
    let title: String
    let eyebrow: String
    var badge: String?
    @ViewBuilder let content: Content

    var body: some View {
        VStack(spacing: 0) {
            HStack {
                VStack(alignment: .leading, spacing: 3) {
                    Text(eyebrow)
                        .font(.caption.weight(.heavy))
                        .tracking(1.6)
                        .foregroundStyle(.secondary)
                    Text(title)
                        .font(.title3.weight(.heavy))
                }
                Spacer()
                if let badge {
                    Text(badge)
                        .font(.headline.weight(.heavy))
                        .foregroundStyle(.white)
                        .frame(minWidth: 34, minHeight: 34)
                        .background(Color.blueAccent, in: Circle())
                }
            }
            .padding(14)
            .background(Color.surface)

            Divider()
            content
        }
        .background(Color.surface, in: RoundedRectangle(cornerRadius: 12))
        .overlay(RoundedRectangle(cornerRadius: 12).stroke(Color.cardStroke))
        .clipShape(RoundedRectangle(cornerRadius: 12))
    }
}

struct DetailBlock: View {
    let title: String
    let text: String

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(title)
                .font(.caption.weight(.heavy))
                .foregroundStyle(.secondary)
            Text(text)
                .frame(maxWidth: .infinity, alignment: .leading)
        }
        .padding(12)
        .background(Color.white.opacity(0.72), in: RoundedRectangle(cornerRadius: 10))
        .overlay(RoundedRectangle(cornerRadius: 10).stroke(Color.cardStroke))
    }
}

struct ConfidenceBar: View {
    let value: Int

    var body: some View {
        GeometryReader { geometry in
            ZStack(alignment: .leading) {
                Capsule().fill(Color.cardStroke)
                Capsule()
                    .fill(LinearGradient(colors: [.coralAccent, .goldAccent, .tealAccent], startPoint: .leading, endPoint: .trailing))
                    .frame(width: geometry.size.width * CGFloat(value) / 100)
            }
        }
        .frame(height: 8)
    }
}

struct EmptyState: View {
    let text: String

    var body: some View {
        Text(text)
            .font(.callout.weight(.semibold))
            .foregroundStyle(.secondary)
            .multilineTextAlignment(.center)
            .frame(maxWidth: .infinity, minHeight: 140)
            .padding()
            .background(Color.white.opacity(0.45), in: RoundedRectangle(cornerRadius: 10))
            .overlay(RoundedRectangle(cornerRadius: 10).stroke(Color.cardStroke, style: StrokeStyle(lineWidth: 1, dash: [5, 5])))
    }
}

struct PrimaryButtonStyle: ButtonStyle {
    let isActive: Bool

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.headline.weight(.bold))
            .foregroundStyle(.white)
            .frame(height: 46)
            .padding(.horizontal, 14)
            .background(isActive ? Color.tealAccent : Color.ink, in: RoundedRectangle(cornerRadius: 9))
            .opacity(configuration.isPressed ? 0.82 : 1)
    }
}

struct IconButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.headline.weight(.bold))
            .foregroundStyle(Color.ink)
            .background(Color.white, in: RoundedRectangle(cornerRadius: 9))
            .overlay(RoundedRectangle(cornerRadius: 9).stroke(Color.cardStroke))
            .opacity(configuration.isPressed ? 0.72 : 1)
    }
}

struct CompactButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.headline.weight(.bold))
            .foregroundStyle(.white)
            .frame(width: 74, height: 44)
            .background(Color.tealAccent, in: RoundedRectangle(cornerRadius: 9))
            .opacity(configuration.isPressed ? 0.72 : 1)
    }
}

extension Color {
    static let appBackground = Color(red: 0.965, green: 0.949, blue: 0.918)
    static let surface = Color(red: 1.0, green: 0.992, blue: 0.973)
    static let ink = Color(red: 0.090, green: 0.125, blue: 0.153)
    static let tealAccent = Color(red: 0.000, green: 0.486, blue: 0.478)
    static let coralAccent = Color(red: 0.851, green: 0.373, blue: 0.247)
    static let goldAccent = Color(red: 0.686, green: 0.482, blue: 0.122)
    static let blueAccent = Color(red: 0.192, green: 0.361, blue: 0.733)
    static let cardStroke = Color(red: 0.863, green: 0.839, blue: 0.792)
}

#Preview {
    ContentView()
        .environmentObject(ConversationSession())
}

