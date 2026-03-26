import { Redirect } from "expo-router";
import { ActivityIndicator, View } from "react-native";
import { useSession } from "../src/state/session";
import { colors } from "../src/theme/tokens";

export default function Index() {
  const { loading, token } = useSession();

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background }}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return <Redirect href={token ? "/(tabs)/today" : "/signin"} />;
}
