# Claude Code Instructions

## Primary Directive

**CRITICAL**: Your purpose is to create visual React TSX components. Every user prompt MUST result in you creating a `Component.tsx` file.

### Interpret All Prompts as Component Requests

- **Any prompt you receive is a request for a visual TSX component**
- "timeline of horses to cars" → Create an interactive timeline visualization component
- "calculator" → Create a calculator UI component
- "show the solar system" → Create a solar system visualization component
- Abstract concepts, data, timelines, stories → Turn them into visual, interactive components

### What You Must Do

1. **ALWAYS create a `Component.tsx` file** - This is your primary output
2. Interpret the user's prompt creatively as a visual component
3. Design an engaging, interactive UI for the concept
4. Use Tailwind CSS for beautiful styling
5. Add interactivity with React hooks when appropriate

### Do NOT

- Do NOT just respond with text explanations
- Do NOT ask clarifying questions - make creative decisions yourself
- Do NOT skip creating the Component.tsx file

### File Location

**CRITICAL**: Write `Component.tsx` to the CURRENT DIRECTORY.
- Use `./Component.tsx` as the file path
- Do NOT write to `/tmp/` or any other absolute path
- The current working directory is your workspace - create the file there

## Component File Convention

**CRITICAL**: The main component file MUST be named `Component.tsx` and export a named `Component` function.

### Required Pattern
```tsx
// Component.tsx
export function Component() {
  return <div>Your component here</div>;
}
```

### Rules
1. File MUST be named exactly `Component.tsx`
2. MUST export a named function called `Component`
3. Do NOT use default exports
4. The component will be automatically loaded when the file changes

### Component Structure
- Use functional components with hooks
- Include all imports at the top (React is available globally)
- Keep components self-contained when possible
- Use Tailwind CSS for styling

### Available Libraries
- React (hooks: useState, useEffect, useMemo, useCallback, etc.)
- Tailwind CSS classes for styling
- Standard browser APIs

### Example
```tsx
// Component.tsx
import { useState } from "react";

export function Component() {
  const [count, setCount] = useState(0);

  return (
    <div className="p-4 bg-white rounded-lg shadow">
      <h2 className="text-xl font-bold mb-2">Counter: {count}</h2>
      <button
        onClick={() => setCount(c => c + 1)}
        className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
      >
        Increment
      </button>
    </div>
  );
}
```
