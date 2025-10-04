# Share Extension Testing Guide

## Prerequisites

Before testing, ensure:

1. **App Group is configured**:
   - Both main app and share extension have `group.com.breadchris.share` in their App Group entitlements
   - Check in Xcode → Target → Signing & Capabilities → App Groups

2. **URL Scheme is registered**:
   - Main app Info.plist contains the `list://` URL scheme
   - Check CFBundleURLTypes in Info.plist

3. **Share Extension is configured**:
   - Extension Info.plist has proper NSExtensionActivationRule
   - Extension supports web URLs and text

## Testing Steps

### Phase 1: System Integration Tests

1. **Launch the main app**
2. **Tap "Debug" button** (only visible in DEBUG builds)
3. **Run these tests in order**:
   - ✅ Test App Group - Should pass
   - ✅ Test Keychain - Should pass  
   - ✅ Generate Test API Key - Creates a test API key
   - ✅ Inspect Shared Container - Check console output

### Phase 2: Share Extension Tests

#### Manual Share Testing:
1. **Open Safari** on your device/simulator
2. **Navigate to any website** (e.g., https://www.apple.com)
3. **Tap the Share button** 📤
4. **Look for "Share to List"** in the share sheet
   - If not visible, tap "More" and enable it
5. **Tap "Share to List"**
6. **Verify the extension UI loads** with "Processing..." message
7. **Should show success message** and "Done" button

#### Programmatic Testing:
1. **In Debug View**: Enter a test URL and title
2. **Tap "Simulate Shared URL"** - Creates a fake share
3. **Tap "Check for Shared URLs"** - Processes the fake share
4. **Check console logs** for processing messages

### Phase 3: End-to-End Testing

1. **Ensure you're logged into your web app** in the main app
2. **Share a real URL** using the share extension
3. **Return to main app** (should open automatically)
4. **Check if URL appears** in your Supabase database/web interface

## Debugging Console Messages

Look for these key log messages:

### ✅ Success Messages:
- `✅ ShareExtension: URL stored in shared container`
- `✅ SharedURLManager: Processing shared URL`
- `✅ Shared URL: Successfully saved to Supabase`

### ❌ Error Messages:
- `❌ ShareExtension: No URL found in shared content`
- `❌ SharedURLManager: No API key found`
- `❌ Shared URL: User not authenticated`

### 🔍 Debug Messages:
- `📤 ShareExtension: Sending URL to main app`
- `📥 SharedURLManager: Processing shared URL`
- `🔑 SharedURLManager: Using API key for URL processing`

## Common Issues and Solutions

### Issue: Share extension doesn't appear
- **Solution**: Check NSExtensionActivationRule in extension's Info.plist
- **Check**: Extension target is being built and installed

### Issue: "Failed to access shared storage"
- **Solution**: Verify App Group entitlements on both targets
- **Check**: App Group ID matches exactly: `group.com.breadchris.share`

### Issue: "No API key found"
- **Solution**: Use Debug View to generate a test API key
- **Check**: Main app has successfully authenticated and stored an API key

### Issue: URLs not appearing in Supabase
- **Solution**: Check your Supabase table structure
- **Expected**: Table should have columns for url, title, shared_at, source, user_id
- **Check**: User is authenticated in the web interface

### Issue: Share extension UI shows error
- **Check**: Console logs for specific error messages
- **Debug**: Use "Inspect Shared Container" to see stored data

## Test Scenarios

### Scenario 1: Share from Safari
1. Open Safari → Any website
2. Share → Share to List
3. Verify success message
4. Check main app for new URL

### Scenario 2: Share URL from Messages
1. Receive URL in Messages app
2. Long press URL → Share → Share to List
3. Verify processing

### Scenario 3: Share from Notes
1. Open Notes with a URL
2. Select URL text → Share → Share to List
3. Verify URL extraction

### Scenario 4: Share without authentication
1. Log out of web app in main app
2. Try sharing a URL
3. Should handle gracefully (may show warning)

## Performance Testing

- **Share Extension Launch Time**: Should be < 2 seconds
- **URL Processing Time**: Should complete within 5 seconds
- **Main App Opening**: Should open automatically after share

## Simulator vs Device Testing

### Simulator:
- ✅ Basic functionality testing
- ✅ UI testing
- ✅ Console debugging
- ❌ May not perfectly replicate share sheet behavior

### Physical Device:
- ✅ Real-world share sheet testing
- ✅ Background app switching
- ✅ True URL scheme handling
- **Recommended for final testing**

## Troubleshooting Commands

### Clear All Data:
```swift
TestHelpers.clearTestData()
```

### Inspect Storage:
```swift
TestHelpers.inspectSharedContainer()
```

### Simulate Share:
```swift
TestHelpers.simulateSharedURL(url: "https://example.com", title: "Test")
```

## Success Criteria

The app passes testing when:
- ✅ Share extension appears in share sheet
- ✅ URLs are extracted correctly
- ✅ Data is stored in shared container
- ✅ Main app opens automatically
- ✅ URLs are sent to Supabase with user authentication
- ✅ No crashes or major errors
- ✅ Good user experience (clear feedback, reasonable performance)