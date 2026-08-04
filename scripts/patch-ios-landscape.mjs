#!/usr/bin/env node
/**
 * Forces Booloobee iOS target to landscape-only after `npx cap add ios`.
 * Run on Mac: node scripts/patch-ios-landscape.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const candidates = [
  path.join(root, "ios", "App", "App", "Info.plist"),
  path.join(root, "ios", "App", "Info.plist"),
];

const LANDSCAPE_KEYS = `
\t<key>UISupportedInterfaceOrientations</key>
\t<array>
\t\t<string>UIInterfaceOrientationLandscapeLeft</string>
\t\t<string>UIInterfaceOrientationLandscapeRight</string>
\t</array>
\t<key>UISupportedInterfaceOrientations~ipad</key>
\t<array>
\t\t<string>UIInterfaceOrientationLandscapeLeft</string>
\t\t<string>UIInterfaceOrientationLandscapeRight</string>
\t</array>
\t<key>UIRequiresFullScreen</key>
\t<true/>
`;

function patchPlist(file) {
  let xml = fs.readFileSync(file, "utf8");
  xml = xml.replace(
    /<key>UISupportedInterfaceOrientations(~ipad)?<\/key>\s*<array>[\s\S]*?<\/array>/g,
    "",
  );
  xml = xml.replace(
    /<\/dict>\s*<\/plist>/,
    `${LANDSCAPE_KEYS}\n</dict>\n</plist>`,
  );
  if (!xml.includes("UIStatusBarHidden")) {
    xml = xml.replace(
      /<\/dict>\s*<\/plist>/,
      `\t<key>UIStatusBarHidden</key>\n\t<true/>\n\t<key>UIViewControllerBasedStatusBarAppearance</key>\n\t<false/>\n</dict>\n</plist>`,
    );
  }
  fs.writeFileSync(file, xml);
  console.log("Patched landscape-only:", file);
}

let found = false;
for (const f of candidates) {
  if (fs.existsSync(f)) {
    patchPlist(f);
    found = true;
  }
}
if (!found) {
  console.error(
    "No Info.plist found. Run first:\n  npm i @capacitor/core @capacitor/cli @capacitor/ios\n  npm run build\n  npx cap add ios\n  node scripts/patch-ios-landscape.mjs",
  );
  process.exit(1);
}

const pbx = path.join(root, "ios", "App", "App.xcodeproj", "project.pbxproj");
if (fs.existsSync(pbx)) {
  let p = fs.readFileSync(pbx, "utf8");
  if (!p.includes("UIInterfaceOrientationLandscapeLeft")) {
    p = p.replace(
      /INFOPLIST_KEY_UISupportedInterfaceOrientations[^;]*;/g,
      'INFOPLIST_KEY_UISupportedInterfaceOrientations = "UIInterfaceOrientationLandscapeLeft UIInterfaceOrientationLandscapeRight";',
    );
    p = p.replace(
      /INFOPLIST_KEY_UISupportedInterfaceOrientations_iPhone[^;]*;/g,
      'INFOPLIST_KEY_UISupportedInterfaceOrientations_iPhone = "UIInterfaceOrientationLandscapeLeft UIInterfaceOrientationLandscapeRight";',
    );
    fs.writeFileSync(pbx, p);
    console.log("Patched project.pbxproj orientation keys (if present)");
  }
}

console.log("Done. Open Xcode: npx cap open ios");
console.log("Confirm: Target → General → Device Orientation → Landscape Left + Right only.");
