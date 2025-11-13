# Reveal.js Presentation Workflow

## Overview

Feature to convert selected content items into interactive reveal.js presentations. Users can select multiple content items and generate a presentation where each item becomes one slide.

## User Requirements

Based on user input:
- **Generation Approach**: Template-based with limited customization (fast and simple)
- **UI Entry Point**: Selection mode action button (alongside SEO, LLM, Markdown, etc.)
- **Slide Mapping**: One slide per content item (1:1 mapping)

## Features

### Content-to-Slides Conversion
- Each selected content item becomes one slide
- Content type determines slide header/badge
- Content data becomes slide body
- Metadata displayed if available (SEO info, YouTube data, etc.)

### Presentation Customization
- **Title**: User-defined presentation title (creates title slide)
- **Theme**: Choose from reveal.js built-in themes
  - black, white, league, beige, sky, night, serif, simple, solarized
- **Transition**: Slide transition style
  - slide, fade, convex, concave, zoom

### Presentation Storage
- Stored as content item with `type: 'presentation'` or `type: 'html'`
- Full HTML stored in `data` field (self-contained)
- Metadata includes:
  - `theme`: Selected theme name
  - `transition`: Selected transition style
  - `slide_count`: Number of slides generated
  - `created_from_selection: true`
  - `source_content_ids`: Array of original content IDs

## Implementation Plan

### Files to Create

#### 1. `components/RevealJSService.ts`
Service to generate reveal.js HTML presentations.

**Key Functions:**
```typescript
interface PresentationOptions {
  title: string;
  theme: 'black' | 'white' | 'league' | 'beige' | 'sky' | 'night' | 'serif' | 'simple' | 'solarized';
  transition: 'slide' | 'fade' | 'convex' | 'concave' | 'zoom';
  contentItems: Content[];
}

class RevealJSService {
  static generatePresentation(options: PresentationOptions): string;
  static formatContentAsSlide(content: Content): string;
  static validateOptions(options: PresentationOptions): { isValid: boolean; error?: string };
}
```

**HTML Template Structure:**
```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>{presentation.title}</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/reveal.js@5.0.0/dist/reveal.css">
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/reveal.js@5.0.0/dist/theme/{theme}.css">
</head>
<body>
  <div class="reveal">
    <div class="slides">
      <!-- Title Slide -->
      <section>
        <h1>{presentation.title}</h1>
        <p>{slide_count} slides</p>
      </section>

      <!-- Content Slides -->
      {contentItems.map(item =>
        <section>
          <h2>{item.type} - Badge</h2>
          <div>{formatContent(item.data)}</div>
          {item.metadata && <small>{formatMetadata(item.metadata)}</small>}
        </section>
      )}
    </div>
  </div>

  <script src="https://cdn.jsdelivr.net/npm/reveal.js@5.0.0/dist/reveal.js"></script>
  <script>
    Reveal.initialize({
      transition: '{transition}',
      hash: true,
      controls: true,
      progress: true,
      center: true
    });
  </script>
</body>
</html>
```

**Content Formatting:**
- Text content: Wrap in `<p>` tags, preserve line breaks
- URL content: Display as links, embed images/videos if possible
- Code content: Use `<pre><code>` blocks with syntax highlighting
- SEO metadata: Show title, description, image as slide elements
- YouTube metadata: Embed video thumbnail and metadata

#### 2. `components/RevealJSPresentationModal.tsx`
Modal UI for presentation configuration.

**Component Structure:**
```typescript
interface RevealJSPresentationModalProps {
  isVisible: boolean;
  selectedContent: Content[];
  groupId: string;
  parentContentId?: string | null;
  onClose: () => void;
  onPresentationCreated: () => void;
}
```

**UI Elements:**
- Header: "Create Presentation" with close button
- Selected content preview (scrollable list)
- Form inputs:
  - **Title** (required, text input)
  - **Theme** (dropdown with theme previews)
  - **Transition** (dropdown with transition examples)
- Footer: Cancel and "Generate Presentation" buttons
- Loading state during generation

**Similar to:** `LLMPromptModal.tsx`, `ClaudeCodePromptModal.tsx`

#### 3. `components/ListApp.tsx` - Handler Function
Add presentation generation handler.

```typescript
const handleCreatePresentation = async () => {
  console.log('📊 Create Presentation button clicked!');
  console.log('Selection state:', {
    isSelectionMode: contentSelection.isSelectionMode,
    selectedCount: contentSelection.selectedCount,
    selectedItems: contentSelection.selectedItems
  });

  const selectedIds = Array.from(contentSelection.selectedItems);

  if (selectedIds.length === 0) {
    console.log('No items selected, exiting');
    return;
  }

  // Fetch full content for selected items
  const selectedContentItems = await Promise.all(
    selectedIds.map(id => contentRepository.getContentById(id))
  );

  // Open modal with selected content
  setSelectedContentForPresentation(selectedContentItems.filter(Boolean));
  setShowPresentationModal(true);
};
```

**State Management:**
```typescript
const [showPresentationModal, setShowPresentationModal] = useState(false);
const [selectedContentForPresentation, setSelectedContentForPresentation] = useState<Content[]>([]);
```

**Toolbar Button:**
```typescript
{contentSelection.isSelectionMode && contentSelection.selectedCount > 0 && (
  <button
    onClick={handleCreatePresentation}
    className="..."
    title="Create Presentation"
  >
    <Presentation className="h-4 w-4" />
    <span>Presentation</span>
  </button>
)}
```

### Files to Modify

#### 1. `components/ContentList.tsx`
Add rendering for presentation content type.

```typescript
{item.type === 'presentation' ? (
  <div className="presentation-display">
    {/* Presentation Header */}
    <div className="flex items-center space-x-2 mb-2">
      <Presentation className="w-4 h-4 text-blue-600" />
      <span className="text-xs font-medium text-blue-600 uppercase">
        Presentation
      </span>
      {item.metadata?.slide_count && (
        <span className="text-xs text-gray-500">
          {item.metadata.slide_count} slides
        </span>
      )}
      {item.metadata?.theme && (
        <span className="text-xs text-gray-500">
          Theme: {item.metadata.theme}
        </span>
      )}
    </div>

    {/* Iframe Preview */}
    <div className="relative bg-gray-100 rounded-lg overflow-hidden" style={{ height: '400px' }}>
      <iframe
        srcDoc={item.data}
        className="w-full h-full border-none"
        sandbox="allow-scripts"
        title={`Presentation: ${item.id}`}
      />
    </div>

    {/* Action Buttons */}
    <div className="flex items-center gap-2 mt-2">
      <button
        onClick={() => openPresentationInNewWindow(item.data)}
        className="text-xs text-blue-600 hover:text-blue-700"
      >
        Open in New Window
      </button>
      <button
        onClick={() => downloadPresentation(item.data, item.id)}
        className="text-xs text-blue-600 hover:text-blue-700"
      >
        Download HTML
      </button>
      <button
        onClick={() => toggleFullscreen(iframeRef)}
        className="text-xs text-blue-600 hover:text-blue-700"
      >
        Fullscreen
      </button>
    </div>

    <TagDisplay tags={item.tags || []} isVisible={true} />
    <div className="text-xs text-gray-500 mt-2">
      {formatRelativeTime(item.created_at)}
    </div>
  </div>
) : (
  // ... other content types
)}
```

**Helper Functions:**
```typescript
const openPresentationInNewWindow = (html: string) => {
  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank');
};

const downloadPresentation = (html: string, filename: string) => {
  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `presentation-${filename}.html`;
  a.click();
  URL.revokeObjectURL(url);
};

const toggleFullscreen = (ref: React.RefObject<HTMLIFrameElement>) => {
  if (ref.current) {
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      ref.current.requestFullscreen();
    }
  }
};
```

## User Flow

### Step-by-Step Usage

1. **Select Content Items**
   - User enters selection mode (long press or select button)
   - Selects multiple content items (texts, URLs, images, etc.)
   - Selection toolbar appears at bottom

2. **Trigger Presentation Creation**
   - Clicks "Create Presentation" button in selection toolbar
   - Icon shows presentation/slides symbol
   - Button appears alongside other bulk actions

3. **Configure Presentation**
   - Modal opens showing:
     - Preview of selected items (count and types)
     - Title input field (required)
     - Theme dropdown with visual previews
     - Transition dropdown
   - User fills in title and selects preferences
   - Clicks "Generate Presentation"

4. **Generation Process**
   - Modal shows loading spinner
   - Service generates self-contained HTML:
     - Title slide with user's title
     - One slide per selected content item
     - Applied theme and transitions
     - Reveal.js from CDN
   - Creates content item in database:
     - `type: 'presentation'`
     - `data: <complete HTML>`
     - `metadata: { theme, transition, slide_count, source_content_ids }`

5. **View Presentation**
   - Presentation appears in content list
   - Shows inline iframe preview (400px height)
   - Displays metadata (slide count, theme)
   - Action buttons available:
     - **Open in New Window**: Full browser window
     - **Download HTML**: Save as .html file
     - **Fullscreen**: Fullscreen iframe mode

6. **Present or Share**
   - User opens in new window for full presentation
   - Navigate with arrow keys or on-screen controls
   - Share by downloading HTML file (fully self-contained)
   - HTML works offline (all resources from CDN)

## Technical Details

### Reveal.js Integration

**CDN Resources:**
```
https://cdn.jsdelivr.net/npm/reveal.js@5.0.0/dist/reveal.css
https://cdn.jsdelivr.net/npm/reveal.js@5.0.0/dist/reveal.js
https://cdn.jsdelivr.net/npm/reveal.js@5.0.0/dist/theme/{theme}.css
```

**Available Themes:**
- **black**: Black background, white text (default)
- **white**: White background, black text
- **league**: Grey background, white text
- **beige**: Beige background, dark text
- **sky**: Blue gradient background
- **night**: Dark background, thick headers
- **serif**: Cappuccino background, serif font
- **simple**: White background, minimal styling
- **solarized**: Solarized color scheme

**Transition Styles:**
- **slide**: Slide horizontally
- **fade**: Cross fade
- **convex**: Convex rotation
- **concave**: Concave rotation
- **zoom**: Zoom in/out

**Keyboard Controls:**
- Arrow keys: Navigate slides
- Space: Next slide
- Shift+Space: Previous slide
- F: Fullscreen
- S: Speaker notes view
- O: Overview mode
- Esc: Exit fullscreen/overview

### Content Type Mapping

**How Different Content Types Become Slides:**

1. **Text Content (`type: 'text'`)**
   ```html
   <section>
     <h2>Text</h2>
     <p>Content data with line breaks preserved</p>
   </section>
   ```

2. **URL Content with SEO Metadata**
   ```html
   <section>
     <h2>{metadata.title}</h2>
     <img src="{metadata.image}" alt="preview" style="max-height: 400px">
     <p>{metadata.description}</p>
     <small><a href="{data}">{metadata.domain}</a></small>
   </section>
   ```

3. **YouTube Video Content**
   ```html
   <section>
     <h2>{metadata.title}</h2>
     <iframe
       width="560"
       height="315"
       src="https://www.youtube.com/embed/{metadata.youtube_video_id}"
       allowfullscreen>
     </iframe>
     <p><small>{metadata.author} · {metadata.views} views</small></p>
   </section>
   ```

4. **Code Content (`type: 'js'`, `'tsx'`, etc.)**
   ```html
   <section>
     <h2>Code - {type}</h2>
     <pre><code class="language-{type}">
       {data}
     </code></pre>
   </section>
   ```

5. **Image Content**
   ```html
   <section>
     <h2>Image</h2>
     <img src="{data}" alt="content" style="max-height: 500px">
   </section>
   ```

### Storage & Performance

**Database Storage:**
- Full HTML stored in `content.data` (TEXT field)
- Average size: 50-200 KB per presentation
- Gzipped in database for efficiency

**Performance Considerations:**
- Reveal.js loaded from CDN (cached by browser)
- No server-side rendering needed
- Instant playback in iframe
- Lazy loading for images in slides

**Limitations:**
- Max recommended slides: 50-100 (performance)
- No video auto-play in iframe (security)
- External resources must be publicly accessible

## Future Enhancements

### Phase 2 (Optional)
- **Speaker Notes**: Add notes visible only in presenter view
- **Code Highlighting**: Syntax highlighting for code slides
- **Markdown Support**: Allow markdown in slide content
- **Custom CSS**: User-defined styles and themes
- **Slide Reordering**: Drag-and-drop to reorganize slides
- **Animation**: Fragment animations within slides

### Phase 3 (Advanced)
- **Real-time Collaboration**: Multiple users editing presentation
- **Export to PDF**: Server-side PDF generation
- **Embedded Videos**: Download and embed videos (not just links)
- **Interactive Elements**: Polls, quizzes in slides
- **Analytics**: Track slide views and engagement

## Implementation Checklist

- [ ] Create `components/RevealJSService.ts`
  - [ ] `generatePresentation()` function
  - [ ] Content-to-slide formatting functions
  - [ ] Theme and transition configuration
  - [ ] HTML template generation
  - [ ] Validation functions

- [ ] Create `components/RevealJSPresentationModal.tsx`
  - [ ] Modal UI layout
  - [ ] Title input field
  - [ ] Theme selector dropdown
  - [ ] Transition selector dropdown
  - [ ] Selected content preview
  - [ ] Generate button with loading state
  - [ ] Integration with `RevealJSService`

- [ ] Update `components/ListApp.tsx`
  - [ ] Add `handleCreatePresentation()` handler
  - [ ] Add presentation button to selection toolbar
  - [ ] Add state for modal visibility
  - [ ] Wire up modal component

- [ ] Update `components/ContentList.tsx`
  - [ ] Add rendering for `type === 'presentation'`
  - [ ] Iframe preview with controls
  - [ ] Open in new window function
  - [ ] Download HTML function
  - [ ] Fullscreen toggle function
  - [ ] Metadata display (slide count, theme)

- [ ] Testing
  - [ ] Test with various content types
  - [ ] Test all themes and transitions
  - [ ] Test iframe security (sandbox)
  - [ ] Test download functionality
  - [ ] Test fullscreen mode
  - [ ] Test with 1, 10, 50 slides
  - [ ] Cross-browser testing

- [ ] Documentation
  - [ ] User guide for creating presentations
  - [ ] Keyboard shortcuts documentation
  - [ ] Troubleshooting common issues
  - [ ] Best practices for slide content
