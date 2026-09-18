#!/bin/bash
set -e
echo "Building Enclave iOS..."
npm run build
npx cap sync ios
npx cap open ios
