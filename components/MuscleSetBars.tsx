import React, { useMemo } from "react";
import { StyleSheet, View } from "react-native";
import { t } from "@lingui/core/macro";
import { useLingui } from "@lingui/react";
import { ThemedText } from "@/components/ThemedText";
import { muscleTranslations } from "@/constants/dbTranslations";
import { capitalizeWords } from "@/utils/utility";
import { DEVICE_LOCALE } from "@/utils/numberFormat";
import { useAppTheme, radii } from "@/theme";
import type { AppThemeColors } from "@/theme/types";

export type MuscleSetsZone = "below" | "within" | "above";

export interface MuscleSetsRow {
  key: string;
  perWeek: number;
  zone: MuscleSetsZone | null;
}

export interface MuscleSetsTarget {
  min: number;
  max: number;
}

/** Average weekly sets per group, largest first, with each one's target zone. */
export const buildMuscleSetsRows = (
  totals: Record<string, number>,
  weeks: number,
  target: MuscleSetsTarget | null,
): MuscleSetsRow[] =>
  Object.entries(totals)
    .map(([key, total]) => {
      const perWeek = Math.round((total / weeks) * 10) / 10;
      const zone: MuscleSetsZone | null = !target
        ? null
        : perWeek < target.min
          ? "below"
          : perWeek > target.max
            ? "above"
            : "within";
      return { key, perWeek, zone };
    })
    .filter((row) => row.perWeek > 0)
    .sort((a, b) => b.perWeek - a.perWeek || a.key.localeCompare(b.key));

export const formatSets = (value: number) =>
  value.toLocaleString(DEVICE_LOCALE, { maximumFractionDigits: 1 });

/** A muscle key as shown on screen, translated when the library has it. */
export const useMuscleName = () => {
  const { _ } = useLingui();
  return (key: string) =>
    muscleTranslations[key]
      ? capitalizeWords(_(muscleTranslations[key]))
      : capitalizeWords(key);
};

const zoneText = (zone: MuscleSetsZone | null) =>
  zone === "below"
    ? t`below target`
    : zone === "above"
      ? t`above target`
      : zone === "within"
        ? t`within target`
        : "";

/**
 * One bar per row, scaled to the largest value (or past the target), with
 * the target range shaded behind. `rowLabel` gives each row's spoken label.
 */
export const MuscleSetBars: React.FC<{
  rows: MuscleSetsRow[];
  target: MuscleSetsTarget | null;
  nameOf: (key: string) => string;
  rowLabel: (name: string, sets: string, zone: string) => string;
}> = ({ rows, target, nameOf, rowLabel }) => {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const scaleMax = Math.max(
    1,
    ...rows.map((r) => r.perWeek),
    target ? target.max * 1.15 : 0,
  );
  const pct = (value: number) => `${Math.min(100, (value / scaleMax) * 100)}%`;
  const barColor = (zone: MuscleSetsZone | null) =>
    zone === "below" ? colors.accentBorderStrong : colors.accent;

  return (
    <>
      {rows.map((row) => {
        const name = nameOf(row.key);
        const sets = formatSets(row.perWeek);
        return (
          <View
            key={row.key}
            style={styles.row}
            accessible
            accessibilityLabel={rowLabel(name, sets, zoneText(row.zone))}
          >
            <ThemedText style={styles.name} numberOfLines={1}>
              {name}
            </ThemedText>
            <View style={styles.track}>
              {target ? (
                <View
                  style={[
                    styles.band,
                    {
                      left: pct(target.min) as `${number}%`,
                      width: `${((target.max - target.min) / scaleMax) * 100}%`,
                    },
                  ]}
                />
              ) : null}
              <View
                style={[
                  styles.bar,
                  {
                    width: pct(row.perWeek) as `${number}%`,
                    backgroundColor: barColor(row.zone),
                  },
                ]}
              />
            </View>
            <ThemedText style={styles.value}>{sets}</ThemedText>
          </View>
        );
      })}
    </>
  );
};

function createStyles(colors: AppThemeColors) {
  return StyleSheet.create({
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    name: {
      width: 96,
      fontSize: 13,
    },
    track: {
      flex: 1,
      height: 14,
      justifyContent: "center",
    },
    band: {
      position: "absolute",
      top: 0,
      bottom: 0,
      backgroundColor: colors.accentSubtle,
      borderRadius: radii.sm,
    },
    bar: {
      height: 10,
      borderRadius: radii.sm,
    },
    value: {
      width: 36,
      fontSize: 13,
      fontWeight: "600",
      textAlign: "right",
    },
  });
}
