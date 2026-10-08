import CapgoWidgetKitShared
import ImageIO
import SwiftUI
import WidgetKit

// The app writes today's quote and the reader's theme/language into the
// Capgo Widget Kit shared store (src/lib/widget.ts). The widget fetches the
// next day's quote itself so it stays current without opening the app.

private let widgetKind = "BeWiseQuoteWidget"
private let sessionId = "bewise-daily"

struct StoredQuote: Codable, Hashable {
    var id: String
    var date: String
    var text: String
    var author: String
    var img: String?
}

struct WidgetPrefs: Decodable {
    var apiUrl: String?
    var user: String?
    var category: String?
    var categoryName: String?
    var lang: String?
    var eyebrow: String?
    var quote: StoredQuote?
}

struct QuoteEntry: TimelineEntry {
    let date: Date
    let quote: StoredQuote
    let eyebrow: String
    let category: String
    let image: UIImage?
}

private enum Copy {
    static let eyebrow: [String: String] = [
        "en": "Quote of the day", "fr": "Citation du jour", "es": "Frase del día",
        "de": "Zitat des Tages", "it": "Citazione del giorno",
    ]
    static let sample = StoredQuote(
        id: "sample",
        date: "",
        text: "The best way to get started is to quit talking and begin doing.",
        author: "Walt Disney",
        img: nil
    )
}

struct QuoteProvider: TimelineProvider {
    func placeholder(in context: Context) -> QuoteEntry {
        QuoteEntry(date: Date(), quote: Copy.sample, eyebrow: Copy.eyebrow["en"]!, category: "", image: nil)
    }

    func getSnapshot(in context: Context, completion: @escaping (QuoteEntry) -> Void) {
        Task { completion(await loadEntry(family: context.family, fetchIfStale: !context.isPreview)) }
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<QuoteEntry>) -> Void) {
        Task {
            let entry = await loadEntry(family: context.family, fetchIfStale: true)
            let calendar = Calendar.current
            let tomorrow = calendar.startOfDay(for: calendar.date(byAdding: .day, value: 1, to: Date())!)
            // A quote from another day means the fetch failed: try again soon.
            let isFresh = entry.quote.date == Self.localDay(Date())
            let next = isFresh ? tomorrow.addingTimeInterval(60) : Date().addingTimeInterval(30 * 60)
            completion(Timeline(entries: [entry], policy: .after(next)))
        }
    }

    func loadEntry(family: WidgetFamily, fetchIfStale: Bool) async -> QuoteEntry {
        let prefs = Self.readPrefs()
        let lang = prefs?.lang ?? Self.deviceLang()
        let today = Self.localDay(Date())
        var quote = prefs?.quote ?? Copy.sample

        if fetchIfStale, quote.date != today, let fresh = await Self.fetchToday(prefs: prefs, lang: lang, day: today) {
            quote = fresh
        }

        let image: UIImage?
        switch family {
        case .accessoryInline, .accessoryRectangular, .accessoryCircular:
            image = nil
        default:
            image = await Self.loadImage(quote.img, maxPixels: family == .systemSmall ? 500 : 900)
        }

        return QuoteEntry(
            date: Date(),
            quote: quote,
            eyebrow: prefs?.eyebrow ?? Copy.eyebrow[lang] ?? Copy.eyebrow["en"]!,
            category: prefs?.categoryName ?? "",
            image: image
        )
    }

    private static func readPrefs() -> WidgetPrefs? {
        guard let bridge = try? CapgoNativeWidgetBridge(),
              let session = bridge.loadSession(widgetId: sessionId) else {
            return nil
        }
        return try? JSONDecoder().decode(WidgetPrefs.self, from: session.stateData)
    }

    private static func fetchToday(prefs: WidgetPrefs?, lang: String, day: String) async -> StoredQuote? {
        var components = URLComponents(string: "\(prefs?.apiUrl ?? "https://api.bewise.love")/v1/quotes/today")
        components?.queryItems = [
            URLQueryItem(name: "category", value: prefs?.category ?? "inspire"),
            URLQueryItem(name: "lang", value: lang),
            URLQueryItem(name: "date", value: day),
        ] + (prefs?.user.map { [URLQueryItem(name: "user", value: $0)] } ?? [])
        guard let url = components?.url,
              let (data, response) = try? await URLSession.shared.data(from: url),
              (response as? HTTPURLResponse)?.statusCode == 200 else {
            return nil
        }
        return try? JSONDecoder().decode(StoredQuote.self, from: data)
    }

    /// Download a right-sized photo and decode it as a thumbnail: widgets have a small memory budget.
    private static func loadImage(_ raw: String?, maxPixels: Int) async -> UIImage? {
        guard let raw, !raw.isEmpty, var components = URLComponents(string: raw) else {
            return nil
        }
        if components.host?.hasSuffix("unsplash.com") == true {
            var items = (components.queryItems ?? []).filter { !["w", "h", "fit", "fm", "q", "auto"].contains($0.name) }
            items += [
                URLQueryItem(name: "w", value: String(maxPixels)),
                URLQueryItem(name: "fit", value: "max"),
                URLQueryItem(name: "fm", value: "jpg"),
                URLQueryItem(name: "q", value: "70"),
            ]
            components.queryItems = items
        }
        guard let url = components.url,
              let (data, _) = try? await URLSession.shared.data(from: url),
              let source = CGImageSourceCreateWithData(data as CFData, nil) else {
            return nil
        }
        let options: [CFString: Any] = [
            kCGImageSourceCreateThumbnailFromImageAlways: true,
            kCGImageSourceCreateThumbnailWithTransform: true,
            kCGImageSourceThumbnailMaxPixelSize: maxPixels,
        ]
        guard let cgImage = CGImageSourceCreateThumbnailAtIndex(source, 0, options as CFDictionary) else {
            return nil
        }
        return UIImage(cgImage: cgImage)
    }

    static func localDay(_ date: Date) -> String {
        let formatter = DateFormatter()
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter.string(from: date)
    }

    private static func deviceLang() -> String {
        let code = Locale.preferredLanguages.first.map { String($0.prefix(2)) } ?? "en"
        return Copy.eyebrow[code] == nil ? "en" : code
    }
}

// MARK: - Views

private let ink = Color(red: 11 / 255, green: 16 / 255, blue: 22 / 255)
private let mint = Color(red: 166 / 255, green: 1, blue: 203 / 255)

struct QuoteWidgetView: View {
    @Environment(\.widgetFamily) private var environmentFamily
    let entry: QuoteEntry
    /// Lets previews and snapshot tooling pick a size; WidgetKit sets the environment.
    var familyOverride: WidgetFamily?

    private var family: WidgetFamily { familyOverride ?? environmentFamily }

    var body: some View {
        switch family {
        case .accessoryInline:
            Text("“\(entry.quote.text)”")
        case .accessoryRectangular:
            VStack(alignment: .leading, spacing: 2) {
                FittingText(text: quoteText, sizes: [15, 13, 12, 11], weight: .semibold)
                    .widgetAccentable()
                if !entry.quote.author.isEmpty {
                    Text(entry.quote.author)
                        .font(.caption2)
                        .lineLimit(1)
                        .opacity(0.8)
                }
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .widgetBackground(Color.clear)
        default:
            photoCard
        }
    }

    private var isSmall: Bool { family == .systemSmall }
    private var isLarge: Bool { family == .systemLarge || family == .systemExtraLarge }

    /// Quotes come from many sources: collapse stray double spaces and line breaks.
    private var quoteText: String {
        entry.quote.text.split(whereSeparator: \.isWhitespace).joined(separator: " ")
    }

    /// Layouts to try, roomiest first: long quotes step the font down, then drop the
    /// eyebrow row to win space, so the whole quote fits instead of being cut off.
    private var layouts: [CardLayout] {
        let withHeader: [CGFloat]
        let compact: [CGFloat]
        if isSmall {
            withHeader = []
            compact = [16, 15, 14, 13, 12, 11]
        } else if isLarge {
            withHeader = [28, 26, 24, 22, 20, 18, 16, 15, 14]
            compact = [14, 13, 12]
        } else {
            withHeader = [20, 18, 17, 16, 15, 14, 13]
            compact = [14, 13, 12, 11]
        }
        return withHeader.map { CardLayout(header: true, size: $0) } + compact.map { CardLayout(header: false, size: $0) }
    }

    private var photoCard: some View {
        // ViewThatFits keeps the first layout whose natural height fits; if none does,
        // the last one is used and its quote truncates.
        ViewThatFits(in: .vertical) {
            ForEach(layouts, id: \.self) { layout in
                cardContent(layout)
            }
        }
        .padding(isSmall ? 14 : 16)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
        .widgetBackground(background)
    }

    private func cardContent(_ layout: CardLayout) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            if layout.header {
                HStack(alignment: .firstTextBaseline) {
                    Text(entry.eyebrow.uppercased())
                        .font(.system(size: 10, weight: .semibold))
                        .tracking(1.6)
                        .foregroundStyle(.white.opacity(0.75))
                    Spacer(minLength: 8)
                    if !entry.category.isEmpty {
                        Text(entry.category.capitalized)
                            .font(.system(size: 11, weight: .semibold))
                            .padding(.horizontal, 9)
                            .padding(.vertical, 4)
                            .background(.white.opacity(0.16), in: Capsule())
                            .foregroundStyle(.white)
                    }
                }
            }
            Spacer(minLength: layout.header ? 6 : 0)
            Text(quoteText)
                .font(.system(size: layout.size, weight: .semibold, design: .serif))
                .foregroundStyle(.white)
                .shadow(color: .black.opacity(0.35), radius: 8, y: 2)
            if !entry.quote.author.isEmpty {
                HStack(spacing: 6) {
                    Rectangle().fill(mint.opacity(0.85)).frame(width: 16, height: 1)
                    Text(entry.quote.author)
                        .font(.system(size: isSmall ? 11 : 13, weight: .medium))
                        .foregroundStyle(.white.opacity(0.85))
                        .lineLimit(1)
                }
                .padding(.top, isSmall || !layout.header ? 6 : 10)
            }
        }
    }

    var background: some View {
        // Overlays keep the filled photo from growing the widget's layout.
        ink
            .overlay {
                if let image = entry.image {
                    Image(uiImage: image)
                        .resizable()
                        .scaledToFill()
                }
            }
            .overlay {
                LinearGradient(
                    colors: [.black.opacity(0.45), .black.opacity(0.3), .black.opacity(0.85)],
                    startPoint: .top,
                    endPoint: .bottom
                )
            }
            .clipped()
    }
}

/// Serif text at the largest size that fits the space it is given. Falls back to
/// the smallest size, truncated, when even that does not fit.
private struct FittingText: View {
    let text: String
    let sizes: [CGFloat]
    let weight: Font.Weight

    var body: some View {
        ViewThatFits(in: .vertical) {
            ForEach(sizes, id: \.self) { size in
                Text(text).font(.system(size: size, weight: weight, design: .serif))
            }
        }
    }
}

private struct CardLayout: Hashable {
    let header: Bool
    let size: CGFloat
}

private extension View {
    /// iOS 17 wants the background declared so it can be removed in StandBy / tinted modes.
    @ViewBuilder
    func widgetBackground<Background: View>(_ background: Background) -> some View {
        if #available(iOS 17.0, *) {
            containerBackground(for: .widget) { background }
        } else {
            self.background(background)
        }
    }
}

struct BeWiseQuoteWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: widgetKind, provider: QuoteProvider()) { entry in
            QuoteWidgetView(entry: entry)
        }
        .configurationDisplayName("BeWise")
        .description("Your quote of the day.")
        .supportedFamilies([.systemSmall, .systemMedium, .systemLarge, .accessoryRectangular, .accessoryInline])
        .contentMarginsDisabledIfAvailable()
    }
}

private extension WidgetConfiguration {
    func contentMarginsDisabledIfAvailable() -> some WidgetConfiguration {
        if #available(iOSApplicationExtension 17.0, *) {
            return contentMarginsDisabled()
        }
        return self
    }
}

@main
struct BeWiseWidgetBundle: WidgetBundle {
    var body: some Widget {
        BeWiseQuoteWidget()
    }
}
