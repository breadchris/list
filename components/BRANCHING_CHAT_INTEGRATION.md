# Branching Chat Integration

## Overview

The branching chat components from `data/project.zip` have been successfully integrated into the application. This provides a sophisticated conversation UI with branching capabilities, text highlighting, bookmarks, and a rich notes editor.

## Access

The branching chat page is accessible at:

```
/group/:groupId/chat
```

Example: `/group/abc123/chat`

## Features

### 1. **Branching Conversations**
- Create multiple conversation branches from any user message
- Edit messages to create new branches (similar to Claude's artifacts)
- Switch between branches using visual tabs or horizontal scrollable list
- Each branch maintains its own conversation history

### 2. **Four UI Variants**

#### Default Chat
- Standard chat interface with message history
- Branch selection via tabs or horizontal scroller
- Message collapse/expand functionality

#### Text Highlights
- Select and save text snippets from assistant responses
- View all highlights in a collapsible sidebar
- Delete individual highlights

#### Bookmarks
- Bookmark important messages
- View bookmarked messages in sidebar
- Reorder bookmarks via drag-and-drop
- Jump to bookmarked messages in conversation

#### Notes Sidebar
- Chat in collapsible sidebar
- Rich text editor in main area using Lexical
- Formatting: bold, italic, underline
- Lists: bullet and numbered
- Auto-list conversion (typing "* " starts bullet list)
- Save, download, and clear notes
- Word and character counts

### 3. **Retro/Vintage Styling**
- Beige/tan color palette (#E8DCC8, #F4D03F, #E67E50)
- Vintage aesthetic separate from main app design
- Folder-tab style branch selectors
- Handwritten note-card appearance

## Components

### Main Components
- **BranchingChatPage.tsx** - Main orchestrator component
- **BranchingChatMessage.tsx** - Individual message display with streaming
- **BranchingChatInput.tsx** - Input field with edit mode
- **BranchingChatSidebar.tsx** - Collapsible chat sidebar for notes variant

### Supporting Components
- **BranchTabs.tsx** - Visual folder tabs for branch switching
- **BranchList.tsx** - Horizontal scrollable branch selector
- **NotesArea.tsx** - Rich text editor using Lexical
- **VariantSidebar.tsx** - Switch between UI variants
- **HighlightsSidebar.tsx** - View saved text highlights
- **BookmarksSidebar.tsx** - Organize bookmarked messages

## Technical Details

### State Management
- Local state using React hooks
- Mock data for demo purposes
- Tree-based conversation structure with parent-child relationships

### Dependencies (Already Installed)
- `lexical@0.36.1` - Rich text editor core
- `@lexical/react@0.36.1` - React bindings for Lexical
- `@lexical/list@0.36.1` - List functionality
- `@lexical/rich-text@0.36.1` - Rich text nodes
- `@lexical/utils@0.36.1` - Utility functions
- `motion@12.23.24` - Animations (framer-motion fork)
- `lucide-react@0.544.0` - Icons

### Routing
Added to `/components/App.tsx`:
```tsx
<Route path="/group/:groupId/chat" element={<BranchingChatPage />} />
```

## Future Integration Possibilities

### Backend Integration (Optional)
Currently operates as standalone demo. Could be enhanced with:

1. **Connect to AWS Lambda**
   - Real AI responses via Lambda `/content` endpoint
   - Stream responses using Vercel AI SDK
   - Replace mock data with actual API calls

2. **Persist to Supabase**
   - Save conversation branches to database
   - Store bookmarks and highlights per user
   - Sync notes across devices

3. **Group Context**
   - Scope conversations to specific groups
   - Share conversation branches with group members
   - Collaborative highlighting and bookmarking

## Files Modified

- `/components/App.tsx` - Added route
- `/components/BranchingChatPage.tsx` - Main page component (renamed from App.tsx)
- `/components/BranchingChatMessage.tsx` - Message component (renamed from ChatMessage.tsx)
- `/components/BranchingChatInput.tsx` - Input component (renamed from ChatInput.tsx)
- `/components/BranchingChatSidebar.tsx` - Sidebar component (renamed from ChatSidebar.tsx)
- `/components/BranchTabs.tsx` - Branch tabs component
- `/components/BranchList.tsx` - Branch list component
- `/components/NotesArea.tsx` - Rich text editor (fixed Lexical imports)
- `/components/VariantSidebar.tsx` - Variant selector
- `/components/HighlightsSidebar.tsx` - Highlights sidebar
- `/components/BookmarksSidebar.tsx` - Bookmarks sidebar
- `/components/ui/*` - 48 shadcn/ui components

## Testing

To test the integration:

1. Start the development server: `npm run dev`
2. Navigate to `/group/YOUR_GROUP_ID/chat` (replace with actual group ID)
3. Try the different features:
   - Send messages
   - Edit a user message to create a branch
   - Switch between branches
   - Toggle between the 4 variants
   - Test highlights, bookmarks, and notes functionality

## Notes

- Components were renamed with "Branching" prefix to avoid conflicts with existing `ChatMessage.tsx` (used for realtime group chat)
- Retro styling preserved as requested
- All dependencies were already installed
- No backend integration - operates as standalone demo
- Group-scoped route allows future integration with group data
