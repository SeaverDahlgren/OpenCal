import { StyleSheet, View } from "react-native";
import { colors } from "../theme/tokens";

export function AppLogo({
  size = 44,
  centered = false,
}: {
  size?: number;
  centered?: boolean;
}) {
  const shellSize = Math.max(24, size);
  const coreSize = Math.round(shellSize * 0.46);
  const ringInset = Math.round(shellSize * 0.12);
  const tabWidth = Math.max(6, Math.round(shellSize * 0.18));
  const tabHeight = Math.max(8, Math.round(shellSize * 0.18));
  const signalWidth = Math.max(12, Math.round(shellSize * 0.34));
  const signalHeight = Math.max(4, Math.round(shellSize * 0.08));

  return (
    <View style={[styles.wrap, centered && styles.centered, { width: shellSize, height: shellSize }]}>
      <View style={[styles.tab, styles.leftTab, { width: tabWidth, height: tabHeight }]} />
      <View style={[styles.tab, styles.rightTab, { width: tabWidth, height: tabHeight }]} />
      <View style={[styles.shell, { borderRadius: shellSize * 0.32 }]}>
        <View
          style={[
            styles.ring,
            {
              top: ringInset,
              right: ringInset,
              bottom: ringInset,
              left: ringInset,
              borderRadius: shellSize,
            },
          ]}
        />
        <View
          style={[
            styles.core,
            {
              width: coreSize,
              height: coreSize,
              borderRadius: coreSize / 2,
            },
          ]}
        />
        <View style={styles.signalWrap}>
          <View style={[styles.signalBar, { width: signalWidth, height: signalHeight }]} />
          <View style={[styles.signalBar, { width: Math.round(signalWidth * 0.68), height: signalHeight }]} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "relative",
  },
  centered: {
    alignSelf: "center",
  },
  shell: {
    flex: 1,
    backgroundColor: colors.surfaceHigh,
    borderWidth: 1,
    borderColor: "rgba(161, 250, 255, 0.28)",
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  tab: {
    position: "absolute",
    top: -4,
    borderRadius: 999,
    backgroundColor: colors.tertiary,
    zIndex: 2,
  },
  leftTab: {
    left: 9,
  },
  rightTab: {
    right: 9,
  },
  ring: {
    position: "absolute",
    borderWidth: 1.5,
    borderColor: "rgba(135, 173, 255, 0.7)",
  },
  core: {
    backgroundColor: colors.primary,
    shadowColor: colors.tertiary,
    shadowOpacity: 0.35,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
  },
  signalWrap: {
    position: "absolute",
    bottom: 9,
    alignItems: "center",
    gap: 3,
  },
  signalBar: {
    borderRadius: 999,
    backgroundColor: "rgba(161, 250, 255, 0.92)",
  },
});
