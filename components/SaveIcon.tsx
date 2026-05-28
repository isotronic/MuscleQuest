import { AppIcon } from "@/components/ui";
import { IconProps } from "react-native-paper/lib/typescript/components/MaterialCommunityIcon";

const SaveIcon = ({ size, color, testID }: IconProps) => (
  <AppIcon
    set="mci"
    name="content-save-outline"
    size={size}
    color={color}
    testID={testID}
  />
);

export default SaveIcon;
