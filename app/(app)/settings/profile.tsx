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
import { useAppTheme } from "@/theme";
import { localDateKeyToDate } from "@/utils/dates";
import { toDisplayDecimal } from "@/utils/numberFormat";
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
      <SettingRow
        id="bodyWeight"
        icon="scale-bathroom"
        title={<Trans>Body weight</Trans>}
        value={
          settings?.bodyWeight ? (
            <Trans>
              {toDisplayDecimal(settings.bodyWeight)} {settings?.weightUnit}{" "}
              (used for assisted exercises)
            </Trans>
          ) : (
            <Trans>Not set (used for assisted exercises)</Trans>
          )
        }
        onPress={() =>
          showOverlay("bodyWeight", settings?.bodyWeight || "", "number")
        }
      />
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
