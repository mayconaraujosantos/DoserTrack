package expo.modules.doserwidget

import android.appwidget.AppWidgetManager
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class DoserWidgetModule : Module() {
  private val context get() = appContext.reactContext!!

  override fun definition() = ModuleDefinition {
    Name("DoserWidget")

    AsyncFunction("writeWidgetData") { json: String ->
      val prefs = context.getSharedPreferences("doser_widget", Context.MODE_PRIVATE)
      prefs.edit().putString("widget_payload", json).apply()
    }

    AsyncFunction("requestWidgetUpdate") {
      val manager = AppWidgetManager.getInstance(context)
      val ids = manager.getAppWidgetIds(ComponentName(context, DoserWidgetProvider::class.java))
      if (ids.isNotEmpty()) {
        val intent = Intent(context, DoserWidgetProvider::class.java).apply {
          action = AppWidgetManager.ACTION_APPWIDGET_UPDATE
          putExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS, ids)
        }
        context.sendBroadcast(intent)
      }
    }
  }
}
