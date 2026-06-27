import WidgetKit
import SwiftUI

struct WidgetDose: Codable, Identifiable {
  let id: Int
  let medicineName: String
  let dosage: String
  let scheduledTime: String
  let status: String

  var timeLabel: String {
    String(scheduledTime.prefix(16).suffix(5)) // HH:mm from ISO
  }

  var isTaken: Bool { status == "taken" }
}

struct WidgetPayload: Codable {
  let profileName: String
  let date: String
  let doses: [WidgetDose]
  let updatedAt: String
}

struct DoserEntry: TimelineEntry {
  let date: Date
  let payload: WidgetPayload?
}

struct DoserWidgetProvider: TimelineProvider {
  private let appGroup = "group.com.mayconaraujosantos.doser"

  func placeholder(in context: Context) -> DoserEntry {
    DoserEntry(date: .now, payload: nil)
  }

  func getSnapshot(in context: Context, completion: @escaping (DoserEntry) -> Void) {
    completion(DoserEntry(date: .now, payload: loadPayload()))
  }

  func getTimeline(in context: Context, completion: @escaping (Timeline<DoserEntry>) -> Void) {
    let entry = DoserEntry(date: .now, payload: loadPayload())
    let nextUpdate = Calendar.current.date(byAdding: .minute, value: 15, to: .now) ?? .now
    completion(Timeline(entries: [entry], policy: .after(nextUpdate)))
  }

  private func loadPayload() -> WidgetPayload? {
    guard
      let defaults = UserDefaults(suiteName: appGroup),
      let json = defaults.string(forKey: "widget_payload"),
      let data = json.data(using: .utf8)
    else { return nil }
    return try? JSONDecoder().decode(WidgetPayload.self, from: data)
  }
}

struct DoserWidgetEntryView: View {
  var entry: DoserEntry
  @Environment(\.widgetFamily) var family
  @Environment(\.colorScheme) var colorScheme

  var body: some View {
    if let payload = entry.payload {
      PayloadView(payload: payload, family: family)
    } else {
      EmptyView()
    }
  }
}

struct PayloadView: View {
  let payload: WidgetPayload
  let family: WidgetFamily

  private var visibleDoses: [WidgetDose] {
    let max = family == .systemSmall ? 3 : 5
    return Array(payload.doses.prefix(max))
  }

  private var remaining: Int {
    max(0, payload.doses.count - visibleDoses.count)
  }

  var body: some View {
    VStack(alignment: .leading, spacing: 4) {
      Text("Doses de hoje")
        .font(.system(size: 10, weight: .medium))
        .foregroundColor(.secondary)
        .textCase(.uppercase)
        .kerning(0.5)

      if payload.doses.isEmpty {
        Spacer()
        Text("Nenhuma dose para hoje 🎉")
          .font(.system(size: 12))
          .foregroundColor(.secondary)
          .frame(maxWidth: .infinity, alignment: .center)
        Spacer()
      } else {
        ForEach(visibleDoses) { dose in
          DoseRow(dose: dose)
        }
        if remaining > 0 {
          Text("+\(remaining) mais")
            .font(.system(size: 11))
            .foregroundColor(.secondary)
            .padding(.top, 2)
        }
        Spacer(minLength: 0)
      }
    }
    .padding(12)
    .containerBackground(.background, for: .widget)
  }
}

struct DoseRow: View {
  let dose: WidgetDose

  var body: some View {
    HStack(spacing: 6) {
      Text(dose.isTaken ? "✓" : "○")
        .font(.system(size: 11, weight: .bold))
        .foregroundColor(dose.isTaken ? .green : Color(red: 0.29, green: 0.56, blue: 0.85))
        .frame(width: 14)

      Text(dose.medicineName + (dose.dosage.isEmpty ? "" : " — \(dose.dosage)"))
        .font(.system(size: 12))
        .foregroundColor(.primary)
        .lineLimit(1)

      Spacer()

      Text(dose.timeLabel)
        .font(.system(size: 11))
        .foregroundColor(.secondary)
    }
  }
}

struct EmptyView: View {
  var body: some View {
    VStack {
      Text("Doser")
        .font(.system(size: 13, weight: .semibold))
      Text("Abra o app para começar")
        .font(.system(size: 11))
        .foregroundColor(.secondary)
    }
    .containerBackground(.background, for: .widget)
  }
}

@main
struct DoserWidgetBundle: WidgetBundle {
  var body: some Widget {
    DoserWidgetMain()
  }
}

struct DoserWidgetMain: Widget {
  let kind = "DoserWidget"

  var body: some WidgetConfiguration {
    StaticConfiguration(kind: kind, provider: DoserWidgetProvider()) { entry in
      DoserWidgetEntryView(entry: entry)
    }
    .configurationDisplayName("Doser")
    .description("Suas doses do dia na tela inicial.")
    .supportedFamilies([.systemSmall, .systemMedium, .systemLarge])
  }
}
