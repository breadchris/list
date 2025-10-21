# Frontend Development Guidelines

## Go HTTP Server Guidelines

**CRITICAL**: The Go HTTP server is for serving the React app only

### Server Responsibilities
- **Serve React application** - Main purpose is to serve the frontend
- **Static file serving** - CSS, fonts, and other assets
- **Development tooling** - ESBuild integration for development
- **Component rendering** - Debug endpoints for individual components

### What NOT to Add to Go Server
- **No content APIs** - Never add endpoints like `/api/content`
- **No database operations** - All data must go directly through Supabase
- **No authentication endpoints** - Use Supabase Auth exclusively
- **No business logic** - Keep server purely for static serving

### Correct Architecture
```
iOS App ──────────────────► Supabase (direct)
React App ────────────────► Supabase (direct)
Go Server ────► React App (serves frontend only)
```

## React Query Guidelines

**CRITICAL**: Never implement optimistic updates

### Prohibition on Optimistic Updates
- **Never use `onMutate` for optimistic updates** - causes state inconsistencies and duplicate data
- **Always use simple `onSuccess` with `invalidateQueries`** - ensures clean, consistent state
- **Let loading states handle UX** - users prefer reliable data over perceived speed
- **Optimistic updates cause hard-to-debug issues** - state corruption, duplicates, race conditions

### Correct Mutation Pattern
```typescript
export const useExampleMutation = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data) => await repository.performAction(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['relevant-key'] });
    }
  });
};
```

### Why No Optimistic Updates?
- **Data consistency** - Server is always the source of truth
- **Simpler debugging** - Predictable data flow without rollback complexity
- **Prevents race conditions** - No conflicts between optimistic and real data
- **Reliable state** - Users see accurate information, not temporary illusions
- **Easier maintenance** - Less complex code with fewer edge cases

This follows our core principle: Fix root causes (slow UX), don't mask symptoms (with optimistic updates).

## Apple OAuth Configuration

**CRITICAL**: Manual setup required in Apple Developer Console and Supabase Dashboard

### Apple Developer Console Setup (Required)

**Prerequisites:**
- Active Apple Developer Account (paid membership required)
- Access to developer.apple.com

**Steps:**
1. **Create App ID with Sign in with Apple capability**
   - Go to Certificates, Identifiers & Profiles > Identifiers
   - Create new App ID with bundle identifier (e.g., com.acme.listapp)
   - Enable "Sign in with Apple" capability

2. **Create Service ID (becomes client_id)**
   - Create Services ID with different identifier (e.g., app.com.acme.listapp)
   - **SAVE THIS ID** - this becomes your `client_id` in Supabase
   - Configure with callback URL: `https://zazsrepfnamdmibcyenx.supabase.co/auth/v1/callback`

3. **Generate Secret Key**
   - Go to Keys section, create new key
   - Enable "Sign in with Apple", link to your Service ID
   - Download the .p8 file (only chance to get it)
   - Use this to generate client_secret JWT

4. **Generate Client Secret**
   - Follow Supabase docs to create JWT using the .p8 file
   - Use online tools or custom script to generate the client_secret

### Supabase Dashboard Configuration

1. **Enable Apple OAuth Provider**
   - Go to Authentication > Providers > Apple
   - Toggle Apple to enabled
   - Enter `client_id` (Service ID from Apple Developer Console)
   - Enter `client_secret` (Generated JWT)
   - Click Save

### Implementation Details

**Client-side Usage:**
```typescript
import { signInWithApple } from './SupabaseClient';

// Trigger Apple OAuth flow
await signInWithApple();
```

**Callback URL Format:**
- Production: `https://zazsrepfnamdmibcyenx.supabase.co/auth/v1/callback`
- Local: `https://localhost:3000/auth/v1/callback` (for testing)

### Testing and Verification

**Web Testing:**
- Requires actual Apple ID for testing
- Works in Safari and Chrome on macOS/iOS
- Test both sign-up and sign-in flows

**iOS App Testing:**
- Native Sign in with Apple integration
- Custom redirect URL: `list://auth/success`
- Test in iOS Simulator and real devices

### Security Considerations

- **Client Secret Rotation**: Apple recommends rotating client secrets every 6 months
- **Bundle ID Verification**: Ensure Apple Developer Console bundle ID matches app configuration
- **Domain Verification**: Verify callback domains are properly configured in Apple Console

### Common Issues and Solutions

**"Invalid client" error:**
- Verify Service ID matches client_id in Supabase
- Check callback URL is exactly: `https://zazsrepfnamdmibcyenx.supabase.co/auth/v1/callback`
- Ensure Service ID is linked to App ID with Sign in with Apple enabled

**"Invalid client_secret" error:**
- Regenerate client_secret JWT with correct private key
- Verify key ID, team ID, and Service ID in JWT claims
- Check JWT expiration (Apple recommends 6-month maximum)

**Testing limitations:**
- Apple OAuth requires production Apple Developer account
- Cannot test in Expo Go app (requires custom build)
- Web testing requires actual Apple ID login

## Spotify OAuth Configuration

**CRITICAL**: Supports both sign-in and account linking workflows

### Supabase Dashboard Configuration (Required)

**Prerequisites:**
- Active Spotify Developer Account (free)
- Access to developer.spotify.com

**Steps:**
1. **Create Spotify App**
   - Go to developer.spotify.com/dashboard
   - Create new app with name and description
   - Add Redirect URI: `https://zazsrepfnamdmibcyenx.supabase.co/auth/v1/callback`
   - Save and note the `Client ID` and `Client Secret`

2. **Enable Spotify OAuth Provider in Supabase**
   - Go to Authentication > Providers > Spotify
   - Toggle Spotify to enabled
   - Enter `Client ID` from Spotify Dashboard
   - Enter `Client Secret` from Spotify Dashboard
   - Configure scopes: `playlist-read-private playlist-read-collaborative`
   - Click Save

3. **Enable Identity Linking (Optional but Recommended)**
   - Go to Authentication > Settings > Identity Linking
   - Toggle "Enable Manual Linking" to ON
   - This allows users to link Spotify to existing accounts without creating separate accounts

### Authentication Behavior

**Two Workflows:**

1. **Sign-In Mode** - When user is NOT authenticated
   - Uses `signInWithSpotify()` from SupabaseClient.ts
   - Creates new user account if Spotify email not found
   - User becomes authenticated with Spotify as primary identity

2. **Account Linking Mode** - When user IS already authenticated
   - Uses `linkSpotifyAccount()` from SupabaseClient.ts
   - Links Spotify identity to current user account
   - Preserves existing authentication, adds Spotify as linked identity
   - User can access Spotify playlists without separate account

**Automatic Detection:**
The `useSpotifyAuth` hook automatically detects which mode to use:

```typescript
const login = async () => {
  const { data: { session } } = await supabase.auth.getSession();

  if (session?.user) {
    // User logged in → Link Spotify to existing account
    await linkSpotifyAccount();
  } else {
    // No user → Sign in with Spotify
    await signInWithSpotify();
  }
};
```

### Implementation Details

**Client-side Usage:**

```typescript
import { useSpotifyAuth } from '../hooks/useSpotifyAuth';

// In component
const { isAuthenticated, accessToken, login } = useSpotifyAuth();

// Trigger Spotify OAuth (auto-detects sign-in vs. linking)
await login();
```

**Identity Detection:**

The hook checks `user.identities[]` array instead of `app_metadata.provider`:

```typescript
const spotifyIdentity = session?.user?.identities?.find(
  identity => identity.provider === 'spotify'
);

if (spotifyIdentity && session?.provider_token) {
  // User has Spotify linked
  setAuthState({ isAuthenticated: true, accessToken: session.provider_token });
}
```

**Unlinking Spotify:**

```typescript
import { unlinkSpotifyAccount } from './SupabaseClient';

// Remove Spotify from linked identities
await unlinkSpotifyAccount();
```

**Callback URL Format:**
- Production: `https://zazsrepfnamdmibcyenx.supabase.co/auth/v1/callback`
- Local: `http://localhost:3004` (or current origin)

### Key Files

- `/components/SupabaseClient.ts` - OAuth functions (`signInWithSpotify`, `linkSpotifyAccount`, `unlinkSpotifyAccount`)
- `/hooks/useSpotifyAuth.ts` - Authentication state and auto-detection logic
- `/hooks/useLinkedAccounts.ts` - Manage all linked identities (Google, Apple, Spotify)
- `/components/SpotifyPlaylistModal.tsx` - UI for linking and importing playlists

### Testing and Verification

**Web Testing:**
- Works in all modern browsers
- Test sign-in flow (no existing session)
- Test linking flow (with existing email/Google/Apple session)
- Verify Spotify playlists are accessible after authentication

**Account Linking Testing:**
1. Sign in with email/Google/Apple
2. Click "Import" → Select Spotify
3. Click "Link Spotify Account"
4. Verify Spotify is added to existing account (no new account created)
5. Check linked identities in Supabase dashboard

**Unlinking Testing:**
1. While authenticated with Spotify linked
2. Click "Unlink Spotify" in playlist modal
3. Verify Spotify identity removed but user still authenticated with primary identity

### Security Considerations

- **Token Storage**: `provider_token` stored in session, not localStorage
- **Scope Limitation**: Only request necessary scopes (playlist read access)
- **Identity Conflicts**: If Spotify email already exists with different identity, linking will fail with clear error message
- **Manual Linking Required**: Supabase "Enable Manual Linking" must be ON for account linking to work

### Common Issues and Solutions

**"Invalid redirect URI" error:**
- Verify callback URL in Spotify Dashboard exactly matches: `https://zazsrepfnamdmibcyenx.supabase.co/auth/v1/callback`
- Ensure no trailing slashes or extra parameters

**"Email already exists" error when linking:**
- This means a separate account exists with the Spotify email
- User should sign in with that account first, then link
- Or delete the separate account and link to current one

**"Spotify account already linked" error:**
- Spotify is already linked to this account
- Check linked identities with `useLinkedAccounts()` hook
- Can unlink and re-link if needed

**Provider token not available:**
- Ensure Supabase Dashboard has correct Client ID and Secret
- Check OAuth scopes are configured
- Verify user completed OAuth flow (didn't cancel)

**User created separate account instead of linking:**
- Happens if "Enable Manual Linking" is OFF in Supabase
- Or if user signed out before linking
- Solution: Use `linkSpotifyAccount()` explicitly when user is authenticated

### Spotify API Integration

**Using the Access Token:**

```typescript
const { accessToken } = useSpotifyAuth();

// Create Spotify service client
const spotifyService = new SpotifyService(accessToken);

// Fetch playlists
const playlists = await spotifyService.getUserPlaylists(50, 0);

// Fetch tracks from playlist
const tracks = await spotifyService.getAllPlaylistTracks(playlistId);
```

**Importing Playlists:**

The system automatically imports Spotify playlists as hierarchical content:
- Playlist becomes parent `content` item with type `text`
- Each track becomes child `content` item with metadata (artist, album, duration)
- Uses `ContentRepository.importSpotifyPlaylist()` method
