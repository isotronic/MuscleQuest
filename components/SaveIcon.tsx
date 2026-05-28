import { AppIcon } from "@/components/ui";
import { IconProps } from "react-native-paper/lib/typescript/components/MaterialCommunityIcon";

const SaveIcon = (props: IconProps) => (
  <AppIcon
    set="mci"
    name="content-save-outline"
    size={props.size}
    color={props.color}
  />
);

export default SaveIcon;
