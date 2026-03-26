import { useEffect } from "react";
import { ActivityIndicator, View } from "react-native";
import { Redirect, useLocalSearchParams } from "expo-router";
import { useSession } from "../src/state/session";
import { colors } from "../src/theme/tokens";

export default function AuthCallbackScreen() {
  const { sessionToken } = useLocalSearchParams<{ sessionToken?: string }>();
  const { setToken } = useSession();

  useEffect(() => {
    if (typeof sessionToken === "string" && sessionToken.length > 0) {
      void setToken(sessionToken);
    }
  }, [sessionToken, setToken]);

  if (typeof sessionToken === "string" && sessionToken.length > 0) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background }}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return <Redirect href="/signin" />;
}
