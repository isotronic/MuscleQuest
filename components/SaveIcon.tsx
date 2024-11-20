import { MaterialCommunityIcons } from "@expo/vector-icons";
import { IconProps } from "react-native-paper/lib/typescript/components/MaterialCommunityIcon";

const SaveIcon = (props: IconProps) => (
  <MaterialCommunityIcons {...props} size={25} name="content-save-outline" />
);

export default SaveIcon;
