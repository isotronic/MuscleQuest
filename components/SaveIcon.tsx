import { AppIcon } from "@/components/ui";
interface SaveIconProps {
  size: number;
  color: string;
  testID?: string;
}

const SaveIcon = ({ size, color, testID }: SaveIconProps) => (
  <AppIcon
    set="mci"
    name="content-save-outline"
    size={size}
    color={color}
    testID={testID}
  />
);

export default SaveIcon;
