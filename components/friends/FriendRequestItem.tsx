import React from "react";
import { View, StyleSheet } from "react-native";
import { Avatar, Button } from "react-native-paper";
import { AppText } from "@/components/ui";
import { useAppTheme } from "@/theme";
import { PendingRequest } from "@/store/socialStore";
import { useAcceptFriendRequestMutation } from "@/hooks/useAcceptFriendRequestMutation";
import { useDeclineFriendRequestMutation } from "@/hooks/useDeclineFriendRequestMutation";
import { t } from "@lingui/core/macro";

interface Props {
  request: PendingRequest;
}

export const FriendRequestItem = ({ request }: Props) => {
  const { colors, borders } = useAppTheme();
  const acceptMutation = useAcceptFriendRequestMutation();
  const declineMutation = useDeclineFriendRequestMutation();
  const isBusy = acceptMutation.isPending || declineMutation.isPending;

  return (
    <View style={[styles.container, { borderBottomColor: borders.divider }]}>
      {request.photoURL ? (
        <Avatar.Image size={44} source={{ uri: request.photoURL }} />
      ) : (
        <Avatar.Text
          size={44}
          label={request.displayName.charAt(0).toUpperCase()}
        />
      )}
      <View style={styles.info}>
        <AppText variant="body" style={{ color: colors.contentPrimary }}>
          {request.displayName}
        </AppText>
        <AppText variant="caption" style={{ color: colors.contentSecondary }}>
          {request.email}
        </AppText>
      </View>
      <View style={styles.actions}>
        <Button
          mode="contained"
          compact
          disabled={isBusy}
          loading={acceptMutation.isPending}
          onPress={() => acceptMutation.mutate(request.fromUid)}
        >
          {t`Accept`}
        </Button>
        <Button
          mode="outlined"
          compact
          disabled={isBusy}
          loading={declineMutation.isPending}
          onPress={() => declineMutation.mutate(request.fromUid)}
        >
          {t`Decline`}
        </Button>
      </View>
    </View>
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
  actions: { flexDirection: "row", gap: 8 },
});
