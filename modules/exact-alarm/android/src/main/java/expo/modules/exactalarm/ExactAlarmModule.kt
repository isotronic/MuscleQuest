package expo.modules.exactalarm

import android.app.AlarmManager
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

// expo-notifications schedules an exact alarm only when
// AlarmManager.canScheduleExactAlarms() is true and falls back to an inexact
// one otherwise. Neither it nor any other installed package exposes that check.
class ExactAlarmModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("ExactAlarm")

    Function("canScheduleExactAlarms") {
      // Before Android 12 exact alarms need no permission.
      if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) {
        return@Function true
      }
      val context = appContext.reactContext ?: return@Function true
      val alarmManager =
        context.getSystemService(Context.ALARM_SERVICE) as AlarmManager
      alarmManager.canScheduleExactAlarms()
    }

    // Opens the "Alarms & reminders" screen for this app.
    Function("openExactAlarmSettings") {
      if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) {
        return@Function null
      }
      val context = appContext.reactContext ?: return@Function null
      val intent = Intent(
        Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM,
        Uri.parse("package:${context.packageName}"),
      ).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      context.startActivity(intent)
    }
  }
}
