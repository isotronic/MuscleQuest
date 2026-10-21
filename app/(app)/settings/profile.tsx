import { useContext } from "react";
import { router } from "expo-router";
import { Divider } from "react-native-paper";
import { Trans } from "@lingui/react/macro";
import { msg } from "@lingui/core/macro";
import { useLingui } from "@lingui/react";
import { AccountCard } from "@/components/settings/AccountCard";
import {
  SettingAnchor,
  SettingRow,
  SettingsScroll,
  useSettingStyles,
} from "@/components/settings/SettingRow";
import { AccountOwnershipNotice } from "@/components/AccountOwnershipNotice";
import { PrivacySettings } from "@/components/PrivacySettings";
import { AuthContext } from "@/context/AuthProvider";
import { useSettingsQuery } from "@/hooks/useSettingsQuery";
import { useSettingsOverlay } from "@/hooks/useSettingsOverlay";
import { useWeekRule } from "@/hooks/useWeekRule";
import { useLatestBodyMetricValuesQuery } from "@/hooks/useBodyMeasurementSessionsQuery";
import { AppIcon } from "@/components/ui/AppIcon";
import { ThemedText } from "@/components/ThemedText";
import { useAppTheme } from "@/theme";
import { localDateKeyToDate, parseDbTimestamp } from "@/utils/dates";
import { formatNumber, toDisplayDecimal } from "@/utils/numberFormat";
import { weekStartsOnToday, type WeekStartDay } from "@/utils/week";

const WEEK_START_NAMES: Record<WeekStartDay, ReturnType<typeof msg>> = {
  1: msg`Monday`,
  0: msg`Sunday`,
};

export default function ProfileSettingsScreen() {
  const { colors } = useAppTheme();
  const styles = useSettingStyles();
  const { _ } = useLingui();
  const user = useContext(AuthContext);
  const { data: settings } = useSettingsQuery();
  const { showOverlay, overlay } = useSettingsOverlay();
  const weekRule = useWeekRule();
  const { data: latestValues } = useLatestBodyMetricValuesQuery({
    weightUnit: settings?.weightUnit === "lbs" ? "lbs" : "kg",
    sizeUnit: settings?.sizeUnit === "in" ? "in" : "cm",
  });
  const latestWeight = latestValues?.find((v) => v.metric.key === "weight");
  const loggedAt = latestWeight
    ? parseDbTimestamp(latestWeight.recorded_at)
    : null;
  const loggedOn = loggedAt
    ? loggedAt.toLocaleDateString(undefined, {
        day: "numeric",
        month: "short",
        // An older entry should not read like a recent one.
        year:
          loggedAt.getFullYear() === new Date().getFullYear()
            ? undefined
            : "numeric",
      })
    : "";
  // The chosen start, which may only apply from next week.
  const weekStartsOn = weekRule.weekStartsOn;
  const weekStartPending =
    weekStartsOnToday(weekRule) !== weekStartsOn && weekRule.from
      ? localDateKeyToDate(weekRule.from).toLocaleDateString(undefined, {
          day: "numeric",
          month: "long",
        })
      : null;

  return (
    <SettingsScroll>
      {overlay}
      <AccountCard />
      <SettingRow
        id="weeklyGoal"
        testID="setting-weekly-goal"
        icon="target"
        title={<Trans>Weekly goal</Trans>}
        value={<Trans>{settings?.weeklyGoal} days per week</Trans>}
        onPress={() =>
          showOverlay("weeklyGoal", settings?.weeklyGoal || "1", "slider")
        }
      />
      <SettingRow
        id="weekStartsOn"
        icon="calendar-week-begin"
        title={<Trans>Week starts on</Trans>}
        value={
          weekStartPending ? (
            <Trans>
              {_(WEEK_START_NAMES[weekStartsOn])} from {weekStartPending}
            </Trans>
          ) : (
            _(WEEK_START_NAMES[weekStartsOn])
          )
        }
        onPress={() =>
          showOverlay(
            "weekStartsOn",
            String(weekStartsOn),
            "radio",
            ["1", "0"],
            {
              "1": _(WEEK_START_NAMES[1]),
              "0": _(WEEK_START_NAMES[0]),
            },
          )
        }
      />
      {/* Read-only: body weight is a measurement entry, logged in one place. */}
      <SettingRow
        id="bodyWeight"
        icon="scale-bathroom"
        title={<Trans>Body weight</Trans>}
        value={
          // Nothing until the latest entry has loaded, so the legacy value
          // does not flash first.
          !latestValues ? undefined : latestWeight ? (
            <Trans>
              {formatNumber(latestWeight.displayValue, 1)}{" "}
              {latestWeight.displayUnit}, logged {loggedOn}
            </Trans>
          ) : settings?.bodyWeight ? (
            `${toDisplayDecimal(settings.bodyWeight)} ${settings.weightUnit}`
          ) : (
            <Trans>Add your body weight</Trans>
          )
        }
        onPress={() =>
          router.push({
            pathname: "/(app)/(tabs)/(stats)/measurements",
            params: { focus: "weight" },
          })
        }
        trailing={
          <AppIcon
            set="mci"
            name="chevron-right"
            size={24}
            color={colors.contentSecondary}
          />
        }
      >
        <ThemedText style={styles.currentSetting}>
          <Trans>Used for assisted and bodyweight exercises</Trans>
        </ThemedText>
      </SettingRow>
      <AccountOwnershipNotice user={user} />
      {user && (
        <>
          <Divider style={styles.divider} />
          <SettingAnchor id="privacy">
            <PrivacySettings />
          </SettingAnchor>
          <Divider style={styles.divider} />
          <SettingRow
            id="deleteAccount"
            icon="account-remove"
            iconColor={colors.danger}
            title={<Trans>Delete account</Trans>}
            titleColor={colors.danger}
            value={
              <Trans>Remove your account and everything stored online</Trans>
            }
            onPress={() => router.push("/delete-account")}
          />
        </>
      )}
    </SettingsScroll>
  );
}
