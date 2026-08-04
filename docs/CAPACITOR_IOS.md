# Capacitor iOS shell (Booloobee)

Prerequisite: Xcode on a Mac, Apple Developer account.

```bash
cd booloobee
npm install
npm run build

# one-time
npm i -D @capacitor/cli @capacitor/core
npm i @capacitor/ios
npx cap add ios
npx cap sync ios
npx cap open ios
```

`capacitor.config.ts` is already in the repo (`appId: com.instilligent.booloobee`).

## StoreKit bridge

1. Create products in App Store Connect (see [IOS_APP_STORE.md](./IOS_APP_STORE.md)).
2. Native Swift calls `webkit.messageHandlers` or injects:
   ```js
   window.__booloobeeIap = {
     purchase: (productId) => { /* StoreKit 2 */ },
     restore: () => { /* restore */ },
   };
   ```
3. On success, call `window.__booloobeeOnPurchase({ productId, ok: true })`.
4. JS side: `src/game/iap.ts`.

## TestFlight

Archive in Xcode → distribute to TestFlight → invite pilots.

## Force landscape (Xcode)

After `npx cap open ios`, in **Info.plist** (or target → General → Deployment Info):

- Uncheck Portrait / Upside Down
- Keep **Landscape Left** and **Landscape Right** only

Or set in `ios/App/App/Info.plist`:

```xml
<key>UISupportedInterfaceOrientations</key>
<array>
  <string>UIInterfaceOrientationLandscapeLeft</string>
  <string>UIInterfaceOrientationLandscapeRight</string>
</array>
```
