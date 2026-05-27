import React, { useMemo } from "react";
import { StyleSheet } from "react-native";
import type { StyleProp } from "react-native/Libraries/StyleSheet/StyleSheet";
import type { ViewStyle } from "react-native/Libraries/StyleSheet/StyleSheetTypes";
import { Dropdown, MultiSelect } from "react-native-element-dropdown";
import { useAppTheme } from "@/theme";
import { radii } from "@/theme";

export interface SelectOption {
  label: string;
  value: string;
}

interface AppSelectBaseProps {
  data: SelectOption[];
  placeholder?: string;
  searchable?: boolean;
  style?: StyleProp<ViewStyle>;
  renderItem?: (item: SelectOption, selected?: boolean) => React.ReactElement;
  autoScroll?: boolean;
}

interface AppSelectSingleProps extends AppSelectBaseProps {
  multiple?: false;
  value: string | null;
  onChange: (value: string) => void;
}

interface AppSelectMultiProps extends AppSelectBaseProps {
  multiple: true;
  value: string[];
  onChange: (values: string[]) => void;
}

type AppSelectProps = AppSelectSingleProps | AppSelectMultiProps;

export function AppSelect(props: AppSelectProps) {
  const { inputs, colors } = useAppTheme();

  const styles = useMemo(
    () =>
      createStyles(
        inputs.dropdownBg,
        inputs.dropdownText,
        inputs.dropdownBorder,
        colors.surface,
      ),
    [inputs, colors.surface],
  );

  const sharedProps = {
    data: props.data,
    labelField: "label" as const,
    valueField: "value" as const,
    placeholder: props.placeholder,
    placeholderStyle: styles.placeholder,
    style: [styles.dropdown, props.style],
    containerStyle: styles.container,
    selectedTextStyle: styles.selectedText,
    itemTextStyle: styles.itemText,
    renderItem: props.renderItem,
    autoScroll: props.autoScroll ?? false,
    search: props.searchable ?? false,
    inputSearchStyle: styles.searchInput,
  };

  if (props.multiple) {
    return (
      <MultiSelect
        {...sharedProps}
        value={props.value}
        onChange={props.onChange}
      />
    );
  }

  return (
    <Dropdown
      {...sharedProps}
      value={props.value}
      onChange={(item: SelectOption) => props.onChange(item.value)}
    />
  );
}

function createStyles(
  dropdownBg: string,
  dropdownText: string,
  dropdownBorder: string,
  searchBg: string,
) {
  return StyleSheet.create({
    dropdown: {
      backgroundColor: dropdownBg,
      borderRadius: radii.md,
      height: 50,
      paddingHorizontal: 8,
    },
    container: {
      backgroundColor: dropdownBg,
      borderColor: dropdownBorder,
      borderRadius: radii.md,
      padding: 4,
      elevation: 4,
    },
    placeholder: {
      color: dropdownText,
      fontSize: 14,
    },
    selectedText: {
      color: dropdownText,
      fontSize: 14,
    },
    itemText: {
      color: dropdownText,
      fontSize: 14,
    },
    searchInput: {
      color: dropdownText,
      fontSize: 14,
      backgroundColor: searchBg,
      borderRadius: radii.sm,
    },
  });
}
