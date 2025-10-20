# Testing Guidelines

## Test Authentication Guidelines

**CRITICAL**: Always use form-based authentication in tests

### Authentication Approach for Tests
- **NEVER use localStorage mocking** - causes inconsistent state and test failures
- **ALWAYS use real form-based authentication** - tests actual user flow
- **Form interaction pattern**: Click "Continue with email" → Fill email/password → Submit form
- **Wait for auth completion**: Wait for "Sign in to your account" text to disappear

### Correct Test Authentication Pattern
```typescript
import { AuthHelper } from './helpers/auth';
import { createTestUserWithInvites } from './helpers/invite-test-data';

const authHelper = new AuthHelper();
const user = createTestUserWithInvites('test-user');
const userId = await databaseHelper.createTestUser(user);

// Use form-based authentication
await authHelper.loginProgrammatically(page, user.email, user.password);

// Verify authentication worked
const isAuthenticated = await authHelper.isLoggedIn(page);
if (!isAuthenticated) {
  throw new Error('Authentication failed - test cannot proceed');
}
```

### Authentication Implementation Details
- Tests use real Supabase authentication through the UI form
- Test users created in database with known passwords
- Authentication detection via auth form disappearance
- Handles social login UI (clicks "Continue with email" to reveal form)
- More reliable than programmatic authentication for UI testing

### Test Result Configuration
- Test results saved to `./data/test-results/`
- HTML reports in `./data/playwright-report/`
- Screenshots and videos captured on failure for debugging

## Testing Configuration

**CRITICAL**: Playwright test results are saved to `./data/` directory

### Test Output Configuration
- Test results: `./data/test-results/`
- HTML reports: `./data/playwright-report/`
- Screenshots and videos on failure stored in test results
- Tests run against local Supabase instance (`http://127.0.0.1:54321`)
- Frontend tests run against `http://localhost:3004`

### Running Tests
```bash
npm run test:e2e                    # Run all E2E tests
npm run test:e2e:headed            # Run with browser UI visible
npm run test:e2e:ui                # Run with Playwright UI
npm run test:e2e -- tests/specific-test.spec.ts  # Run specific test
```

### Test Data Management
- Tests use DatabaseHelper for setup and cleanup
- Test users created with unique identifiers to prevent conflicts
- All test data automatically cleaned up after test completion

### Known Issues
- **Authentication mocking broken**: localStorage approach no longer works with current Supabase version
- Tests gracefully skip when authentication fails to prevent false failures
- localStorage.setItem('supabase.auth.token', ...) doesn't authenticate users
- Investigation needed for proper Supabase v2 session format or alternative mocking approach
