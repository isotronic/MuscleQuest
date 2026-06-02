import React from "react";
import { View, Pressable, StyleSheet, Alert } from "react-native";
import { Avatar } from "react-native-paper";
import { AppText, AppIcon } from "@/components/ui";
import { useAppTheme } from "@/theme";
import { FriendInfo } from "@/types/firestore";
import { useRemoveFriendMutation } from "@/hooks/useRemoveFriendMutation";
import { t } from "@lingui/core/macro";

interface Props {
  friend: FriendInfo;
  onPress: (uid: string) => void;
}

export const FriendListItem = ({ friend, onPress }: Props) => {
  const { colors, borders } = useAppTheme();
  const removeMutation = useRemoveFriendMutation();

  const handleLongPress = () => {
    Alert.alert(
      friend.displayName,
      t`Remove this friend? They will no longer be able to see your shared content.`,
      [
        { text: t`Cancel`, style: "cancel" },
        {
          text: t`Remove`,
          style: "destructive",
          onPress: () => removeMutation.mutate(friend.uid),
        },
      ],
    );
  };

  return (
    <Pressable
      onPress={() => onPress(friend.uid)}
      onLongPress={handleLongPress}
      style={[styles.container, { borderBottomColor: borders.divider }]}
    >
      {friend.photoURL ? (
        <Avatar.Image size={44} source={{ uri: friend.photoURL }} />
      ) : (
        <Avatar.Text
          size={44}
          label={friend.displayName.charAt(0).toUpperCase()}
        />
      )}
      <View style={styles.info}>
        <AppText variant="body" style={{ color: colors.contentPrimary }}>
          {friend.displayName}
        </AppText>
        <AppText variant="caption" style={{ color: colors.contentSecondary }}>
          {friend.email}
        </AppText>
      </View>
      <AppIcon
        set="ion"
        name="chevron-forward"
        size={16}
        color={colors.contentSecondary}
      />
    </Pressable>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  info: { flex: 1 },
});
