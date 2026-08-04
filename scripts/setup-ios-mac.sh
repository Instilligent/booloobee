#!/usr/bin/env bash
# Run this ON YOUR MAC (with Xcode installed), from the booloobee repo root.
set -euo pipefail
cd "$(dirname "$0")/.."

echo "==> Installing Capacitor"
npm install @capacitor/core @capacitor/ios
npm install -D @capacitor/cli

echo "==> Building web assets"
npm run build

echo "==> Adding iOS platform (skips if exists)"
if [ ! -d ios ]; then
  npx cap add ios
else
  echo "ios/ already present — syncing only"
fi

echo "==> Syncing web → native"
npx cap sync ios

echo "==> Locking landscape orientation"
node scripts/patch-ios-landscape.mjs

echo ""
echo "============================================"
echo " Open Xcode and confirm orientations:"
echo "   npx cap open ios"
echo " Then: App target → General → Deployment Info"
echo "   ☑ Landscape Left"
echo "   ☑ Landscape Right"
echo "   ☐ Portrait"
echo "   ☐ Upside Down"
echo " Build & run on a device or simulator."
echo "============================================"
