# Claude Code Lambda Testing Guide

## Overview
This document describes the comprehensive test suite for the Claude Code "vibe coding" feature. The tests validate Lambda functionality, session management, selected content integration, and the full UI workflow.

## Test Architecture

### Two-Tier Testing Strategy

We use a two-tier approach to maximize coverage while maintaining fast feedback loops:

1. **Direct Lambda API Tests** (`lambda/claude-code-api-tests.sh`)
   - Fast execution (bash + curl)
   - Direct API validation
   - No UI dependencies
   - Comprehensive edge case coverage

2. **Playwright E2E Tests** (`tests/lambda-claude-code-vibe.spec.ts`)
   - Full user workflow validation
   - UI integration testing
   - Database persistence verification
   - Real-time subscription testing

## Quick Start

### Running Direct API Tests

```bash
cd lambda
./claude-code-api-tests.sh
```

**Prerequisites:**
- `curl` installed
- `jq` installed (for JSON processing)
- Production Lambda endpoint accessible

**Expected Output:**
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Claude Code Lambda API Test Suite
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

TEST 1: Text-Only Response (No Files)
✓ Response indicates success
✓ Exit code is 0
✓ S3 URL is empty (expected for text-only response)
✓ Session ID present: session-abc123...
✓ TEST PASSED

...

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TEST SUMMARY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Total Tests Run:     15
Tests Passed:        15
Tests Failed:        0

ALL TESTS PASSED! ✓
```

### Running Playwright E2E Tests

```bash
# Run all Claude Code E2E tests
npm run test:e2e -- tests/lambda-claude-code-vibe.spec.ts

# Run with browser UI visible
npm run test:e2e:headed -- tests/lambda-claude-code-vibe.spec.ts

# Run specific test
npm run test:e2e -- tests/lambda-claude-code-vibe.spec.ts -g "simple component"
```

**Prerequisites:**
- Local Supabase instance running (`npx supabase start`)
- Frontend dev server running (`npm run dev`)
- Playwright installed (`npx playwright install`)

## Test Coverage

### Direct Lambda API Tests (15 Tests)

#### 1. Text-Only Response
**Purpose:** Validate Lambda handles prompts that don't generate files
**Validates:**
- Success response
- Exit code 0
- Empty `s3_url` (no files)
- Session ID returned

#### 2. Single React Component
**Purpose:** Test basic component generation
**Validates:**
- File generated and uploaded to S3
- `file_count >= 1`
- `s3_url` populated
- Session ID for continuation

#### 3. Multi-File Generation
**Purpose:** Test generating multiple related files
**Validates:**
- Multiple files created
- `file_count >= 3`
- All files in S3 zip
- TypeScript types included

#### 4. Selected Content - Single Item
**Purpose:** Test context passing with one content item
**Validates:**
- Selected content formatted correctly
- Claude Code acknowledges content
- Generated code references content

#### 5. Selected Content - Multiple Items
**Purpose:** Test context with multiple content items
**Validates:**
- Multiple items formatted
- All items accessible to Claude Code
- Component uses all provided context

#### 6. Session Continuation
**Purpose:** Test resuming existing sessions
**Validates:**
- Same session ID returned
- Session files restored
- Multi-turn conversation works

#### 7. Invalid Session ID
**Purpose:** Test error handling for non-existent sessions
**Validates:**
- HTTP 404 status code
- Descriptive error message
- No data corruption

#### 8. React Hooks Component
**Purpose:** Test useState/useEffect generation
**Validates:**
- Hooks used correctly
- No external dependencies
- React-only implementation

#### 9. TypeScript Types Component
**Purpose:** Test TypeScript interface generation
**Validates:**
- Proper type definitions
- Interface/type exports
- Type-safe props

#### 10. Empty Prompt Validation
**Purpose:** Test input validation
**Validates:**
- HTTP 400 status code
- Validation error message
- Lambda doesn't execute

#### 11. Very Long Prompt (Stress Test)
**Purpose:** Test handling of large inputs
**Validates:**
- 50+ content items processed
- No truncation errors
- Performance acceptable

#### 12. Special Characters
**Purpose:** Test JSON escaping and encoding
**Validates:**
- Quotes, brackets, ampersands handled
- No injection vulnerabilities
- Correct rendering

#### 13. Inline Styles Component
**Purpose:** Test styling without external CSS
**Validates:**
- React inline styles used
- No CSS-in-JS libraries
- Hover effects with state

#### 14. Form Component with State
**Purpose:** Test complex state management
**Validates:**
- useState for form fields
- Event handlers
- Form submission logic

#### 15. No External Dependencies Constraint
**Purpose:** Test vibe coding constraint enforcement
**Validates:**
- Claude Code suggests built-in APIs
- No npm package suggestions
- Constraint explained to user

### Playwright E2E Tests (8 Tests)

#### 1. Simple Component Generation
**Flow:**
1. User opens FAB menu
2. Clicks "Claude Code"
3. Enters component prompt
4. Executes
5. Sees success toast
6. Content appears in list

**Validates:**
- Modal opens correctly
- Prompt input works
- Execution triggers
- Database content created
- UI updates in real-time

#### 2. Selected Content Integration
**Flow:**
1. Create test content items (URLs)
2. User selects multiple items
3. Opens Claude Code
4. Modal shows selected content
5. Generates component using content

**Validates:**
- Content selection works
- Modal displays selected items
- Context passed to Lambda
- Component references URLs

#### 3. Session Continuation
**Flow:**
1. Create existing Claude Code content
2. User clicks on content
3. Opens Claude Code (session detected)
4. Modal shows "Session Active"
5. Continues with new prompt

**Validates:**
- Session metadata retrieved
- UI shows continuation state
- Same session ID used
- Iterative development works

#### 4. Error Handling
**Flow:**
1. User opens Claude Code
2. Tries empty prompt
3. Sees validation error
4. Enters invalid prompt
5. Sees error toast

**Validates:**
- Button disabled with empty input
- Client-side validation
- Error toasts displayed
- Graceful error messages

#### 5. Session ID Display
**Flow:**
1. User executes Claude Code
2. Sees success toast
3. Toast includes session ID

**Validates:**
- Session ID shown to user
- ID format correct
- User can reference for debugging

#### 6. React Hooks Constraint
**Flow:**
1. User prompts for hooks component
2. Execution succeeds
3. Component uses hooks correctly

**Validates:**
- Hooks constraint understood
- useState/useEffect generated
- No class components

#### 7. Execution Progress
**Flow:**
1. User executes Claude Code
2. Sees progress messages
3. Sees loading spinner
4. Completion toast appears

**Validates:**
- Progress indicators shown
- User feedback during execution
- UX clarity

#### 8. Keyboard Shortcut
**Flow:**
1. User enters prompt
2. Presses Cmd+Enter
3. Execution starts

**Validates:**
- Keyboard shortcut works
- UX convenience feature
- Same as clicking button

## Test Data Management

### Database Helper Methods

Extended `DatabaseHelper` class with content management:

```typescript
// Create test content
async createTestContent(content: {
  type: string;
  data: string;
  group_id: string;
  user_id: string;
  parent_content_id: string | null;
  metadata?: any;
}): Promise<string>

// Delete test content
async deleteTestContent(contentId: string): Promise<void>

// Get content by parent ID
async getContentByParentId(parentContentId: string): Promise<any[]>

// Get Claude Code session metadata
async getClaudeCodeSession(contentId: string): Promise<SessionMetadata | null>

// Delete test user
async deleteTestUser(userId: string): Promise<void>

// Delete test group
async deleteTestGroup(groupId: string): Promise<void>

// Get content by ID
async getContentById(contentId: string): Promise<any | null>
```

### Cleanup Strategy

**Automatic Cleanup:**
- Playwright tests use `afterEach` hooks
- All test users deleted via admin API
- Groups and content cascade deleted
- No orphaned test data

**Manual Cleanup (if needed):**
```sql
-- Clean up test users
DELETE FROM auth.users WHERE email LIKE '%@test.com';

-- Clean up test groups
DELETE FROM groups WHERE name LIKE '%Test Group%';

-- Clean up orphaned content
DELETE FROM content WHERE user_id NOT IN (SELECT id FROM users);
```

## Debugging Tests

### Direct API Test Debugging

**View full response:**
```bash
# Run single test and inspect output
curl -X POST https://6jvwlnnks2.execute-api.us-east-1.amazonaws.com/claude-code \
  -H "Content-Type: application/json" \
  -d '{"prompt": "Your test prompt"}' | jq '.'
```

**Check specific fields:**
```bash
# Check exit code
echo "$response" | jq '.exitCode'

# Check stdout
echo "$response" | jq -r '.stdout'

# Check stderr
echo "$response" | jq -r '.stderr'

# Check file count
echo "$response" | jq '.file_count'
```

### Playwright Test Debugging

**Run with UI visible:**
```bash
npm run test:e2e:headed -- tests/lambda-claude-code-vibe.spec.ts
```

**Run with Playwright inspector:**
```bash
npm run test:e2e:ui -- tests/lambda-claude-code-vibe.spec.ts
```

**View test results:**
```bash
# HTML report
open data/playwright-report/index.html

# Terminal output
npm run test:e2e -- tests/lambda-claude-code-vibe.spec.ts --reporter=list
```

**Check test artifacts:**
```bash
# Screenshots on failure
ls data/test-results/*/screenshots/

# Videos of test runs
ls data/test-results/*/videos/
```

## Common Issues

### Issue: Direct API Tests Fail with "Session not found"

**Cause:** Session continuation test depends on previous test storing session ID

**Fix:** Ensure tests run in order, or skip continuation test if no session ID available

### Issue: Playwright Tests Fail with "Element not found"

**Cause:** UI selectors may have changed or loading too slow

**Fix:**
1. Check data-testid attributes exist
2. Increase timeout values
3. Add explicit waits for network idle

### Issue: Test User Creation Fails

**Cause:** Local Supabase not running or email confirmation issues

**Fix:**
```bash
# Ensure Supabase running
npx supabase status

# Reset local database if needed
npx supabase db reset
```

### Issue: Lambda Returns 500 Error

**Cause:** Missing environment variables or API keys

**Fix:**
```bash
# Check Lambda environment variables
aws lambda get-function-configuration \
  --function-name claude-code-lambda-d643b14 \
  --query 'Environment.Variables'

# Verify ANTHROPIC_API_KEY is set
```

## Performance Benchmarks

### Direct API Tests
- **Average test duration:** 5-15 seconds per test
- **Total suite time:** ~3-5 minutes
- **Success rate target:** 100%

### Playwright E2E Tests
- **Average test duration:** 30-60 seconds per test
- **Total suite time:** ~8-15 minutes
- **Success rate target:** 95%+ (allowing for network flakiness)

## CI/CD Integration

### GitHub Actions Workflow

```yaml
name: Claude Code Tests

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  api-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Run Direct API Tests
        run: |
          cd lambda
          ./claude-code-api-tests.sh

  e2e-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Setup Node
        uses: actions/setup-node@v3
        with:
          node-version: '20'
      - name: Install dependencies
        run: npm ci
      - name: Start Supabase
        run: npx supabase start
      - name: Start dev server
        run: npm run dev &
      - name: Run Playwright tests
        run: npm run test:e2e -- tests/lambda-claude-code-vibe.spec.ts
```

## Test Maintenance

### When to Update Tests

**Lambda Changes:**
- Update API tests when request/response format changes
- Update validation tests when error messages change
- Update session tests when S3 format changes

**UI Changes:**
- Update selectors when component structure changes
- Update flow tests when user workflow changes
- Update keyboard shortcut tests when bindings change

**Feature Additions:**
- Add new test scenarios for new vibe coding constraints
- Add tests for new prompt types
- Add tests for new session management features

### Test Review Checklist

Before merging changes that affect Claude Code:

- [ ] All direct API tests pass
- [ ] All Playwright E2E tests pass
- [ ] New features have corresponding tests
- [ ] Test documentation updated
- [ ] Performance benchmarks maintained
- [ ] No flaky tests introduced
- [ ] Cleanup logic verified

## Support

For test failures or questions:
1. Check this documentation
2. Review test output and logs
3. Inspect Lambda CloudWatch logs
4. Check Supabase logs for database errors
5. Open GitHub issue with test output

## Appendix

### Lambda Response Structure

```json
{
  "success": true,
  "session_id": "session-abc123-xyz789",
  "messages": [
    {
      "type": "assistant",
      "message": {
        "content": [{"type": "text", "text": "..."}]
      }
    }
  ],
  "s3_url": "session-abc123-xyz789.zip",
  "stdout": "Process output...",
  "stderr": "Process errors...",
  "exitCode": 0,
  "file_count": 3
}
```

### Session Metadata Structure

```json
{
  "claude_code_session": {
    "session_id": "session-abc123-xyz789",
    "s3_url": "session-abc123-xyz789.zip",
    "initial_prompt": "Create a Counter component",
    "created_at": "2025-10-11T12:00:00Z",
    "last_updated_at": "2025-10-11T12:05:00Z"
  }
}
```

### Selected Content Format

```
<selected_content>
Content Item 1:
Type: text
Data: https://react.dev
Metadata: {"url":"https://react.dev","title":"React Docs"}
---
Content Item 2:
Type: text
Data: https://github.com/facebook/react
Metadata: {"url":"https://github.com/facebook/react"}
</selected_content>

[User's prompt here]
```

---

**Last Updated:** 2025-10-11
**Test Suite Version:** 1.0.0
**Maintainer:** Claude Code Team
