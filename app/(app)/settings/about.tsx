import { Linking } from "react-native";
import { Trans } from "@lingui/react/macro";
import { SettingRow, SettingsScroll } from "@/components/settings/SettingRow";
import { demoMode } from "@/dev/demo/gate";

export default function AboutSettingsScreen() {
  return (
    <SettingsScroll>
      <SettingRow
        id="featureRequests"
        icon="vote"
        title={<Trans>Request or vote for new features</Trans>}
        onPress={() =>
          Linking.openURL("https://www.featurize.io/p/musclequest")
        }
      />
      <SettingRow
        icon="coffee"
        title={<Trans>Buy me a coffee</Trans>}
        onPress={() => Linking.openURL("https://buymeacoffee.com/musclequest")}
      />
      <SettingRow
        icon="web"
        title={<Trans>MuscleQuest.app</Trans>}
        onPress={() => Linking.openURL("https://musclequest.app")}
      />
      <SettingRow
        icon="instagram"
        title={<Trans>Follow MuscleQuest on Instagram</Trans>}
        onPress={() =>
          Linking.openURL("https://www.instagram.com/musclequest.app/")
        }
      />
      <SettingRow
        icon="account"
        title={<Trans>About the developer</Trans>}
        onPress={() => Linking.openURL("https://joseph.bouqdib.com")}
      />
      <SettingRow
        id="privacyPolicy"
        icon="shield-lock"
        title={<Trans>Privacy policy</Trans>}
        onPress={() =>
          Linking.openURL("https://musclequest.app/privacy-policy")
        }
      />
      {demoMode && <demoMode.DemoDataSection />}
    </SettingsScroll>
  );
}
