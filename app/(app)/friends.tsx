import React, { useState, useContext } from "react";
import {
  View,
  FlatList,
  TextInput,
  StyleSheet,
  ScrollView,
} from "react-native";
import { Button, Avatar } from "react-native-paper";
import { Stack, useRouter } from "expo-router";
import Bugsnag from "@bugsnag/expo";
import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { AppText, AppIcon } from "@/components/ui";
import { useAppTheme } from "@/theme";
import { AuthContext } from "@/context/AuthProvider";
import { useSocialStore } from "@/store/socialStore";
import type { PendingRequest, SentRequest } from "@/store/socialStore";
import { FriendListItem } from "@/components/friends/FriendListItem";
import { FriendRequestItem } from "@/components/friends/FriendRequestItem";
import { useSendFriendRequestMutation } from "@/hooks/useSendFriendRequestMutation";
import { searchUserByEmail } from "@/utils/friends";
import type { UserSearchResult } from "@/utils/friends";
import type { FriendInfo } from "@/types/firestore";
import type { AppThemeColors, AppThemeBorders } from "@/theme/types";

type Tab = "friends" | "search" | "requests";

export default function FriendsScreen() {
  const { colors, borders } = useAppTheme();
  const router = useRouter();
  const user = useContext(AuthContext);
  const { friends, pendingRequests, sentRequests } = useSocialStore();
  const [activeTab, setActiveTab] = useState<Tab>("friends");

  if (!user) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <Stack.Screen options={{ title: t`Friends` }} />
        <AppText
          variant="body"
          style={{
            color: colors.contentSecondary,
            textAlign: "center",
            marginBottom: 16,
          }}
        >
          <Trans>Sign in to use the Friends feature.</Trans>
        </AppText>
        <Button mode="contained" onPress={() => router.push("/login")}>
          <Trans>Sign In</Trans>
        </Button>
      </View>
    );
  }

  const tabs: { key: Tab; label: string; badge?: number }[] = [
    { key: "friends", label: t`Friends` },
    { key: "search", label: t`Search` },
    {
      key: "requests",
      label: t`Requests`,
      badge: pendingRequests.length || undefined,
    },
  ];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Stack.Screen options={{ title: t`Friends` }} />

      {/* Internal tab bar */}
      <View style={[styles.tabBar, { borderBottomColor: borders.divider }]}>
        {tabs.map(({ key, label, badge }) => {
          const isActive = activeTab === key;
          return (
            <Button
              key={key}
              mode={isActive ? "contained" : "text"}
              compact
              onPress={() => setActiveTab(key)}
              style={styles.tabButton}
            >
              {label}
              {badge ? ` (${badge})` : ""}
            </Button>
          );
        })}
      </View>

      {activeTab === "friends" && (
        <FriendsTab
          friends={friends}
          onFriendPress={(uid) => {
            router.push({
              pathname: "/(app)/friend-profile",
              params: { friendUid: uid },
            } as unknown as Parameters<typeof router.push>[0]);
          }}
          colors={colors}
        />
      )}
      {activeTab === "search" && (
        <SearchTab currentUid={user.uid} colors={colors} borders={borders} />
      )}
      {activeTab === "requests" && (
        <RequestsTab
          pendingRequests={pendingRequests}
          sentRequests={sentRequests}
          colors={colors}
          borders={borders}
        />
      )}
    </View>
  );
}

interface FriendsTabProps {
  friends: FriendInfo[];
  onFriendPress: (uid: string) => void;
  colors: AppThemeColors;
}

function FriendsTab({ friends, onFriendPress, colors }: FriendsTabProps) {
  if (friends.length === 0) {
    return (
      <View style={styles.centered}>
        <AppIcon
          set="ion"
          name="people-outline"
          size={48}
          color={colors.contentSecondary}
        />
        <AppText
          variant="body"
          style={{
            color: colors.contentSecondary,
            marginTop: 12,
            textAlign: "center",
          }}
        >
          <Trans>No friends yet. Search by email to add someone.</Trans>
        </AppText>
      </View>
    );
  }

  return (
    <FlatList
      data={friends}
      keyExtractor={(item: FriendInfo) => item.uid}
      renderItem={({ item }: { item: FriendInfo }) => (
        <FriendListItem friend={item} onPress={onFriendPress} />
      )}
    />
  );
}

interface SearchTabProps {
  currentUid: string;
  colors: AppThemeColors;
  borders: AppThemeBorders;
}

function SearchTab({ currentUid, colors, borders }: SearchTabProps) {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  // undefined = no search yet, null = not found, UserSearchResult = found
  const [result, setResult] = useState<UserSearchResult | null | undefined>(
    undefined,
  );
  const [requestSent, setRequestSent] = useState(false);
  const [searchError, setSearchError] = useState(false);
  const sendMutation = useSendFriendRequestMutation();
  const { friends, sentRequests } = useSocialStore();

  const isFriend = result ? friends.some((f) => f.uid === result.uid) : false;
  const hasPendingSent = result
    ? sentRequests.some((r) => r.toUid === result.uid)
    : false;

  const handleSearch = async () => {
    if (!email.trim()) return;
    setLoading(true);
    setResult(undefined);
    setRequestSent(false);
    setSearchError(false);
    try {
      const found = await searchUserByEmail(email, currentUid);
      setResult(found);
    } catch (error) {
      Bugsnag.notify(error as Error);
      setSearchError(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.searchContainer}>
      <View style={styles.searchRow}>
        <TextInput
          style={[
            styles.input,
            { color: colors.contentPrimary, borderColor: borders.divider },
          ]}
          placeholder={t`Email address`}
          placeholderTextColor={colors.contentSecondary}
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          returnKeyType="search"
          onSubmitEditing={handleSearch}
        />
        <Button mode="contained" onPress={handleSearch} loading={loading}>
          <Trans>Search</Trans>
        </Button>
      </View>

      {result === null && (
        <AppText
          variant="body"
          style={{ color: colors.contentSecondary, marginTop: 16 }}
        >
          <Trans>No user found with that email address.</Trans>
        </AppText>
      )}

      {searchError && (
        <AppText
          variant="caption"
          style={{ color: colors.danger, marginTop: 16 }}
        >
          <Trans>Something went wrong. Please try again.</Trans>
        </AppText>
      )}

      {result != null && (
        <View style={[styles.resultCard, { borderColor: borders.divider }]}>
          {result.photoURL ? (
            <Avatar.Image size={44} source={{ uri: result.photoURL }} />
          ) : (
            <Avatar.Text
              size={44}
              label={result.displayName.charAt(0).toUpperCase()}
            />
          )}
          <View style={{ flex: 1 }}>
            <AppText variant="body" style={{ color: colors.contentPrimary }}>
              {result.displayName}
            </AppText>
            <AppText
              variant="caption"
              style={{ color: colors.contentSecondary }}
            >
              {result.email}
            </AppText>
          </View>
          {isFriend ? (
            <AppText variant="caption" style={{ color: colors.success }}>
              <Trans>Friends</Trans>
            </AppText>
          ) : requestSent || hasPendingSent ? (
            <AppText
              variant="caption"
              style={{ color: colors.contentSecondary }}
            >
              <Trans>Sent</Trans>
            </AppText>
          ) : (
            <Button
              mode="contained"
              compact
              loading={sendMutation.isPending}
              onPress={() =>
                sendMutation.mutate(result.uid, {
                  onSuccess: () => setRequestSent(true),
                })
              }
            >
              <Trans>Add</Trans>
            </Button>
          )}
        </View>
      )}
    </View>
  );
}

interface RequestsTabProps {
  pendingRequests: PendingRequest[];
  sentRequests: SentRequest[];
  colors: AppThemeColors;
  borders: AppThemeBorders;
}

function RequestsTab({
  pendingRequests,
  sentRequests,
  colors,
  borders,
}: RequestsTabProps) {
  if (pendingRequests.length === 0 && sentRequests.length === 0) {
    return (
      <View style={styles.centered}>
        <AppText variant="body" style={{ color: colors.contentSecondary }}>
          <Trans>No pending friend requests.</Trans>
        </AppText>
      </View>
    );
  }

  return (
    <ScrollView>
      {pendingRequests.length > 0 && (
        <>
          <AppText
            variant="label"
            style={[styles.sectionHeader, { color: colors.contentSecondary }]}
          >
            <Trans>Incoming</Trans>
          </AppText>
          {pendingRequests.map((req) => (
            <FriendRequestItem key={req.id} request={req} />
          ))}
        </>
      )}
      {sentRequests.length > 0 && (
        <>
          <AppText
            variant="label"
            style={[styles.sectionHeader, { color: colors.contentSecondary }]}
          >
            <Trans>Sent</Trans>
          </AppText>
          {sentRequests.map((req) => (
            <View
              key={req.id}
              style={[styles.sentRow, { borderBottomColor: borders.divider }]}
            >
              {req.photoURL ? (
                <Avatar.Image size={44} source={{ uri: req.photoURL }} />
              ) : (
                <Avatar.Text
                  size={44}
                  label={req.displayName.charAt(0).toUpperCase()}
                />
              )}
              <View style={{ flex: 1 }}>
                <AppText
                  variant="body"
                  style={{ color: colors.contentPrimary }}
                >
                  {req.displayName}
                </AppText>
                <AppText
                  variant="caption"
                  style={{ color: colors.contentSecondary }}
                >
                  {req.email}
                </AppText>
              </View>
              <AppText
                variant="caption"
                style={{ color: colors.contentSecondary }}
              >
                <Trans>Pending</Trans>
              </AppText>
            </View>
          ))}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
    gap: 8,
  },
  tabBar: {
    flexDirection: "row",
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  tabButton: { flex: 1 },
  searchContainer: { padding: 16 },
  searchRow: { flexDirection: "row", gap: 8, alignItems: "center" },
  input: {
    flex: 1,
    height: 44,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 15,
  },
  resultCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 16,
    padding: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 8,
  },
  sectionHeader: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 6,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  sentRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
});
