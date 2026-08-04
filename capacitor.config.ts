import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Booloobee Ranch — iOS-first (landscape locked in Info.plist via
 * scripts/patch-ios-landscape.mjs after `npx cap add ios`).
 *
 * Mac one-liner:  npm run ios:setup
 */
const config: CapacitorConfig = {
  appId: "com.instilligent.booloobee",
  appName: "Booloobee Ranch",
  webDir: "dist",
  server: {
    androidScheme: "https",
  },
  ios: {
    contentInset: "automatic",
    preferredContentMode: "mobile",
    backgroundColor: "#1a1028",
    scheme: "Booloobee Ranch",
  },
  android: {
    allowMixedContent: true,
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: true,
      backgroundColor: "#1a1028",
      showSpinner: false,
    },
  },
};

export default config;
