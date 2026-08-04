# Capacitor iOS — landscape lock (the real fix)

Safari **cannot** force landscape. Only a native iOS build can.

## One command on your Mac (Xcode installed)

From the repo root:

```bash
git pull
npm run ios:setup
```

That will:

1. Install `@capacitor/core`, `@capacitor/ios`, `@capacitor/cli`
2. `npm run build` → `dist/`
3. `npx cap add ios` (first time) + `npx cap sync ios`
4. Patch **Info.plist** to **Landscape Left + Landscape Right only**
5. Hide status bar for more play area

Then:

```bash
npx cap open ios
```

In Xcode:

1. Select **App** target → **General** → **Deployment Info** → **Device Orientation**
2. Leave only:
   - ☑ Landscape Left
   - ☑ Landscape Right
   - ☐ Portrait
   - ☐ Upside Down
3. Pick a simulator or your iPhone → **Run** (▶)

The app will **launch and stay in landscape**. Rotating to portrait does nothing useful — iOS keeps it sideways.

## After web game changes

```bash
npm run build
npx cap sync ios
npx cap open ios   # rebuild in Xcode if needed
```

## Manual Info.plist keys

If the patch script cannot find the plist, paste this into `ios/App/App/Info.plist` inside the root `<dict>`:

```xml
<key>UISupportedInterfaceOrientations</key>
<array>
  <string>UIInterfaceOrientationLandscapeLeft</string>
  <string>UIInterfaceOrientationLandscapeRight</string>
</array>
<key>UISupportedInterfaceOrientations~ipad</key>
<array>
  <string>UIInterfaceOrientationLandscapeLeft</string>
  <string>UIInterfaceOrientationLandscapeRight</string>
</array>
<key>UIRequiresFullScreen</key>
<true/>
<key>UIStatusBarHidden</key>
<true/>
<key>UIViewControllerBasedStatusBarAppearance</key>
<false/>
```

## StoreKit / TestFlight

See [IOS_APP_STORE.md](./IOS_APP_STORE.md). Bundle ID: `com.instilligent.booloobee`.
