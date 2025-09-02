# iOS App Migration to Supabase Guide

## Overview

This guide covers migrating the iOS app in `app/share/` to use the same Supabase project as your list app, replacing the current justshare.io integration.

## Current Architecture

- **Main App**: WebView loading "https://justshare.io" 
- **Share Extension**: Native sharing that posts to justshare.io API
- **Authentication**: Custom API key system stored in keychain

## New Architecture

- **Main App**: WebView loading your React list app
- **Share Extension**: Direct Supabase integration for content creation
- **Authentication**: Supabase Auth with session management

## Step 1: Add Supabase Swift SDK

### Using Xcode (Recommended)

1. Open `app/share.xcodeproj` in Xcode
2. Go to **File → Add Package Dependencies**
3. Enter the repository URL: `https://github.com/supabase/supabase-swift`
4. Choose **Up to Next Major Version** starting from `2.0.0`
5. Add the package to both targets:
   - `share` (main app)
   - `ext` (share extension)

### Package Dependencies to Add
- **Supabase**: Main Supabase client
- **SupabaseAuth**: Authentication features
- **SupabaseRealtime**: Real-time subscriptions (optional)
- **SupabaseStorage**: File storage (if needed)

## Step 2: Update ShareViewController.swift

Replace the current API-based implementation with direct Supabase calls:

```swift
import Supabase

class ShareViewController: SLComposeServiceViewController {
    // Supabase client configuration
    private let supabaseClient = SupabaseClient(
        supabaseURL: URL(string: "https://zazsrepfnamdmibcyenx.supabase.co")!,
        supabaseKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InphenNyZXBmbmFtZG1pYmN5ZW54Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUyOTYyNzMsImV4cCI6MjA3MDg3MjI3M30.IG4pzHdSxcbxCtonJ2EiczUDFeR5Lh41CI9MU2YrciM"
    )
    
    private var defaultGroupID: String?
    
    override func didSelectPost() {
        Task {
            await handleContentSharing()
        }
    }
    
    private func handleContentSharing() async {
        // Check authentication
        guard let session = await getSupabaseSession() else {
            await showError("Please log in to the main app first")
            return
        }
        
        // Get user's default group
        guard let groupID = await getDefaultGroup(for: session.user.id) else {
            await showError("No groups found. Please create a group first.")
            return
        }
        
        // Process shared content
        if let item = self.extensionContext?.inputItems.first as? NSExtensionItem,
           let itemProvider = item.attachments?.first {
            
            if itemProvider.hasItemConformingToTypeIdentifier("public.url") {
                await handleURLShare(itemProvider: itemProvider, groupID: groupID, session: session)
            } else if itemProvider.hasItemConformingToTypeIdentifier("public.plain-text") {
                await handleTextShare(itemProvider: itemProvider, groupID: groupID, session: session)
            } else {
                await showError("Unsupported content type")
            }
        }
    }
    
    private func getSupabaseSession() async -> Session? {
        do {
            let session = try await supabaseClient.auth.session
            return session
        } catch {
            print("Failed to get Supabase session: \\(error)")
            return nil
        }
    }
    
    private func getDefaultGroup(for userID: UUID) async -> String? {
        do {
            let response: [Group] = try await supabaseClient
                .from("groups")
                .select("id")
                .eq("created_by", value: userID)
                .limit(1)
                .execute()
                .value
            
            return response.first?.id
        } catch {
            print("Failed to get default group: \\(error)")
            return nil
        }
    }
    
    private func handleURLShare(itemProvider: NSItemProvider, groupID: String, session: Session) async {
        // Implementation for URL sharing
    }
    
    private func handleTextShare(itemProvider: NSItemProvider, groupID: String, session: Session) async {
        // Implementation for text sharing
    }
}

// Data structures matching your Supabase schema
struct Group: Codable {
    let id: String
    let name: String
    let created_by: UUID?
}

struct ContentItem: Codable {
    let id: UUID?
    let type: String
    let data: String
    let group_id: String
    let user_id: UUID
    let created_at: Date?
    let updated_at: Date?
}
```

## Step 3: Update ContentView.swift

Update the WebView authentication flow to work with Supabase Auth:

```swift
import SwiftUI
import WebKit
import Supabase

struct ContentView: View {
    @StateObject private var webViewStore = WebViewStore()
    @State private var showingAuthAlert = false
    @State private var authMessage = ""
    
    // Supabase client
    private let supabaseClient = SupabaseClient(
        supabaseURL: URL(string: "https://zazsrepfnamdmibcyenx.supabase.co")!,
        supabaseKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InphenNyZXBmbmFtZG1pYmN5ZW54Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUyOTYyNzMsImV4cCI6MjA3MDg3MjI3M30.IG4pzHdSxcbxCtonJ2EiczUDFeR5Lh41CI9MU2YrciM"
    )
    
    var body: some View {
        NavigationView {
            WebView(webView: webViewStore.webView)
                .navigationTitle("List")
                .navigationBarTitleDisplayMode(.inline)
                .toolbar {
                    ToolbarItem(placement: .navigationBarTrailing) {
                        Button("Refresh") {
                            webViewStore.webView.reload()
                        }
                    }
                }
                .onAppear {
                    loadListApp()
                    setupSupabaseAuth()
                }
        }
    }
    
    private func loadListApp() {
        let appURL = "http://localhost:3002" // Local development
        guard let url = URL(string: appURL) else { return }
        let request = URLRequest(url: url)
        webViewStore.webView.load(request)
    }
    
    private func setupSupabaseAuth() {
        // Listen for auth state changes
        Task {
            for await state in supabaseClient.auth.authStateChanges {
                await handleAuthStateChange(state)
            }
        }
    }
    
    @MainActor
    private func handleAuthStateChange(_ state: AuthChangeEvent) {
        switch state {
        case .signedIn(let session):
            print("User signed in: \\(session.user.id)")
        case .signedOut:
            print("User signed out")
        case .tokenRefreshed(let session):
            print("Token refreshed: \\(session.user.id)")
        default:
            break
        }
    }
}
```

## Step 4: Database Schema Mapping

Ensure your content creation matches the existing schema:

### Content Table Structure
```sql
create table "public"."content" (
  "id" uuid not null default uuid_generate_v4(),
  "created_at" timestamp with time zone not null default now(),
  "updated_at" timestamp with time zone not null default now(),
  "type" text not null default 'text'::text,
  "data" text not null,
  "group_id" uuid not null,
  "user_id" uuid not null,
  "parent_content_id" uuid
);
```

### Content Creation Example
```swift
private func createContent(type: String, data: String, groupID: String, userID: UUID) async throws {
    let content = ContentItem(
        id: nil,
        type: type,
        data: data,
        group_id: groupID,
        user_id: userID,
        created_at: nil,
        updated_at: nil
    )
    
    try await supabaseClient
        .from("content")
        .insert(content)
        .execute()
}
```

## Step 5: Authentication Flow

### Option A: Web-based Auth (Recommended)
- Use your React app's existing Google OAuth flow
- WebView handles the authentication
- Share extension uses the established session

### Option B: Native Auth
- Implement native Supabase Auth in iOS
- Use Google Sign-In iOS SDK
- More complex but better UX

## Step 6: Session Management

Update keychain storage to work with Supabase sessions:

```swift
private func storeSupabaseSession(_ session: Session) -> Bool {
    let service = "list.app"
    let account = "supabase_session"
    
    do {
        let sessionData = try JSONEncoder().encode(session)
        
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
            kSecValueData as String: sessionData,
            kSecAttrAccessible as String: kSecAttrAccessibleWhenUnlockedThisDeviceOnly
        ]
        
        // Delete existing
        SecItemDelete(query as CFDictionary)
        
        // Add new
        let status = SecItemAdd(query as CFDictionary, nil)
        return status == errSecSuccess
    } catch {
        print("Failed to encode session: \\(error)")
        return false
    }
}
```

## Step 7: Testing the Migration

1. **Start your Go server**: `go run . serve`
2. **Build and run the iOS app** in Xcode
3. **Test the WebView** loads your React app correctly
4. **Test authentication** through the web interface
5. **Test share extension** with URLs and text
6. **Verify content appears** in your React app

## Step 8: Production Deployment

1. **Update URLs** in iOS app to point to your production deployment
2. **Configure custom URL scheme** for auth callbacks if needed
3. **Test with production Supabase** project
4. **Update App Store metadata** and descriptions

## Common Issues

### Authentication Problems
- Ensure Supabase project has correct OAuth providers configured
- Check redirect URLs match your app's custom scheme
- Verify RLS policies allow content creation

### Network Issues
- Add network permissions in Info.plist if needed
- Handle offline scenarios gracefully
- Implement proper error handling for network failures

### Session Persistence
- Sessions may expire and need refresh
- Handle token refresh in background
- Clear session on sign out

## Next Steps

1. Follow this guide to implement the Supabase integration
2. Test thoroughly with both local and production environments
3. Consider implementing offline sync for better UX
4. Add proper error handling and user feedback
5. Implement push notifications through Supabase if needed