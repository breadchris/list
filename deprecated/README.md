# Deprecated Features

This directory contains features that have been deprecated and removed from the active codebase. The code is preserved here for reference and potential future use.

## Deprecation Date

November 12, 2025

## Deprecated Features

### 1. AI Chat V2 (`/ai-chat-v2/`)

**Reason for Deprecation:** Replaced by the simpler Branching Chat implementation that better fits the application's content hierarchy model.

**Files Moved:**
- `AIChatV2Modal.tsx` - Full-screen modal UI for AI Chat V2
- `AIChatV2Page.tsx` - Dedicated page component for AI Chat V2
- `AIChatV2Sidebar.tsx` - Sidebar presentation component
- `AIChatV2SidebarContainer.tsx` - Sidebar container with state management
- `useAIChatV2.ts` - React hook for AI Chat V2 state and operations
- `useAIChatV2Sidebar.ts` - React hook for sidebar-specific logic
- `ai-chat-e2e.spec.ts` - End-to-end tests for AI Chat V2

**What It Did:**
- Provided a complex AI chat interface with multiple views (modal, page, sidebar)
- Supported chat history and conversation threading
- Integrated with OpenAI API for AI responses

**Why It Was Replaced:**
- Branching Chat provides better conversation exploration through the content tree
- Simpler implementation reduces maintenance burden
- Better alignment with the app's hierarchical content model
- Less UI complexity while maintaining core functionality

### 2. Plugin System (`/plugins/`)

**Reason for Deprecation:** Over-engineered feature that added complexity without sufficient value. Custom React components (TSX) provide better type safety and developer experience.

**Files Moved:**
- `PluginRenderer.tsx` - Dynamic plugin code execution component
- `PluginEditor.tsx` - In-app editor for plugin code
- `PluginLoader.ts` - Plugin loading and validation utilities

**What It Did:**
- Allowed users to write custom JavaScript plugins
- Rendered plugins dynamically using Function constructor
- Provided in-app editor for plugin development

**Why It Was Removed:**
- Security concerns with dynamic code execution
- TSX components provide better type safety
- Limited adoption by users
- Maintenance overhead not justified by usage
- Better alternatives exist (TSX renderer for custom components)

### 3. Import CLI (`/import/`)

**Reason for Deprecation:** Superseded by direct Spotify integration and other import methods. The CLI approach was cumbersome and rarely used.

**Files Moved:**
- `import.go` - Go CLI command for importing data
- `import_models.go` - Data models for import operations
- `IMPORT_COMMAND.md` - Documentation for import command

**What It Did:**
- Command-line tool for bulk importing content
- Supported various data formats
- Integrated with Go server for backend operations

**Why It Was Removed:**
- Direct Spotify integration provides better UX
- Browser-based imports are more user-friendly
- CLI approach had low adoption
- Maintenance burden not justified by usage

## Code Changes

### Components Updated

1. **ContentActionsDrawer.tsx**
   - Removed `'ai-chat-v2'`, `'plugin'`, and `'import'` from `ContentAction` type
   - Removed action buttons and color configurations for deprecated features

2. **ContentInput.tsx**
   - Removed `PluginLoader` and `PluginEditor` imports
   - Removed `onAIChatV2Open` prop
   - Removed import action handler
   - Removed AI Chat V2 creation logic
   - Removed plugin state variables and auto-creation logic
   - Removed plugin editor modal

3. **ListApp.tsx**
   - Removed `onAIChatV2Open` prop from ContentInput
   - Removed `onActionSelect` handler for import action

4. **ContentList.tsx**
   - Removed `PluginRenderer` import
   - Removed plugin content type rendering block

5. **ContentMasonry.tsx**
   - Removed `PluginRenderer` import

## Migration Notes

### For AI Chat V2 Users

If you need to restore AI Chat V2 functionality:

1. Copy files from `/deprecated/ai-chat-v2/` back to `/components/`
2. Restore the `'ai-chat-v2'` action in `ContentActionsDrawer.tsx`
3. Add back the AI Chat V2 handler in `ContentInput.tsx`
4. Re-add the sidebar integration in `ListApp.tsx`

**Recommended Alternative:** Use the Branching Chat feature, which provides similar functionality with a simpler implementation.

### For Plugin Users

If you need plugin functionality:

1. Use the TSX renderer (`components/TsxRenderer.tsx`) for custom components
2. Write proper React components instead of dynamic plugins
3. This provides better type safety and development experience

**Recommended Alternative:** Create TSX content items for custom interactive components.

### For Import CLI Users

If you need bulk import functionality:

1. Use the Spotify integration for playlist imports
2. Use browser-based upload for other content types
3. Direct Supabase integration for programmatic access

**Recommended Alternative:** Browser-based imports (Spotify, file upload, etc.)

## Potential Future Use

These features may be restored or reimplemented if:
- User demand justifies the maintenance cost
- Security concerns (plugin system) can be addressed
- Better implementation approaches are identified

## Questions?

If you have questions about these deprecations or need to restore functionality, please open a GitHub issue or contact the development team.
