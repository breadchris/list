# Passkey Authentication Implementation Plan

> Saved: 2025-12-13
> Status: Future implementation
> Reference: https://github.com/shaoxuan0916/next-passkey-webauthn

## Overview
Add WebAuthn passkey support for signup/signin using `next-passkey-webauthn` library with Supabase database storage.

**Requirements:**
- Passkeys as additional login method (alongside email/OAuth)
- Full passkey-only signup (username + passkey, no email required)
- Link to Supabase auth users via anonymous auth for passkey-only accounts

---

## Phase 1: Database Schema

### Migration: `passkeys` table
```sql
CREATE TABLE passkeys (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  credential_id TEXT UNIQUE NOT NULL,
  public_key TEXT NOT NULL,
  counter INTEGER DEFAULT 0,
  transports TEXT[] DEFAULT '{}',
  user_name TEXT,
  user_display_name TEXT,
  authenticator_attachment TEXT,
  device_info JSONB DEFAULT '{}',
  backup_eligible BOOLEAN DEFAULT false,
  backup_state BOOLEAN DEFAULT false,
  last_used_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_passkeys_user_id ON passkeys(user_id);
CREATE INDEX idx_passkeys_credential_id ON passkeys(credential_id);
```

### Migration: `passkey_challenges` table
```sql
CREATE TABLE passkey_challenges (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL,
  flow TEXT NOT NULL,
  challenge TEXT NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_passkey_challenges_user_id ON passkey_challenges(user_id);
CREATE INDEX idx_passkey_challenges_expires_at ON passkey_challenges(expires_at);
```

### Migration: Update `users` table for username
```sql
ALTER TABLE users ADD COLUMN IF NOT EXISTS username TEXT UNIQUE;
CREATE INDEX idx_users_username ON users(username);
```

### RLS Policies
```sql
-- Passkeys: users can only access their own
ALTER TABLE passkeys ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own passkeys" ON passkeys FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own passkeys" ON passkeys FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own passkeys" ON passkeys FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "Users can update own passkeys" ON passkeys FOR UPDATE USING (auth.uid() = user_id);

-- Challenges: service role only (handled server-side)
ALTER TABLE passkey_challenges ENABLE ROW LEVEL SECURITY;
```

**File:** `/supabase/migrations/YYYYMMDD_add_passkey_tables.sql`

---

## Phase 2: Package Installation

```bash
cd chat
npm install next-passkey-webauthn @simplewebauthn/browser
```

---

## Phase 3: Server-Side Implementation

### 3.1 Passkey Configuration
**File:** `/chat/lib/passkey/config.ts`

```typescript
import { SupabaseAdapter, SupabaseStore } from 'next-passkey-webauthn/supabase';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export const passkeyAdapter = new SupabaseAdapter(supabaseAdmin, {
  tableName: 'passkeys',
});

export const challengeStore = new SupabaseStore(supabaseAdmin, {
  tableName: 'passkey_challenges',
});

export const rpConfig = {
  rpID: process.env.NEXT_PUBLIC_RP_ID || 'localhost',
  rpName: process.env.NEXT_PUBLIC_RP_NAME || 'List App',
  expectedOrigin: process.env.NEXT_PUBLIC_EXPECTED_ORIGIN || 'http://localhost:3000',
};
```

### 3.2 API Routes

**Registration Start:** `/chat/app/api/passkey/register/start/route.ts`
- Input: `{ userId }` (from session)
- Calls `startRegistration()` from library
- Returns WebAuthn options for browser

**Registration Finish:** `/chat/app/api/passkey/register/finish/route.ts`
- Input: `{ userId, credential }` (WebAuthn response)
- Calls `finishRegistration()` to verify and store credential
- Returns success/failure

**Auth Start:** `/chat/app/api/passkey/auth/start/route.ts`
- Input: `{ username }` (for passkey-only) or `{ userId }` (for existing user)
- Looks up user by username if needed
- Calls `startAuthentication()`
- Returns WebAuthn options

**Auth Finish:** `/chat/app/api/passkey/auth/finish/route.ts`
- Input: `{ credential, username? }`
- Calls `finishAuthentication()` to verify
- Creates/updates Supabase session
- Returns session token

**Passkey-Only Signup:** `/chat/app/api/passkey/signup/route.ts`
- Input: `{ username }`
- Creates anonymous Supabase auth user
- Creates user record with username
- Returns userId for registration flow

**List Passkeys:** `/chat/app/api/passkey/list/route.ts`
- Input: session userId
- Returns user's registered passkeys

**Delete Passkey:** `/chat/app/api/passkey/delete/route.ts`
- Input: `{ credentialId }`
- Removes passkey from database

---

## Phase 4: Client-Side Implementation

### 4.1 Passkey Hooks
**File:** `/chat/hooks/usePasskey.ts`

```typescript
import { useRegisterPasskey, useAuthenticatePasskey, useManagePasskeys } from 'next-passkey-webauthn/client';

export function usePasskeyRegistration() {
  return useRegisterPasskey({
    startUrl: '/api/passkey/register/start',
    finishUrl: '/api/passkey/register/finish',
  });
}

export function usePasskeyAuth() {
  return useAuthenticatePasskey({
    startUrl: '/api/passkey/auth/start',
    finishUrl: '/api/passkey/auth/finish',
  });
}

export function usePasskeyManagement() {
  return useManagePasskeys({
    listUrl: '/api/passkey/list',
    deleteUrl: '/api/passkey/delete',
  });
}
```

### 4.2 Auth Component Updates

**Update:** `/chat/components/AuthModal.tsx`
- Add "Sign in with Passkey" button
- Add passkey registration prompt after email signup

**Update:** `/chat/components/list/UserAuth.tsx`
- Add passkey signup tab (username + passkey)
- Add passkey login option
- Handle passkey registration flow

**New:** `/chat/components/PasskeyButton.tsx`
- Reusable passkey action button with loading state

**New:** `/chat/components/PasskeyManagement.tsx`
- UI for managing registered passkeys (list/add/remove)

**Update:** `/chat/components/list/UserSettingsPage.tsx`
- Add passkey management section

---

## Phase 5: Environment Variables

Add to `.env.local`:
```bash
NEXT_PUBLIC_RP_ID=localhost  # Production: your domain without protocol
NEXT_PUBLIC_RP_NAME=List App
NEXT_PUBLIC_EXPECTED_ORIGIN=http://localhost:3000  # Production: https://yourdomain.com
```

---

## Files to Create/Modify

### New Files
- `/supabase/migrations/YYYYMMDD_add_passkey_tables.sql` - Database tables for passkeys & challenges
- `/chat/lib/passkey/config.ts` - SupabaseAdapter and ChallengeStore setup
- `/chat/app/api/passkey/register/start/route.ts` - Begin passkey registration
- `/chat/app/api/passkey/register/finish/route.ts` - Complete passkey registration
- `/chat/app/api/passkey/auth/start/route.ts` - Begin passkey authentication
- `/chat/app/api/passkey/auth/finish/route.ts` - Complete passkey authentication
- `/chat/app/api/passkey/signup/route.ts` - Create anonymous user for passkey-only signup
- `/chat/app/api/passkey/list/route.ts` - List user's registered passkeys
- `/chat/app/api/passkey/delete/route.ts` - Remove a passkey
- `/chat/hooks/usePasskey.ts` - Client hooks wrapping library
- `/chat/components/PasskeyButton.tsx` - Reusable passkey action button
- `/chat/components/PasskeyManagement.tsx` - UI for managing registered passkeys

### Modified Files
- `/chat/package.json` - Add `next-passkey-webauthn` and `@simplewebauthn/browser`
- `/chat/components/AuthModal.tsx` - Add "Sign in with Passkey" button after OAuth buttons
- `/chat/components/list/UserAuth.tsx` - Add passkey signup tab (username + passkey) and login option
- `/chat/components/list/UserSettingsPage.tsx` - Add passkey management section (list/add/remove)

---

## Auth Flow Summary

### Existing User Adding Passkey
1. User logged in via email/OAuth
2. Goes to settings → "Add Passkey"
3. Browser prompts for biometric/security key
4. Passkey stored linked to their user_id

### Passkey-Only Signup
1. User enters username
2. System creates anonymous Supabase auth user
3. System creates user record with username
4. Browser prompts for passkey creation
5. Passkey stored, session created

### Login with Passkey
1. User clicks "Sign in with Passkey"
2. Optionally enters username (or browser auto-suggests)
3. Browser prompts for biometric/security key
4. Server verifies, returns session
5. User logged in

---

## Security Considerations
- Challenge expiry: 5 minutes
- Counter verification to prevent replay attacks
- RLS policies restrict passkey access to owner
- Service role key only on server-side
- HTTPS required in production (WebAuthn requirement)
