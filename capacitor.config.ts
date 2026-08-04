import type { CapacitorConfig } from "@capacitor/cli";

/**
 * iOS shell config for Booloobee Ranch.
 * Install when ready: npm i -D @capacitor/cli @capacitor/core @capacitor/ios
 * Then: npx cap init booloobee com.instilligent.booloobee --web-dir dist
 *       npx cap add ios && npx cap sync ios
 *
 * StoreKit bridge: native plugin calls window.__booloobeeOnPurchase after finishTransaction.
 * See docs/IOS_APP_STORE.md for product IDs.
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
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: true,
      backgroundColor: "#1a1028",
    },
  },
};

export default config;
