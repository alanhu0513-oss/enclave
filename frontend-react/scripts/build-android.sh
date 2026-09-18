#!/bin/bash
set -e
echo "Building Enclave Android..."
npm run build
npx cap sync android
npx cap open android
