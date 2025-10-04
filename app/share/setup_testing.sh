#!/bin/bash

# Quick setup script for testing the share extension
# Run this from your Xcode project directory

echo "🔧 Setting up share extension for testing..."

echo "📋 Checklist for manual setup in Xcode:"
echo ""
echo "1. MAIN APP TARGET:"
echo "   - Add App Groups capability"
echo "   - Group ID: group.com.breadchris.share"
echo "   - Add URL scheme: list"
echo "   - Info.plist should include CFBundleURLTypes"
echo ""
echo "2. SHARE EXTENSION TARGET:"
echo "   - Add App Groups capability"  
echo "   - Same Group ID: group.com.breadchris.share"
echo "   - Extension should support URLs and text"
echo "   - NSExtensionActivationRule properly configured"
echo ""
echo "3. BUILD SETTINGS:"
echo "   - Both targets should have same team/signing"
echo "   - Share extension bundle ID should be: mainapp.extension"
echo ""
echo "4. TEST CHECKLIST:"
echo "   ✅ Build and run main app"
echo "   ✅ Tap 'Debug' button to run system tests"
echo "   ✅ Generate test API key"
echo "   ✅ Test sharing from Safari"
echo "   ✅ Check console logs for success/error messages"
echo ""

# Check if we're in an Xcode project
if [[ -f "*.xcodeproj" || -f "*.xcworkspace" ]]; then
    echo "✅ Found Xcode project"
else
    echo "⚠️  Run this script from your Xcode project directory"
fi

echo ""
echo "🚀 Ready to test! Open Xcode and build both targets."
echo "📖 See TESTING_GUIDE.md for detailed testing instructions."