import ExpoModulesCore
import WidgetKit

public class DoserWidgetModule: Module {
  public func definition() -> ModuleDefinition {
    Name("DoserWidget")

    AsyncFunction("writeWidgetData") { (json: String) in
      let appGroup = "group.com.mayconaraujosantos.doser"
      let defaults = UserDefaults(suiteName: appGroup)
      defaults?.set(json, forKey: "widget_payload")
      defaults?.synchronize()
    }

    AsyncFunction("requestWidgetUpdate") {
      if #available(iOS 14.0, *) {
        WidgetCenter.shared.reloadAllTimelines()
      }
    }
  }
}
