import React, { useMemo } from "react";
import {
  FlatList,
  StyleSheet,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import TrainingPlanCard from "@/components/TrainingPlanCard";
import TrainingPlanListItem from "@/components/TrainingPlanListItem";
import { ThemedText } from "@/components/ThemedText";
import { AppIcon } from "@/components/ui";
import { Plan } from "@/hooks/useAllPlansQuery";
import { Trans } from "@lingui/react/macro";
import { useAppTheme } from "@/theme";
import type { AppThemeColors } from "@/theme/types";

export type PlanViewMode = "carousel" | "list" | "grid";

interface PlanListProps {
  title: string;
  data: Plan[] | undefined | any;
  onPressItem: (item: any) => void;
  viewMode?: PlanViewMode;
  showViewToggle?: boolean;
  onViewModeChange?: (mode: PlanViewMode) => void;
  publishedPlanIds?: string[];
  sharePlansEnabled?: boolean;
}

export const PlanList: React.FC<PlanListProps> = ({
  title,
  data,
  onPressItem,
  viewMode = "carousel",
  showViewToggle = false,
  onViewModeChange,
  publishedPlanIds,
  sharePlansEnabled,
}) => {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { width: screenWidth } = useWindowDimensions();
  const gridCardWidth = Math.floor((screenWidth - 22) / 2) - 10;

  const renderContent = () => {
    if (!data || data.length === 0) {
      return (
        <ThemedText style={styles.noPlansText}>
          <Trans>No training plans found</Trans>
        </ThemedText>
      );
    }

    if (viewMode === "list") {
      return (
        <View style={styles.listContainer}>
          {data.map((item: Plan, index: number) => (
            <TrainingPlanListItem
              key={item.id?.toString() ?? index.toString()}
              plan={item}
              onPress={() => onPressItem(item)}
              isPublished={
                !!sharePlansEnabled &&
                !!publishedPlanIds?.includes(String(item.id))
              }
            />
          ))}
        </View>
      );
    }

    if (viewMode === "grid") {
      return (
        <View style={styles.gridContainer}>
          {data.map((item: Plan, index: number) => (
            <View
              key={item.id?.toString() ?? index.toString()}
              style={styles.gridItem}
            >
              <TrainingPlanCard
                title={item.name}
                imageUrl={item.image_url}
                onPress={() => onPressItem(item)}
                isActive={item.is_active === 1}
                isPublished={
                  !!sharePlansEnabled &&
                  !!publishedPlanIds?.includes(String(item.id))
                }
                width={gridCardWidth}
              />
            </View>
          ))}
        </View>
      );
    }

    return (
      <FlatList
        horizontal={true}
        contentContainerStyle={styles.scrollViewContainer}
        snapToInterval={320}
        snapToAlignment="start"
        data={data}
        showsHorizontalScrollIndicator={false}
        renderItem={({ item }: { item: Plan }) => (
          <TrainingPlanCard
            title={item.name}
            imageUrl={item.image_url}
            onPress={() => onPressItem(item)}
            isActive={item.is_active === 1}
            isPublished={
              !!sharePlansEnabled &&
              !!publishedPlanIds?.includes(String(item.id))
            }
          />
        )}
        keyExtractor={(item: any, index: number) => index.toString()}
      />
    );
  };

  return (
    <>
      <View style={styles.titleRow}>
        <ThemedText style={styles.sectionTitle}>{title}</ThemedText>
        {showViewToggle && onViewModeChange && (
          <View style={styles.toggleButtons}>
            <TouchableOpacity
              onPress={() => onViewModeChange("carousel")}
              style={styles.toggleButton}
              accessibilityRole="button"
              accessibilityLabel="Switch to carousel view"
              accessibilityState={{ selected: viewMode === "carousel" }}
            >
              <AppIcon
                set="mci"
                name="view-carousel"
                size={22}
                color={
                  viewMode === "carousel" ? "active" : colors.contentSecondary
                }
              />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => onViewModeChange("list")}
              style={styles.toggleButton}
              accessibilityRole="button"
              accessibilityLabel="Switch to list view"
              accessibilityState={{ selected: viewMode === "list" }}
            >
              <AppIcon
                set="mci"
                name="view-list"
                size={22}
                color={viewMode === "list" ? "active" : colors.contentSecondary}
              />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => onViewModeChange("grid")}
              style={styles.toggleButton}
              accessibilityRole="button"
              accessibilityLabel="Switch to grid view"
              accessibilityState={{ selected: viewMode === "grid" }}
            >
              <AppIcon
                set="mci"
                name="view-grid"
                size={22}
                color={viewMode === "grid" ? "active" : colors.contentSecondary}
              />
            </TouchableOpacity>
          </View>
        )}
      </View>
      {renderContent()}
    </>
  );
};

function createStyles(colors: AppThemeColors) {
  return StyleSheet.create({
    titleRow: {
      flexDirection: "row",
      alignItems: "center",
      marginTop: 10,
      marginLeft: 20,
      marginRight: 12,
    },
    sectionTitle: {
      flex: 1,
      fontSize: 18,
      fontWeight: "600",
    },
    toggleButtons: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
    },
    toggleButton: {
      padding: 4,
    },
    scrollViewContainer: {
      justifyContent: "space-between",
      padding: 8,
    },
    listContainer: {
      paddingHorizontal: 16,
      paddingTop: 8,
    },
    gridContainer: {
      flexDirection: "row",
      flexWrap: "wrap",
      paddingLeft: 6,
      paddingRight: 16,
      paddingTop: 4,
    },
    gridItem: {
      width: "50%",
    },
    noPlansText: {
      textAlign: "center",
      marginTop: 50,
      marginBottom: 20,
    },
  });
}
