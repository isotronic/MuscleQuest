import React from "react";
import {
  ScrollView,
  TouchableOpacity,
  Text,
  StyleSheet,
  View,
} from "react-native";
import { Colors } from "@/constants/Colors";
import type { AutocompleteSuggestion } from "@/utils/exerciseSearch";

interface ExerciseSuggestionsProps {
  suggestions: AutocompleteSuggestion[];
  query: string;
  onSelect: (suggestion: AutocompleteSuggestion) => void;
}

export default function ExerciseSuggestions({
  suggestions,
  query,
  onSelect,
}: ExerciseSuggestionsProps) {
  if (suggestions.length === 0) return null;

  const normalizedQuery = query.trim().toLowerCase();

  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.scrollContent}
      >
        {suggestions.map((suggestion) => {
          const lower = suggestion.text.toLowerCase();
          const matchStart = lower.indexOf(normalizedQuery);
          const hasPrefix = matchStart === 0 && normalizedQuery.length > 0;

          return (
            <TouchableOpacity
              key={suggestion.exerciseId}
              style={styles.chip}
              onPress={() => onSelect(suggestion)}
              activeOpacity={0.7}
            >
              {hasPrefix ? (
                <Text style={styles.chipText} numberOfLines={1}>
                  <Text style={styles.bold}>
                    {suggestion.text.slice(0, normalizedQuery.length)}
                  </Text>
                  {suggestion.text.slice(normalizedQuery.length)}
                </Text>
              ) : (
                <Text style={styles.chipText} numberOfLines={1}>
                  {suggestion.text}
                </Text>
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.dark.screenBackground,
    borderBottomWidth: 1,
    borderBottomColor: Colors.dark.cardBackground,
  },
  scrollContent: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    gap: 6,
  },
  chip: {
    backgroundColor: Colors.dark.cardBackground,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    maxWidth: 200,
  },
  chipText: {
    color: Colors.dark.text,
    fontSize: 13,
  },
  bold: {
    fontWeight: "700",
    color: Colors.dark.tint,
  },
});
