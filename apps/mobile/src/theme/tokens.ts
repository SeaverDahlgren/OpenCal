export const colors = {
  background: "#060e20",
  backgroundGlow: "#0c1731",
  surface: "#091328",
  surfaceHigh: "#141f38",
  surfaceHighest: "#192540",
  primary: "#87adff",
  primaryDim: "#6f9fff",
  secondary: "#cfdef5",
  tertiary: "#a1faff",
  text: "#dee5ff",
  textMuted: "#a3aac4",
  outlineGhost: "rgba(64, 72, 93, 0.15)",
  error: "#ff716c",
};

export const spacing = {
  xs: 8,
  sm: 12,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 40,
};

export const radii = {
  md: 12,
  lg: 20,
  xl: 28,
  full: 999,
};

export const typography = {
  eyebrow: {
    fontSize: 12,
    fontWeight: "700" as const,
    letterSpacing: 2,
  },
  title: {
    fontSize: 36,
    fontWeight: "800" as const,
  },
  section: {
    fontSize: 22,
    fontWeight: "700" as const,
  },
  body: {
    fontSize: 16,
    lineHeight: 22,
  },
  label: {
    fontSize: 12,
    fontWeight: "700" as const,
    letterSpacing: 1,
  },
};
