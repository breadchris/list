# PRD: Code App Visual Overhaul

## Problem

The code app's current layout has several visual and usability issues, especially on mobile/narrow viewports:

1. **Cramped vertical stacking on mobile** - Chat messages, input, and preview are stacked in a single column with no clear visual hierarchy. The preview panel gets squeezed to ~50vh and competes with the chat for space.
2. **No visual separation between zones** - The chat area, input bar, and preview panel blend together. Thin `border-neutral-800` lines on a `bg-neutral-950` background provide almost no contrast.
3. **Input bar feels buried** - The textarea, image-attach button, and send button sit in a dense horizontal row with uniform neutral-800/900 styling. Nothing draws the eye to the primary action area.
4. **Preview toolbar is too subtle** - The `Component.tsx` filename, "Show Code" toggle, and version selector (`v3`) are all small neutral-400 text on neutral-900. They read as secondary information when they should anchor the preview panel.
5. **White iframe preview jarring against dark chrome** - The live preview renders on `bg-white` inside an otherwise fully dark UI, creating an abrupt contrast boundary with no transition.
6. **Header is underdifferentiated** - The back-arrow + session title header is the same neutral-900 as the rest. It doesn't establish a clear top-of-page landmark.
7. **Mobile collapse UX is confusing** - The preview panel collapses to a 48px bar labeled "Preview" with a tiny chevron. There's no indication of what's inside or that tapping expands it.
8. **No visual feedback during generation** - While Claude is streaming, the only indicator is 3 small bouncing dots below the messages. There's no progress sense on the preview side (is a version coming? is it compiling?).
9. **Code viewer panel is cramped** - `max-h-64` on the collapsible code viewer doesn't give enough room for typical component files. The sticky header and monospace content feel squeezed.
10. **Landing page sessions list is flat** - Previous sessions are plain cards with no version count, no preview thumbnail, no indication of how many messages/iterations a session has.

## Goals

- Make the layout feel spacious and well-organized on both mobile and desktop
- Create clear visual hierarchy: header > input > preview > chat history
- Smooth the dark-chrome-to-white-preview transition
- Give the preview panel first-class visual presence
- Improve mobile UX with a better collapse/expand pattern
- Add lightweight generation feedback in the preview pane

## Non-goals

- Changing the underlying API or Claude Code SDK integration
- Adding new features (collaborative editing, export, etc.)
- Redesigning the landing page session management flow
- Changing the version data model

## Design Spec

### 1. Layout restructure

**Desktop (md+):**
- Keep the draggable horizontal split
- Default split: 40% chat / 60% preview (was 50/50) — preview deserves more room since it's the output
- Minimum widths: chat 280px, preview 320px

**Mobile (<md):**
- Switch from vertical 50/50 split to a **tab-based** layout with two tabs: "Chat" and "Preview"
- Active tab fills the full height below the header
- Tab bar sits directly under the header, always visible
- Badge on "Preview" tab shows version count (e.g. "v3")

### 2. Header

- Add a subtle bottom shadow (`shadow-sm shadow-black/20`) to lift it off the content
- Show a small status pill when streaming: a pulsing indigo dot + "Generating..." text, right-aligned in the header

### 3. Chat panel

- Messages area: same as today (scrollable, dividers between messages)
- Input area changes:
  - Move the input to the **top** of the chat panel (above messages) instead of the bottom, so the user's entry point is immediately visible and messages flow downward from it
  - Give the textarea a slightly lighter background (`bg-neutral-900` -> `bg-neutral-800/60`) and a visible border on focus (`ring-indigo-500/40`)
  - Make the send button larger and more prominent: full indigo with a slight glow on hover
  - Move the "Press Enter to send" hint inside the textarea as ghost text (placeholder suffix) instead of a separate line below
  - Image thumbnails: render below the textarea instead of above, with a subtle inset card style

### 4. Preview panel

- **Panel header**: give it more weight
  - Slightly taller (py-3 -> py-4)
  - "Preview" label in semibold neutral-200 instead of neutral-300
  - Version selector pill: styled as a small badge (`bg-indigo-500/15 text-indigo-400 rounded-full px-2.5 py-0.5 text-xs font-medium`)
  - "Show Code" toggle: pill button style instead of plain text

- **Preview frame**: soften the white-on-dark transition
  - Wrap the iframe in a container with `rounded-lg overflow-hidden ring-1 ring-neutral-800 m-3`
  - This adds a visible border and margin so the white content doesn't bleed to the panel edges
  - Light inner shadow: `shadow-inner shadow-black/10`

- **Generating state**: when streaming and no new version yet, show a centered overlay in the preview area with a shimmer/pulse animation and "Generating component..." text. Replace it with the rendered preview once the version lands.

- **Code viewer**:
  - Increase `max-h-64` to `max-h-[50%]` so it can use up to half the preview panel
  - Add line numbers (gutter) in neutral-700
  - Use a slightly different bg for the code area (`bg-[#0d0d0d]`) to distinguish from the panel chrome

### 5. Color and spacing tokens

Standardize on a small set of reusable patterns:

| Token | Value | Usage |
|-------|-------|-------|
| `surface-0` | `bg-neutral-950` | Page background |
| `surface-1` | `bg-neutral-900` | Cards, input bg |
| `surface-2` | `bg-neutral-800` | Elevated elements, hover states |
| `border-default` | `border-neutral-800` | Standard borders |
| `border-subtle` | `border-neutral-800/50` | Dividers within a surface |
| `text-primary` | `text-neutral-100` | Headings, important text |
| `text-secondary` | `text-neutral-400` | Body, labels |
| `text-muted` | `text-neutral-500` | Hints, timestamps |
| `accent` | `indigo-500` | Buttons, focus rings, active states |

### 6. Landing page polish

- Each session card shows:
  - Version count badge (e.g. "3 versions") if > 0
  - Truncated last prompt as subtitle (already exists, just style it more visibly in neutral-400 instead of neutral-600)
  - Created date in relative format ("2 days ago") instead of absolute
- "New Session" button: add a subtle gradient (`from-indigo-600 to-indigo-500`) and slightly larger padding
- Empty state: larger icon, warmer copy

### 7. Animations / transitions

- Tab switch (mobile): crossfade with 150ms duration
- Preview panel resize (desktop): no animation (already direct, keep it)
- Code viewer expand/collapse: slide-down with 200ms ease-out
- Version switch: brief fade (opacity 0 -> 1, 200ms) on the iframe container
- Generating overlay: pulse animation on the icon, shimmer on the text

## Affected files

| File | Changes |
|------|---------|
| `code-app-interface.tsx` | Layout restructure, mobile tabs, header status pill, default split 40/60 |
| `chat/code-chat-panel.tsx` | Move input above messages |
| `chat/code-chat-input.tsx` | Restyle textarea, send button, image previews, remove hint line |
| `chat/code-chat-messages.tsx` | No structural changes, minor divider styling |
| `preview/code-preview-panel.tsx` | Header restyling, generating overlay state |
| `preview/code-preview-renderer.tsx` | Iframe wrapper with rounded border, code viewer height, line numbers |
| `preview/code-version-selector.tsx` | Badge-style version pill |
| `code-landing.tsx` | Session card metadata, relative dates, button gradient, empty state |

## Rollout

Ship as a single PR. No feature flags needed — this is purely visual. Test on:
- Desktop Chrome (1440px+)
- Tablet portrait (768px)
- Mobile (375px, 390px)
- Both empty state (no versions) and active state (multiple versions, streaming)
