# Lexical Rich Editor

A multi-line rich text editor component with drag handles, lists, and hashtag mentions.

## Components

### `LexicalRichEditor`
Full-featured rich text editor with multi-line support, drag handles for block manipulation, and list formatting.

### `LexicalContentInput` (existing)
Lightweight chat-style input with Enter-to-submit behavior. Use for quick text entry.

## Features

### LexicalRichEditor Features
- ✅ Multi-line editing (Enter creates new lines)
- ✅ Drag handles (hover on left to see)
- ✅ "+" button to insert new blocks
- ✅ Bullet and numbered lists
- ✅ Hashtag mentions with autocomplete
- ✅ Cmd/Ctrl+Enter to submit
- ✅ Submit button
- ✅ Undo/Redo (Cmd/Ctrl+Z, Cmd/Ctrl+Shift+Z)
- ✅ Basic text formatting theme

### LexicalContentInput Features
- ✅ Single/multi-line with constrained height
- ✅ Enter to submit, Shift+Enter for line breaks
- ✅ Hashtag mentions with autocomplete
- ✅ Optimized for quick content entry

## Usage

### Basic Usage

```tsx
import { LexicalRichEditor, LexicalRichEditorRef } from './components/LexicalRichEditor';

function MyComponent() {
  const editorRef = useRef<LexicalRichEditorRef>(null);
  const [availableTags, setAvailableTags] = useState<Tag[]>([]);

  const handleSubmit = (text: string, mentions: string[]) => {
    console.log('Submitted text:', text);
    console.log('Tag mentions:', mentions);
    // Process the content...
  };

  return (
    <LexicalRichEditor
      ref={editorRef}
      onSubmit={handleSubmit}
      availableTags={availableTags}
      placeholder="Start writing your content..."
    />
  );
}
```

### With Custom Submit Button Text

```tsx
<LexicalRichEditor
  ref={editorRef}
  onSubmit={handleSubmit}
  availableTags={availableTags}
  submitButtonText="Post"
  placeholder="What's on your mind?"
/>
```

### Without Submit Button (Cmd/Ctrl+Enter only)

```tsx
<LexicalRichEditor
  ref={editorRef}
  onSubmit={handleSubmit}
  availableTags={availableTags}
  showSubmitButton={false}
  placeholder="Press Cmd/Ctrl+Enter to submit"
/>
```

### Programmatic Control

```tsx
const editorRef = useRef<LexicalRichEditorRef>(null);

// Submit content programmatically
editorRef.current?.submit();

// Clear editor content
editorRef.current?.clear();
```

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Enter` | Create new line |
| `Cmd/Ctrl+Enter` | Submit content |
| `Cmd/Ctrl+Z` | Undo |
| `Cmd/Ctrl+Shift+Z` | Redo |
| `#` | Trigger hashtag mention autocomplete |

## Drag Handle Features

### Visual Indicators
- Hover over the left side of the editor to reveal drag handles
- **Drag icon (⋮⋮)**: Click and drag to reorder blocks
- **Plus icon (+)**: Click to insert new blocks

### Insert Menu
Click the "+" button to insert:
- **Paragraph**: Regular text block
- **Bullet List**: Unordered list with bullets
- **Numbered List**: Ordered list with numbers

## List Formatting

### Creating Lists
1. Click the "+" button and select "Bullet List" or "Numbered List"
2. Type your list items, pressing Enter for each new item
3. Press Enter twice to exit the list

### Nested Lists
- Lists support nesting (indentation)
- Use Tab to increase indent level
- Use Shift+Tab to decrease indent level

## Props

### LexicalRichEditor Props

```typescript
interface LexicalRichEditorProps {
  onSubmit: (text: string, mentions: string[]) => void;
  onChange?: (editorState: EditorState) => void;
  placeholder?: string;
  disabled?: boolean;
  availableTags?: Tag[];
  showSubmitButton?: boolean;
  submitButtonText?: string;
}
```

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `onSubmit` | `(text: string, mentions: string[]) => void` | Required | Called when content is submitted |
| `onChange` | `(editorState: EditorState) => void` | Optional | Called on every content change |
| `placeholder` | `string` | `"Start typing..."` | Placeholder text when editor is empty |
| `disabled` | `boolean` | `false` | Disable editing |
| `availableTags` | `Tag[]` | `[]` | Tags available for hashtag autocomplete |
| `showSubmitButton` | `boolean` | `true` | Show/hide the Submit button |
| `submitButtonText` | `string` | `"Submit"` | Custom text for Submit button |

### LexicalRichEditorRef Methods

```typescript
interface LexicalRichEditorRef {
  submit: () => void;  // Submit content programmatically
  clear: () => void;   // Clear editor content
}
```

## Choosing Between Editors

### Use `LexicalRichEditor` when:
- ✅ Users need to write long-form content
- ✅ Multi-line formatting is important
- ✅ Lists and structured content are needed
- ✅ Content editing and reorganization is expected
- ✅ Examples: Blog posts, documentation, comments, notes

### Use `LexicalContentInput` when:
- ✅ Quick text entry is the priority
- ✅ Single-line or short multi-line input is sufficient
- ✅ Enter-to-submit behavior is desired
- ✅ Minimal UI is preferred
- ✅ Examples: Chat messages, quick notes, search boxes, forms

## Migration from LexicalContentInput

If you want to replace an existing `LexicalContentInput` with `LexicalRichEditor`:

### Before (Simple Input)
```tsx
<LexicalContentInput
  ref={inputRef}
  onSubmit={handleSubmit}
  availableTags={availableTags}
  placeholder="Add a note..."
/>
```

### After (Rich Editor)
```tsx
<LexicalRichEditor
  ref={inputRef}
  onSubmit={handleSubmit}
  availableTags={availableTags}
  placeholder="Add a note..."
  showSubmitButton={true}
/>
```

**Note**: The API is identical, so the migration is straightforward. The main difference is the user experience:
- `LexicalContentInput`: Enter submits, Shift+Enter adds line breaks
- `LexicalRichEditor`: Enter adds line breaks, Cmd/Ctrl+Enter (or button) submits

## Styling

### Custom Styling
The editor uses Tailwind CSS classes and can be customized via:
1. **Theme object**: Modify the `theme` in `LexicalRichEditor.tsx`
2. **CSS classes**: Override classes in `input.css`
3. **Container wrapping**: Wrap the editor in a custom container

### Theme Customization
```tsx
// In LexicalRichEditor.tsx, modify the theme object:
theme: {
  list: {
    ul: 'custom-bullet-list-class',
    ol: 'custom-numbered-list-class',
    listitem: 'custom-list-item-class'
  },
  // ... other theme properties
}
```

## Technical Details

### Architecture
- Built on Lexical editor framework
- Uses React Query for data management
- Supports real-time hashtag mention autocomplete
- Drag handles use absolute positioning
- Lists use native Lexical ListPlugin

### Performance
- Optimized for large documents
- Minimal re-renders
- Efficient DOM updates via Lexical's reconciliation

### Browser Support
- Modern browsers (Chrome, Firefox, Safari, Edge)
- Mobile browsers (iOS Safari, Chrome Android)
- Requires JavaScript enabled

## Troubleshooting

### Drag handles not showing
- **Solution**: Hover over the left side of the editor to reveal handles
- **Check**: Ensure `.draggable-block-menu` styles are loaded from `input.css`

### Lists not formatting correctly
- **Solution**: Verify `@lexical/list` package is installed
- **Check**: Ensure `ListNode` and `ListItemNode` are registered in the editor config

### Submit button not working
- **Solution**: Check that `onSubmit` callback is provided
- **Check**: Verify content is not empty (editor clears on submit)

### Cmd/Ctrl+Enter not submitting
- **Solution**: Ensure `KeyboardSubmitPlugin` is rendered
- **Check**: Browser focus is on the editor (click inside editor first)

## Examples

### Full-Featured Blog Editor
```tsx
function BlogEditor() {
  const editorRef = useRef<LexicalRichEditorRef>(null);
  const [content, setContent] = useState('');

  const handleSubmit = async (text: string, mentions: string[]) => {
    await saveBlogPost({ content: text, tags: mentions });
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">Write a Blog Post</h1>
      <LexicalRichEditor
        ref={editorRef}
        onSubmit={handleSubmit}
        placeholder="Start writing your blog post..."
        submitButtonText="Publish"
        availableTags={blogTags}
      />
    </div>
  );
}
```

### Comment System
```tsx
function CommentBox() {
  const handleComment = (text: string, mentions: string[]) => {
    postComment({ text, mentions });
  };

  return (
    <LexicalRichEditor
      onSubmit={handleComment}
      placeholder="Write a comment..."
      submitButtonText="Comment"
      showSubmitButton={true}
    />
  );
}
```

## See Also

- [Lexical Documentation](https://lexical.dev/)
- [Lexical Playground](https://playground.lexical.dev/)
- `LexicalContentInput.tsx` - Simple input component
- `EnterKeySubmitPlugin.tsx` - Enter key submission logic
- `DraggableBlockPlugin.tsx` - Drag handle implementation
