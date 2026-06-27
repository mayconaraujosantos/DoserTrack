package expo.modules.doserwidget

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.Context
import android.content.Intent
import android.widget.RemoteViews
import org.json.JSONObject
import org.json.JSONArray

class DoserWidgetProvider : AppWidgetProvider() {

  override fun onUpdate(context: Context, manager: AppWidgetManager, ids: IntArray) {
    ids.forEach { updateWidget(context, manager, it) }
  }

  private fun updateWidget(context: Context, manager: AppWidgetManager, widgetId: Int) {
    val prefs = context.getSharedPreferences("doser_widget", Context.MODE_PRIVATE)
    val json = prefs.getString("widget_payload", null)

    val packageName = context.packageName
    val views = RemoteViews(packageName, R.layout.doser_widget)

    val launchIntent = context.packageManager.getLaunchIntentForPackage(packageName)
    val pendingLaunch = PendingIntent.getActivity(
      context, 0, launchIntent,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
    )
    views.setOnClickPendingIntent(R.id.widget_root, pendingLaunch)

    if (json == null) {
      views.setTextViewText(R.id.widget_empty, "Abra o app para começar")
      views.setViewVisibility(R.id.widget_empty, android.view.View.VISIBLE)
      views.setViewVisibility(R.id.widget_doses_container, android.view.View.GONE)
    } else {
      renderPayload(context, views, json)
    }

    manager.updateAppWidget(widgetId, views)
  }

  private fun renderPayload(context: Context, views: RemoteViews, json: String) {
    try {
      val payload = JSONObject(json)
      val doses = payload.getJSONArray("doses")
      val packageName = context.packageName

      if (doses.length() == 0) {
        views.setTextViewText(R.id.widget_empty, "Nenhuma dose para hoje 🎉")
        views.setViewVisibility(R.id.widget_empty, android.view.View.VISIBLE)
        views.setViewVisibility(R.id.widget_doses_container, android.view.View.GONE)
        return
      }

      views.setViewVisibility(R.id.widget_empty, android.view.View.GONE)
      views.setViewVisibility(R.id.widget_doses_container, android.view.View.VISIBLE)
      views.removeAllViews(R.id.widget_doses_container)

      val max = minOf(doses.length(), 5)
      for (i in 0 until max) {
        val dose = doses.getJSONObject(i)
        val row = RemoteViews(packageName, R.layout.doser_widget_row)

        val name = dose.getString("medicineName")
        val dosage = dose.optString("dosage", "")
        val time = dose.getString("scheduledTime").substring(11, 16) // HH:mm
        val status = dose.getString("status")
        val icon = if (status == "taken") "✓" else "○"

        row.setTextViewText(R.id.dose_icon, icon)
        row.setTextViewText(R.id.dose_name, "$name${if (dosage.isNotEmpty()) " — $dosage" else ""}")
        row.setTextViewText(R.id.dose_time, time)

        views.addView(R.id.widget_doses_container, row)
      }

      if (doses.length() > 5) {
        val more = RemoteViews(packageName, R.layout.doser_widget_row)
        more.setTextViewText(R.id.dose_icon, "")
        more.setTextViewText(R.id.dose_name, "+${doses.length() - 5} mais")
        more.setTextViewText(R.id.dose_time, "")
        views.addView(R.id.widget_doses_container, more)
      }
    } catch (_: Exception) {
      views.setTextViewText(R.id.widget_empty, "Erro ao carregar doses")
      views.setViewVisibility(R.id.widget_empty, android.view.View.VISIBLE)
      views.setViewVisibility(R.id.widget_doses_container, android.view.View.GONE)
    }
  }
}
