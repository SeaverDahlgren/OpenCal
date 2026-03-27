const appName = process.env.EXPO_PUBLIC_APP_NAME ?? "OpenCal";
const slug = process.env.EXPO_PUBLIC_APP_SLUG ?? "opencal";
const version = process.env.EXPO_PUBLIC_APP_VERSION ?? "1.0.0";
const scheme = process.env.EXPO_PUBLIC_APP_SCHEME ?? "opencal";
const apiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8787/api/v1";
const supportEmail = process.env.EXPO_PUBLIC_BETA_HELP_EMAIL ?? "";
const owner = process.env.EXPO_OWNER;
const projectId = process.env.EXPO_PROJECT_ID;
const iosBundleIdentifier = process.env.OPENCAL_IOS_BUNDLE_ID ?? "com.opencal.app";
const androidPackage = process.env.OPENCAL_ANDROID_PACKAGE ?? "com.opencal.app";
const associatedDomains = (process.env.OPENCAL_ASSOCIATED_DOMAINS ?? "")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);

export default {
  expo: {
    name: appName,
    slug,
    version,
    scheme,
    owner,
    orientation: "portrait",
    userInterfaceStyle: "dark",
    plugins: ["expo-router"],
    experiments: {
      typedRoutes: true,
    },
    runtimeVersion: {
      policy: "appVersion",
    },
    updates: {
      enabled: true,
      fallbackToCacheTimeout: 0,
    },
    ios: {
      supportsTablet: false,
      bundleIdentifier: iosBundleIdentifier,
      associatedDomains,
    },
    android: {
      package: androidPackage,
    },
    extra: {
      apiBaseUrl,
      supportEmail,
      eas: projectId
        ? {
            projectId,
          }
        : undefined,
    },
  },
};
