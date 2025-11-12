# Content Creation Guidelines

## Purpose

This document provides guidelines to prevent duplicate content creation and ensure proper handling of create vs update operations in React components.

## Table of Contents

1. [Understanding React StrictMode](#understanding-react-strictmode)
2. [Content Creation Patterns](#content-creation-patterns)
3. [Content Update Patterns](#content-update-patterns)
4. [useEffect Guidelines](#useeffect-guidelines)
5. [React Query Mutation Best Practices](#react-query-mutation-best-practices)
6. [Idempotency Checklist](#idempotency-checklist)
7. [Testing Procedures](#testing-procedures)
8. [Common Pitfalls](#common-pitfalls)
9. [Code Review Checklist](#code-review-checklist)
10. [Examples from Codebase](#examples-from-codebase)

---

## Understanding React StrictMode

### What is StrictMode?

React StrictMode is a development-only tool that helps identify potential problems in your application. It's enabled in `index.tsx`:

```typescript
<React.StrictMode>
  <App />
</React.StrictMode>
```

### Key Behavior: Double-Execution

**In development mode, StrictMode intentionally:**
- Runs effects twice (mount → unmount → mount)
- Calls functions twice to detect side effects
- This helps catch bugs related to missing cleanup or improper dependencies

### Impact on Content Creation

If you create database records in a useEffect without checks:
```typescript
// ❌ BAD - Creates duplicates in StrictMode
useEffect(() => {
  createNewRecord();
}, []);
```

This will:
1. First execution: Create record A
2. StrictMode unmount: (cleanup if provided)
3. Second execution: Create record B ← **DUPLICATE!**

### Production vs Development

- **Development**: StrictMode is ON → effects run twice
- **Production**: StrictMode is OFF → effects run once
- **Important**: Always test in development to catch these issues early!

---

## Content Creation Patterns

### ✅ CORRECT: Check Before Create

Always query for existing records before creating new ones:

```typescript
useEffect(() => {
  const initializeData = async () => {
    // 1. Check if record already exists
    const existing = await queryForExisting({
      type: "my-type",
      group_id: groupId,
      user_id: userId
    });

    // 2. If exists, reuse it
    if (existing && existing.length > 0) {
      setRecordId(existing[0].id);
      return;
    }

    // 3. Only create if none exists
    const newRecord = await createNewRecord();
    setRecordId(newRecord.id);
  };

  initializeData();
}, [groupId, userId]);
```

**Why this works:**
- First StrictMode execution: Checks (none found) → Creates A → Sets ID
- Second StrictMode execution: Checks (finds A) → Reuses A ← **No duplicate!**

### ❌ WRONG: Unconditional Create

Never create records without checking for existing ones:

```typescript
// ❌ BAD
useEffect(() => {
  const newRecord = await createNewRecord();
  setRecordId(newRecord.id);
}, []);
```

**Why this fails:**
- Creates duplicate records in StrictMode
- Users lose data when page refreshes
- No way to resume previous sessions

### Pattern: Conditional Creation with Flags

For operations that should only run once per session:

```typescript
const hasInitializedRef = useRef(false);

useEffect(() => {
  if (hasInitializedRef.current) return;
  hasInitializedRef.current = true;

  const initialize = async () => {
    // This will only run once, even in StrictMode
    await createRecord();
  };

  initialize();
}, []);
```

**Note**: This prevents StrictMode double-execution but doesn't solve the "check before create" problem. Use both patterns when appropriate.

---

## Content Update Patterns

### ✅ CORRECT: Explicit ID Parameter

Always provide the content ID when updating:

```typescript
// Update existing content
await contentRepository.updateContent(existingId, {
  data: newData,
  metadata: updatedMetadata
});
```

### ❌ WRONG: Missing ID (Creates New Instead)

Don't confuse create and update:

```typescript
// ❌ BAD - This creates NEW content, doesn't update existing
await contentRepository.createContent({
  data: newData,
  metadata: updatedMetadata
});
```

### Pattern: Conditional Create vs Update

When you might create OR update:

```typescript
if (contentId) {
  // Update existing
  await contentRepository.updateContent(contentId, updates);
} else {
  // Create new
  const newContent = await contentRepository.createContent(data);
  setContentId(newContent.id);
}
```

---

## useEffect Guidelines

### Effects Run Twice in StrictMode

**Remember**: Every useEffect runs twice in development.

### Add Cleanup Functions

Always provide cleanup for effects with side effects:

```typescript
useEffect(() => {
  const subscription = subscribeToUpdates();

  // Cleanup function
  return () => {
    subscription.unsubscribe();
  };
}, []);
```

### Use Ref Flags for One-Time Operations

For operations that should truly only run once:

```typescript
const isInitializedRef = useRef(false);

useEffect(() => {
  if (isInitializedRef.current) return;

  const initialize = async () => {
    // Check before create (still necessary!)
    const existing = await checkExisting();
    if (!existing) {
      await createNew();
    }
    isInitializedRef.current = true;
  };

  initialize();
}, []);
```

### Proper Dependency Arrays

Include all dependencies to avoid stale closures:

```typescript
// ✅ GOOD
useEffect(() => {
  fetchData(userId, groupId);
}, [userId, groupId]);

// ❌ BAD - Missing dependencies
useEffect(() => {
  fetchData(userId, groupId);
}, []); // ESLint will warn about this
```

---

## React Query Mutation Best Practices

### Don't Call Mutations in Render

```typescript
// ❌ BAD - Called during render
function Component() {
  const mutation = useMutation({ mutationFn: createContent });
  mutation.mutate(data); // This runs on every render!

  return <div>...</div>;
}

// ✅ GOOD - Called in event handler
function Component() {
  const mutation = useMutation({ mutationFn: createContent });

  const handleSubmit = () => {
    mutation.mutate(data);
  };

  return <button onClick={handleSubmit}>Submit</button>;
}
```

### Don't Call Mutations in useEffect Without Conditions

```typescript
// ❌ BAD - Runs twice in StrictMode
useEffect(() => {
  mutation.mutate(data);
}, []);

// ✅ GOOD - Has guard condition
useEffect(() => {
  if (!hasInitialized && data) {
    mutation.mutate(data);
    setHasInitialized(true);
  }
}, [data]);
```

### Use onSuccess Instead of .then()

```typescript
// ✅ GOOD
const mutation = useMutation({
  mutationFn: createContent,
  onSuccess: (data) => {
    queryClient.invalidateQueries({ queryKey: ['content'] });
    setContentId(data.id);
  }
});

// ❌ LESS IDEAL (but works)
mutation.mutate(data).then((result) => {
  // Handle success
});
```

### Properly Invalidate Queries

After mutations, invalidate relevant queries:

```typescript
const mutation = useMutation({
  mutationFn: updateContent,
  onSuccess: () => {
    // Invalidate to refetch fresh data
    queryClient.invalidateQueries({ queryKey: ['content', contentId] });
  }
});
```

---

## Idempotency Checklist

Before implementing content creation, ask yourself:

- [ ] **Does this create new database records?**
  - If yes, proceed with checklist

- [ ] **Will it run multiple times in StrictMode?**
  - If in useEffect → Yes, it will run twice
  - If in event handler → No, only on user action

- [ ] **Is there a check for existing records first?**
  - Query database before creating
  - Reuse existing if found

- [ ] **Are IDs properly passed for updates vs creates?**
  - Update: Pass existing ID
  - Create: No ID (database generates)

- [ ] **Is there a unique constraint preventing duplicates?**
  - Database-level: Unique indexes
  - Application-level: Check before create

- [ ] **Have I tested this in development (StrictMode ON)?**
  - Navigate to the page
  - Check database for duplicates
  - Refresh and verify no new duplicates

---

## Testing Procedures

### Testing in Development (StrictMode)

1. **Clear test data**:
   ```sql
   DELETE FROM content WHERE type = 'test-type' AND group_id = 'test-group';
   ```

2. **Navigate to the component**:
   - Open the page that creates content
   - Wait for initial load

3. **Check database**:
   ```sql
   SELECT COUNT(*) FROM content WHERE type = 'test-type' AND group_id = 'test-group';
   ```
   - Should be: **1** (not 2!)

4. **Refresh the page**:
   - Refresh browser
   - Wait for load

5. **Check database again**:
   ```sql
   SELECT COUNT(*) FROM content WHERE type = 'test-type' AND group_id = 'test-group';
   ```
   - Should still be: **1** (reused existing)

### Testing in Production Build

1. **Build the app**:
   ```bash
   npm run build
   ```

2. **Run production server**:
   ```bash
   npm run preview
   ```

3. **Repeat testing steps above**:
   - Verify behavior is consistent
   - No duplicates should be created

### Monitoring Network Requests

Open browser DevTools → Network tab:
- Watch for duplicate POST requests
- Check if requests are identical (duplicates)
- Verify only one INSERT operation occurs

---

## Common Pitfalls

### 1. Auto-Creating Content in useEffect Without Checks

**Problem**:
```typescript
useEffect(() => {
  createChatSession(); // Creates duplicate in StrictMode
}, []);
```

**Solution**:
```typescript
useEffect(() => {
  const init = async () => {
    const existing = await findExistingSession();
    if (!existing) {
      await createChatSession();
    }
  };
  init();
}, []);
```

### 2. Confusing Create vs Update

**Problem**:
```typescript
// Trying to update but calling create
if (contentId) {
  await contentRepository.createContent(updates); // Wrong!
}
```

**Solution**:
```typescript
if (contentId) {
  await contentRepository.updateContent(contentId, updates); // Correct
}
```

### 3. Missing Dependencies in useEffect

**Problem**:
```typescript
useEffect(() => {
  fetchData(userId); // Uses userId but not in deps
}, []); // ESLint warning
```

**Solution**:
```typescript
useEffect(() => {
  fetchData(userId);
}, [userId]); // Include all dependencies
```

### 4. Not Handling Race Conditions

**Problem**:
```typescript
useEffect(() => {
  fetchData().then(setData); // What if component unmounts?
}, []);
```

**Solution**:
```typescript
useEffect(() => {
  let isMounted = true;

  fetchData().then((result) => {
    if (isMounted) setData(result);
  });

  return () => {
    isMounted = false;
  };
}, []);
```

### 5. Ignoring StrictMode Warnings

**Problem**: Seeing duplicates in development but thinking "it works in production"

**Solution**: Fix the root cause, don't ignore StrictMode behavior

---

## Code Review Checklist

When reviewing code that creates content:

- [ ] **Does this component create content?**
  - Search for `.insert(`, `createContent(`, etc.

- [ ] **Is creation conditional or unconditional?**
  - Conditional (with checks) = Good
  - Unconditional (no checks) = Bad

- [ ] **Will this create duplicates in StrictMode?**
  - If in useEffect without checks = Yes
  - If has "check before create" = No

- [ ] **Are there appropriate guards/checks?**
  - Query for existing before creating
  - Use ref flags for one-time operations
  - Proper cleanup functions

- [ ] **Is the pattern documented/tested?**
  - Comments explaining why checks are needed
  - Tests verifying no duplicates

- [ ] **Are IDs handled correctly?**
  - Updates pass existing ID
  - Creates don't pass ID (let database generate)

- [ ] **Is error handling robust?**
  - Handle query errors
  - Handle creation errors
  - User feedback on failures

---

## Examples from Codebase

### ✅ GOOD: BranchingChatPage.tsx (After Fix)

**Location**: `/components/BranchingChatPage.tsx` (lines 27-88)

```typescript
useEffect(() => {
  const initChatRoot = async () => {
    // 1. Query for existing chat
    const { data: existingChats } = await supabase
      .from("content")
      .select("id")
      .eq("type", "ai-chat")
      .eq("group_id", groupId)
      .eq("user_id", user.id)
      .eq("metadata->>chat_type", "branching")
      .order("created_at", { ascending: false })
      .limit(1);

    // 2. Reuse if exists
    if (existingChats && existingChats.length > 0) {
      setChatRootId(existingChats[0].id);
      return;
    }

    // 3. Only create if none exists
    const { data: newChat } = await supabase
      .from("content")
      .insert({ type: "ai-chat", ... })
      .single();

    setChatRootId(newChat.id);
  };

  initChatRoot();
}, [groupId]);
```

**Why it's good:**
- Checks for existing chat before creating
- Reuses existing session (better UX)
- Prevents duplicates in StrictMode
- Has inline comments explaining why

### ✅ GOOD: ContentRepository.updateContent()

**Location**: `/components/ContentRepository.ts` (lines 771-785)

```typescript
async updateContent(id: string, updates: Partial<Content>): Promise<void> {
  const { error } = await supabase
    .from("content")
    .update(updates)
    .eq("id", id);

  if (error) throw error;
}
```

**Why it's good:**
- Requires ID parameter (can't accidentally create)
- Clear separation between create and update
- Simple, focused responsibility

### ❌ BAD: BranchingChatPage.tsx (Before Fix)

**Location**: `/components/BranchingChatPage.tsx` (lines 28-65, before fix)

```typescript
useEffect(() => {
  const initChatRoot = async () => {
    // ❌ NO CHECK - Always creates new
    const { data: newChat } = await supabase
      .from("content")
      .insert({ type: "ai-chat", ... })
      .single();

    setChatRootId(newChat.id);
  };

  initChatRoot();
}, [groupId]);
```

**Why it was bad:**
- No check for existing chat
- Creates duplicate in StrictMode
- Loses previous chat session on refresh
- No way to resume conversations

---

## Summary: Golden Rules

1. **Check Before Create**: Always query for existing records before creating new ones
2. **Know Your Tool**: Understand StrictMode's double-execution behavior
3. **Test in Development**: Catch duplicate creation issues early
4. **Use Correct Methods**: `updateContent(id, ...)` for updates, not `createContent(...)`
5. **Guard Your Effects**: Use ref flags and cleanup functions appropriately
6. **Document Your Intent**: Add comments explaining why checks are necessary
7. **Review Carefully**: Follow the code review checklist above

---

## Need Help?

If you're unsure whether your implementation will create duplicates:

1. Test it in development with StrictMode enabled
2. Check the database for duplicate records
3. Refresh the page and check again
4. If you see duplicates, apply the "check before create" pattern
5. Add inline comments explaining the pattern

**When in doubt, prefer querying first over creating blindly.**
