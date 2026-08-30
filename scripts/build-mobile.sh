#!/bin/bash
# Build script for Enclave mobile app
# Usage: ./scripts/build-mobile.sh [ios|android|both]

set -e

PLATFORM=${1:-both}
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
FRONTEND_DIR="$ROOT_DIR/frontend-react"
CAPACITOR_DIR="$ROOT_DIR/frontend"

echo "🔧 Building Enclave Mobile App..."
echo ""

# Step 1: Build the React app
echo "📦 Building React frontend..."
cd "$FRONTEND_DIR"
npm run build

# Step 2: Copy build output to Capacitor www directory
echo "📁 Syncing to Capacitor..."
rm -rf "$CAPACITOR_DIR/www"
cp -r "$FRONTEND_DIR/dist" "$CAPACITOR_DIR/www"

# Step 3: Copy native bridge
if [ -f "$CAPACITOR_DIR/native-bridge.js" ]; then
  cp "$CAPACITOR_DIR/native-bridge.js" "$CAPACITOR_DIR/www/native-bridge.js"
fi

# Step 4: Sync Capacitor
echo "🔄 Syncing native projects..."
cd "$CAPACITOR_DIR"
npx cap sync

# Step 5: Build native projects
if [ "$PLATFORM" = "ios" ] || [ "$PLATFORM" = "both" ]; then
  echo "🍎 Building iOS..."
  npx cap open ios 2>/dev/null || echo "  → Open Xcode to build: open ios/App/App.xcworkspace"
fi

if [ "$PLATFORM" = "android" ] || [ "$PLATFORM" = "both" ]; then
  echo "🤖 Building Android..."
  cd "$CAPACITOR_DIR/android"
  ./gradlew assembleDebug
  echo "  → APK: android/app/build/outputs/apk/debug/app-debug.apk"
fi

echo ""
echo "✅ Mobile build complete!"
