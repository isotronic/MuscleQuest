import { Alert } from "react-native";
import { router } from "expo-router";
import * as Notifications from "expo-notifications";
import { Trans } from "@lingui/react/macro";
import { t } from "@lingui/core/macro";
import {
  SettingRow,
  SettingsHeader,
  SettingsScroll,
  SwitchRow,
} from "@/components/settings/SettingRow";
import { useSettingsQuery } from "@/hooks/useSettingsQuery";
import { useSettingsOverlay } from "@/hooks/useSettingsOverlay";
import { useSettingToggle } from "@/hooks/useSettingToggle";
import { toDisplayDecimal } from "@/utils/numberFormat";
import { LOGGING_STYLES, loggingStyleOf } from "@/utils/loggingStyle";

const enabled = (on: boolean) => (on ? t`Enabled` : t`Disabled`);

export default function WorkoutSettingsScreen() {
  const { data: settings } = useSettingsQuery();
  const { showOverlay, overlay } = useSettingsOverlay();
  const [keepScreenOn, setKeepScreenOn] = useSettingToggle("keepScreenOn");
  const [globalHistory, setGlobalHistory] = useSettingToggle(
    "alwaysUseGlobalHistory",
  );
  const [vibration, setVibration] = useSettingToggle("restTimerVibration");
  const [sound, setSound] = useSettingToggle("restTimerSound");
  const [notification, setNotification] = useSettingToggle(
    "restTimerNotification",
  );
  const [countdownSound, setCountdownSound] = useSettingToggle(
    "timerCountdownSound",
  );
  const [goalSound, setGoalSound] = useSettingToggle("timerGoalSound");
  const loggingStyle = loggingStyleOf(settings);
  const loggingStyleLabels: Record<string, string> = {
    focus: t`One set at a time`,
    list: t`All sets in a list`,
  };

  const defaultRestTime = settings
    ? `${Math.floor(parseInt(settings?.defaultRestTime) / 60)}:${(
        parseInt(settings?.defaultRestTime) % 60
      )
        .toString()
        .padStart(2, "0")} minutes`
    : "";

  const toggleNotification = async (value: boolean) => {
    if (value) {
      const { status } = await Notifications.requestPermissionsAsync();

      if (status !== "granted") {
        Alert.alert(
          t`Permission Required`,
          t`To enable rest timer notifications, grant notification permissions in your device settings.`,
        );
        setNotification(false);
        return;
      }
    }
    setNotification(value);
  };

  return (
    <SettingsScroll>
      {overlay}
      <SettingsHeader>
        <Trans>Logging</Trans>
      </SettingsHeader>
      <SettingRow
        id="loggingStyle"
        icon="format-list-checks"
        title={<Trans>Logging style</Trans>}
        value={loggingStyleLabels[loggingStyle]}
        onPress={() =>
          showOverlay(
            "loggingStyle",
            loggingStyle,
            "radio",
            [...LOGGING_STYLES],
            loggingStyleLabels,
          )
        }
      />
      <SettingRow
        id="weightIncrement"
        icon="plus"
        title={<Trans>Weight steps</Trans>}
        value={
          <Trans>
            {toDisplayDecimal(settings?.weightIncrement ?? "")}{" "}
            {settings?.weightUnit}
          </Trans>
        }
        onPress={() =>
          showOverlay(
            "weightIncrement",
            settings?.weightIncrement || "",
            "number",
          )
        }
      />
      <SettingRow
        id="defaultSets"
        icon="numeric"
        title={<Trans>Default sets</Trans>}
        value={<Trans>{settings?.defaultSets} sets</Trans>}
        onPress={() =>
          showOverlay("defaultSets", settings?.defaultSets || "", "number")
        }
      />
      <SwitchRow
        id="alwaysUseGlobalHistory"
        icon="history"
        title={<Trans>Always use most recent exercise history</Trans>}
        label={t`Always use most recent exercise history`}
        value={
          globalHistory
            ? t`Using most recent from any workout`
            : t`Using history from same workout`
        }
        checked={globalHistory}
        onValueChange={setGlobalHistory}
      />
      <SwitchRow
        id="keepScreenOn"
        icon="cellphone"
        title={<Trans>Keep screen on during workout</Trans>}
        label={t`Keep screen on during workout`}
        value={enabled(keepScreenOn)}
        checked={keepScreenOn}
        onValueChange={setKeepScreenOn}
      />
      <SettingRow
        id="buttonSize"
        icon="resize"
        title={<Trans>Button size during workout</Trans>}
        value={settings?.buttonSize}
        onPress={() =>
          showOverlay("buttonSize", settings?.buttonSize || "", "radio", [
            "Standard",
            "Large",
            "XLarge",
          ])
        }
      />
      <SettingRow
        id="plates"
        icon="weight-lifter"
        title={<Trans>Plates</Trans>}
        value={<Trans>Plates you own, used by the plate calculator</Trans>}
        onPress={() => router.push("/plate-inventory")}
      />

      <SettingsHeader>
        <Trans>Rest timer</Trans>
      </SettingsHeader>
      <SettingRow
        id="defaultRestTime"
        icon="clock"
        title={<Trans>Default rest time</Trans>}
        value={defaultRestTime}
        onPress={() =>
          showOverlay(
            "defaultRestTime",
            settings?.defaultRestTime || "",
            "number",
          )
        }
      />
      <SettingRow
        id="restTimerIncrement"
        icon="timer"
        title={<Trans>Rest timer increment</Trans>}
        value={<Trans>{settings?.restTimerIncrement} seconds</Trans>}
        onPress={() =>
          showOverlay(
            "restTimerIncrement",
            settings?.restTimerIncrement || "",
            "number",
          )
        }
      />
      <SwitchRow
        id="restTimerVibration"
        icon="vibrate"
        title={<Trans>Vibrate after rest</Trans>}
        label={t`Vibrate after rest`}
        value={enabled(vibration)}
        checked={vibration}
        onValueChange={setVibration}
      />
      <SwitchRow
        id="restTimerSound"
        icon="volume-high"
        title={<Trans>Play sound after rest</Trans>}
        label={t`Play sound after rest`}
        value={enabled(sound)}
        checked={sound}
        onValueChange={setSound}
      />
      <SwitchRow
        id="restTimerNotification"
        icon="bell-ring"
        title={<Trans>Show rest notification while app is open</Trans>}
        label={t`Show rest notification while app is open`}
        value={enabled(notification)}
        checked={notification}
        onValueChange={toggleNotification}
      />

      <SettingsHeader>
        <Trans>Exercise timer</Trans>
      </SettingsHeader>
      <SettingRow
        id="timerCountdown"
        icon="timer-play-outline"
        title={<Trans>Exercise timer countdown</Trans>}
        value={<Trans>{settings?.timerCountdown || "5"} seconds</Trans>}
        onPress={() =>
          showOverlay(
            "timerCountdown",
            settings?.timerCountdown || "5",
            "number",
          )
        }
      />
      <SwitchRow
        id="timerCountdownSound"
        icon="volume-high"
        title={<Trans>Play countdown beeps (Exercise Timer)</Trans>}
        label={t`Play countdown beeps (Exercise Timer)`}
        value={enabled(countdownSound)}
        checked={countdownSound}
        onValueChange={setCountdownSound}
      />
      <SwitchRow
        id="timerGoalSound"
        icon="volume-high"
        title={<Trans>Play goal achieved sound (Exercise Timer)</Trans>}
        label={t`Play goal achieved sound (Exercise Timer)`}
        value={enabled(goalSound)}
        checked={goalSound}
        onValueChange={setGoalSound}
      />
    </SettingsScroll>
  );
}
