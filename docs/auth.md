# Authentication Flow Documentation

## Overview

This document describes the authentication states and flows in the List App, designed to ensure users are never blocked from using the application.

## Core Principles

1. **Non-blocking Authentication**: Authentication never prevents UI from loading
2. **Graceful Degradation**: Unauthenticated users can still access public content
3. **Progressive Enhancement**: Features unlock as authentication completes
4. **Invite-First Flow**: Invite links work before authentication

## User States

### 1. Unauthenticated Visitor
- **State**: No session, browsing normally
- **Access**: Can view public content via `/public/content/{id}` URLs
- **UI**: Shows sign-in prompt, public content viewer
- **Actions**: Can sign in/up, view public content

### 2. Unauthenticated with Invite Link
- **State**: No session, has `/invite/{code}` URL
- **Access**: Can join group immediately after signing in
- **UI**: Auth modal with invite context
- **Actions**: Sign in → auto-join group → redirect to group

### 3. Authenticated User (Normal)
- **State**: Valid session, normal app usage
- **Access**: Full app functionality
- **UI**: Complete app interface
- **Actions**: Create/join groups, manage content, share publicly

### 4. Authenticated with Invite Link
- **State**: Has session, clicking on `/invite/{code}`
- **Access**: Immediate group join attempt
- **UI**: Loading indicator → success/error message
- **Actions**: Auto-join → redirect to group or show error

### 5. Session Expired/Invalid
- **State**: Had session but now invalid/expired
- **Access**: Gradual feature degradation
- **UI**: Authentication prompt overlay
- **Actions**: Re-authenticate or continue as anonymous

### 6. Public Content Viewer
- **State**: Anyone (authenticated or not) viewing public content
- **Access**: Read-only access to shared content
- **UI**: Public content view with sign-up prompts
- **Actions**: View content, sign up for full features

## Authentication Flow Diagrams

### Main App Load Flow

```
Page Load
    ↓
Show UI Immediately (Non-blocking)
    ↓
Background: Check Session
    ├─ Session Found → Set User → Load Groups
    └─ No Session → Show Auth UI
```

### Invite Link Flow

```
/invite/{code} URL
    ↓
User Authenticated?
    ├─ YES → Join Group Immediately
    │         ├─ Success → Redirect to Group
    │         ├─ Already Member → Show Message + Redirect
    │         └─ Error → Show Error Message
    └─ NO → Show Auth with Invite Context
              ↓
          User Signs In
              ↓
          Auto-join Group
              ↓
          Redirect to Group
```

### Public Content Flow

```
/public/content/{id} URL
    ↓
Load Public Content (No Auth Required)
    ├─ Content Found & Public → Show Content + Sign-up CTA
    ├─ Content Not Found → Show 404 + Sign-up CTA
    └─ Content Private → Show Access Denied + Sign-in CTA
```

### Authentication State Transitions

```
[Loading] → [Unauthenticated] → [Authenticating] → [Authenticated]
    ↓              ↓                   ↓               ↓
Show UI        Auth UI          Loading Overlay    Full App
    ↓              ↓                   ↓               ↓
Public Only    Sign In/Up       Profile Setup    All Features
```

## Component Responsibilities

### App.tsx (Router)
- **Responsibility**: Route detection and top-level routing
- **States**: `'main' | 'public'`
- **Logic**: Routes to PublicContentView or ListApp based on URL

### ListApp.tsx (Main App)
- **Responsibility**: Authentication, group management, main app functionality
- **States**: `loading`, `authChecked`, `user`, `error`
- **Logic**: Non-blocking auth, invite handling, group operations

### PublicContentView.tsx (Public Content)
- **Responsibility**: Anonymous content viewing
- **States**: `loading`, `error`, `content`
- **Logic**: Public content loading, sign-up prompts

### UserAuth.tsx (Authentication)
- **Responsibility**: Sign in/up flows
- **States**: Authentication form states
- **Logic**: OAuth flows, form validation

## Error Handling

### Authentication Errors
- **Timeout**: 2-second timeout on auth operations
- **Network Error**: Show retry option, don't block UI
- **Invalid Session**: Gracefully redirect to auth

### Invite Link Errors
- **Invalid Code**: Clear error message with retry option
- **Already Member**: Success message, redirect to group
- **Network Error**: Retry mechanism with exponential backoff

### Public Content Errors
- **Content Not Found**: 404 with sign-up CTA
- **Access Denied**: Clear message with sign-in CTA
- **Network Error**: Retry option

## Performance Considerations

### Timeouts
- **Session Check**: 2 seconds
- **User Operations**: 3 seconds
- **Database Health**: 2 seconds

### Caching
- **Auth Session**: Cached by Supabase client
- **User Groups**: 5-minute stale time
- **Public Content**: No auth required, fast loading

### Background Operations
- **Profile Creation**: Runs in background, doesn't block UI
- **Group Loading**: Progressive loading, shows empty state first
- **Content Sync**: Real-time subscriptions update in background

## Development Guidelines

### Adding New Auth-Dependent Features
1. Always provide graceful degradation for unauthenticated users
2. Use loading states that don't block the entire UI
3. Add timeouts to all auth operations
4. Test with slow/failing network conditions

### Testing Authentication Flows
1. Test with no network connection
2. Test with expired sessions
3. Test invite links while unauthenticated
4. Test rapid navigation during auth loading
5. Test public content access without accounts

## Security Considerations

### Row Level Security (RLS)
- All database operations protected by RLS policies
- Public content explicitly marked and validated
- Group membership validated at database level

### Session Management
- Automatic token refresh enabled
- Secure session persistence
- PKCE flow for OAuth security

### Invite Link Security
- Join codes are case-insensitive but validated
- Duplicate membership prevention at database level
- Rate limiting through Supabase edge functions