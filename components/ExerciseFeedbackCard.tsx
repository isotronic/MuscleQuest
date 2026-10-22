import React, { useMemo, useRef, useState } from "react";
import { StyleSheet, TextInput, TouchableOpacity, View } from "react-native";
import { t } from "@lingui/core/macro";
import { ThemedText } from "@/components/ThemedText";
import { useAppTheme, radii } from "@/theme";
import type { AppThemeColors } from "@/theme/types";
import type {
  EffortRating,
  ExerciseFeedbackPayload,
  PainFlag,
} from "@/types/progression";
import {
  buildFeedbackPayload,
  isBelowTarget,
  type FeedbackPrompt,
} from "@/utils/feedbackPrompts";

// All of the card's option labels live here, so logged effort (RPE) can
// replace the effort chips later without touching the card's flow.

function getEffortOptions(): { value: EffortRating; label: string }[] {
  return [
    { value: "easy", label: t`Easy` },
    { value: "moderate", label: t`About right` },
    { value: "hard", label: t`Hard` },
    { value: "failed", label: t`Couldn't finish` },
  ];
}

function getPainOptions(): { value: PainFlag; label: string }[] {
  return [
    { value: "none", label: t`No pain` },
    { value: "discomfort", label: t`Discomfort` },
    { value: "pain", label: t`Pain` },
  ];
}

// Below target, effort cannot change the result: the engine holds before it
// reads effort. "Hard" is sent with the real ratio because it never counts
// towards the failed-sets reduction; "Couldn't finish" still does.
function getBelowTargetOptions(): {
  key: string;
  effort: EffortRating;
  pain: PainFlag;
  label: string;
}[] {
  return [
    { key: "none", effort: "hard", pain: "none", label: t`No` },
    {
      key: "discomfort",
      effort: "hard",
      pain: "discomfort",
      label: t`Discomfort`,
    },
    { key: "pain", effort: "hard", pain: "pain", label: t`Pain` },
    {
      key: "failed",
      effort: "failed",
      pain: "none",
      label: t`Couldn't finish`,
    },
  ];
}

function getIntentOptions(): { value: "progress" | "hold"; label: string }[] {
  return [
    { value: "progress", label: t`Move up` },
    { value: "hold", label: t`Stay here` },
  ];
}

interface ExerciseFeedbackCardProps {
  prompt: FeedbackPrompt;
  onSubmit: (payload: ExerciseFeedbackPayload) => void;
  /** Shows a Skip button; the summary's catch-up rows have none. */
  onSkip?: () => void;
}

export default function ExerciseFeedbackCard({
  prompt,
  onSubmit,
  onSkip,
}: ExerciseFeedbackCardProps) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [painOpen, setPainOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [pain, setPain] = useState<PainFlag>("none");
  const [intent, setIntent] = useState<"progress" | "hold">("progress");
  const [notes, setNotes] = useState("");

  const exerciseName = prompt.exerciseName;
  const belowTarget = isBelowTarget(prompt.performanceRatio);

  // The card unmounts a render later; a quick second tap must not send twice.
  const submittedRef = useRef(false);
  const submit = (effort: EffortRating, painFlag: PainFlag) => {
    if (submittedRef.current) return;
    submittedRef.current = true;
    onSubmit(
      buildFeedbackPayload(prompt, {
        effort,
        pain: painFlag,
        intent: intent === "hold" ? "hold" : undefined,
        notes,
      }),
    );
  };

  const chip = (
    key: string,
    label: string,
    onPress: () => void,
    selected?: boolean,
  ) => (
    <TouchableOpacity
      key={key}
      testID={`feedback-${key}`}
      onPress={onPress}
      activeOpacity={0.7}
      accessibilityRole={selected === undefined ? "button" : "radio"}
      accessibilityState={selected === undefined ? undefined : { selected }}
      style={[styles.chip, selected && styles.chipSelected]}
    >
      <ThemedText
        style={[styles.chipLabel, selected && styles.chipLabelSelected]}
      >
        {label}
      </ThemedText>
    </TouchableOpacity>
  );

  const link = (label: string, open: boolean, onPress: () => void) => (
    <TouchableOpacity
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ expanded: open }}
      hitSlop={8}
    >
      <ThemedText style={styles.link}>{label}</ThemedText>
    </TouchableOpacity>
  );

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <ThemedText style={styles.question} accessibilityRole="header">
          {belowTarget
            ? t`${exerciseName}: any pain or discomfort?`
            : t`${exerciseName}: how did that feel?`}
        </ThemedText>
        {onSkip && (
          <TouchableOpacity
            onPress={onSkip}
            accessibilityRole="button"
            accessibilityLabel={t`Skip feedback for ${exerciseName}`}
            hitSlop={8}
          >
            <ThemedText style={styles.link}>{t`Skip`}</ThemedText>
          </TouchableOpacity>
        )}
      </View>

      {!belowTarget && painOpen && (
        <View style={styles.section}>
          <View style={styles.chipRow}>
            {getPainOptions().map((opt) =>
              chip(
                `pain-${opt.value}`,
                opt.label,
                () => setPain(opt.value),
                pain === opt.value,
              ),
            )}
          </View>
          {pain === "pain" && (
            <TextInput
              accessibilityLabel={t`Where did you feel it?`}
              style={styles.input}
              placeholder={t`Where did you feel it? (optional)`}
              placeholderTextColor={colors.contentSecondary}
              value={notes}
              onChangeText={setNotes}
              maxLength={120}
            />
          )}
        </View>
      )}

      {!belowTarget && moreOpen && (
        <View style={styles.section}>
          <ThemedText style={styles.label}>
            {t`If it was about right, next time:`}
          </ThemedText>
          <View style={styles.chipRow}>
            {getIntentOptions().map((opt) =>
              chip(
                `intent-${opt.value}`,
                opt.label,
                () => setIntent(opt.value),
                intent === opt.value,
              ),
            )}
          </View>
        </View>
      )}

      <View style={styles.chipRow}>
        {belowTarget
          ? getBelowTargetOptions().map((opt) =>
              chip(opt.key, opt.label, () => submit(opt.effort, opt.pain)),
            )
          : getEffortOptions().map((opt) =>
              chip(opt.value, opt.label, () => submit(opt.value, pain)),
            )}
      </View>

      {!belowTarget && (
        <View style={styles.links}>
          {link(t`Any pain?`, painOpen, () => {
            // A collapsed choice is not sent: only what is on screen counts.
            if (painOpen) setPain("none");
            setPainOpen(!painOpen);
          })}
          {link(t`More`, moreOpen, () => setMoreOpen((v) => !v))}
        </View>
      )}
    </View>
  );
}

function createStyles(colors: AppThemeColors) {
  return StyleSheet.create({
    card: {
      backgroundColor: colors.cardSecondary,
      borderRadius: radii.md,
      padding: 12,
      gap: 10,
    },
    header: {
      flexDirection: "row",
      alignItems: "flex-start",
      justifyContent: "space-between",
      gap: 12,
    },
    question: {
      flex: 1,
      fontSize: 15,
      fontWeight: "600",
      color: colors.contentPrimary,
    },
    section: {
      gap: 8,
    },
    label: {
      fontSize: 13,
      color: colors.contentSecondary,
    },
    chipRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
    },
    chip: {
      borderRadius: radii.xl,
      borderWidth: 1.5,
      borderColor: colors.accentBorder,
      backgroundColor: colors.surfaceHighlight,
      paddingHorizontal: 14,
      paddingVertical: 8,
      minHeight: 40,
      justifyContent: "center",
    },
    chipSelected: {
      backgroundColor: colors.accent,
      borderColor: colors.accent,
    },
    chipLabel: {
      fontSize: 14,
      fontWeight: "500",
      color: colors.contentPrimary,
    },
    chipLabelSelected: {
      color: colors.onAccent,
    },
    links: {
      flexDirection: "row",
      gap: 20,
    },
    link: {
      fontSize: 14,
      fontWeight: "600",
      color: colors.accent,
    },
    input: {
      borderWidth: 1,
      borderColor: colors.accentBorder,
      borderRadius: radii.md,
      paddingHorizontal: 12,
      paddingVertical: 8,
      fontSize: 14,
      color: colors.contentPrimary,
    },
  });
}
