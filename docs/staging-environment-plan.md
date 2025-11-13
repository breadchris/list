# Staging Environment Implementation Plan

## Overview
Create a complete staging environment with separate Supabase project and AWS infrastructure, using Pulumi stacks for environment management and Go CLI commands for manual promotion workflow.

## Architecture Design

### Environment Structure
- **Local**: Supabase local + Docker Lambda (existing)
- **Staging**: Separate Supabase project + AWS infrastructure (new)
- **Production**: Current setup (rename from "dev" stack to "prod")

### Pulumi Stack Strategy
- **Remove**: `dev` stack (replaced by local development)
- **Create**: `staging` stack with `Pulumi.staging.yaml`
- **Rename**: Current `dev` stack → `prod` stack with `Pulumi.prod.yaml`

## Implementation Steps

### 1. Supabase Setup
- **Manual step**: Create new Supabase project for staging via Supabase dashboard
- Document staging Supabase URL and service role key
- Apply all existing migrations to staging project (forward-only)
- Configure OAuth providers for staging (separate credentials if needed)

### 2. Pulumi Stack Configuration

**Create `lambda/Pulumi.staging.yaml`:**
```yaml
config:
  aws:region: us-east-1
  list:supabase_url: <staging-supabase-url>
  list:supabase_service_role_key:
    secure: <staging-encrypted-key>
  # All other secrets mirrored from prod
  list:openai_api_key:
    secure: <same-as-prod>
  list:cloudflare_api_key:
    secure: <same-as-prod>
  # ... etc
```

**Rename `lambda/Pulumi.dev.yaml` → `lambda/Pulumi.prod.yaml`**

**Update resource naming convention:**
- Staging: `claude-code-lambda-staging`, `content-processing-queue-staging`, etc.
- Production: `claude-code-lambda-prod`, `content-processing-queue-prod`, etc.

### 3. Infrastructure Code Updates

**Modify `lambda/index.ts`:**
- Add stack name detection: `pulumi.getStack()`
- Suffix all resource names with stack name (e.g., `-${stack}`)
- Keep separate ECR repos, Lambda functions, API Gateways, S3 buckets, SQS queues per environment
- Ensure zero resource collision between staging and prod

### 4. Go CLI Commands

**Add new commands to `main.go`:**
```
go run . deploy staging    # Deploy to staging stack
go run . deploy prod       # Deploy to production stack
go run . stack:select <name>  # Switch active Pulumi stack
go run . stack:list        # List available stacks
```

**Command behavior:**
- `deploy staging`: Runs `cd lambda && pulumi stack select staging && pulumi up`
- `deploy prod`: Runs `cd lambda && pulumi stack select prod && pulumi up`
- Validates current git branch/commit before production deployments
- Shows confirmation prompt with diff preview before applying

### 5. Frontend Configuration

**Update `/api/config` endpoint in Go server:**
- Detect which backend to use based on build flags or environment
- Default to production for production builds
- Support override via environment variable for local testing against staging

**Add build commands:**
```json
"build:staging": "REACT_APP_ENV=staging npm run build"
"build:prod": "REACT_APP_ENV=production npm run build"
```

### 6. Documentation

**Create `DEPLOYMENT.md`:**
- Environment overview (local, staging, prod)
- Deployment workflow diagram
- Command reference for each environment
- Secret rotation procedures per environment
- Migration workflow (local → staging → prod)
- Rollback procedures

**Update `LOCAL_DEVELOPMENT.md`:**
- Clarify that local is for development only
- Document how to test against staging backend
- Environment variable overrides for hybrid local/staging testing

## Developer Workflow

### Day-to-Day Development
```bash
# 1. Local development with full local stack
npm run local

# 2. Make changes, test locally
# ... code changes ...

# 3. Create migration (if needed)
npx supabase migration new <migration-name>

# 4. Test migration locally
npx supabase db reset
```

### Deploying to Staging
```bash
# 1. Ensure migrations are committed
git add supabase/migrations/
git commit -m "Add migration: <description>"

# 2. Apply migration to staging Supabase
# Via Supabase CLI or dashboard (manual for now)

# 3. Deploy Lambda/infrastructure to staging
go run . deploy staging

# 4. Test staging environment
# Manual QA, run E2E tests against staging

# 5. Verify staging health
curl https://<staging-api-gateway>/health
```

### Promoting to Production
```bash
# 1. Verify staging is healthy
# Run smoke tests, check logs

# 2. Apply migration to production Supabase
# Via Supabase CLI or dashboard

# 3. Deploy to production
go run . deploy prod

# 4. Monitor production
# Check CloudWatch logs, API health, error rates

# 5. Tag release
git tag -a v1.x.x -m "Release description"
git push origin v1.x.x
```

## Secret Management

### Pulumi as Source of Truth
All secrets stored in `Pulumi.<stack>.yaml` files:
- Encrypted using Pulumi's built-in encryption
- Per-stack isolation (staging and prod have separate secrets)
- Rotation: `pulumi config set --secret <key> <new-value>` then redeploy

### Initial Secret Setup
```bash
# Select staging stack
cd lambda
pulumi stack select staging

# Set secrets (one-time setup)
pulumi config set --secret supabase_service_role_key <staging-key>
pulumi config set supabase_url <staging-url>
# ... copy other secrets from prod ...

# Deploy staging
pulumi up
```

## Files to Create/Modify

### New Files
- `lambda/Pulumi.staging.yaml` - Staging stack configuration
- `DEPLOYMENT.md` - Comprehensive deployment guide
- `scripts/deploy.sh` - Deployment helper script (optional)

### Files to Modify
- `lambda/Pulumi.dev.yaml` → `lambda/Pulumi.prod.yaml` (rename)
- `lambda/index.ts` - Add stack-based resource naming
- `main.go` - Add deploy commands and stack management
- `package.json` - Add build:staging and build:prod scripts
- `LOCAL_DEVELOPMENT.md` - Update to clarify local vs staging

### Files to Review
- `.gitignore` - Ensure `Pulumi.*.yaml` are NOT ignored (they contain encrypted secrets, safe to commit)
- `README.md` - Add link to DEPLOYMENT.md

## Testing Strategy

Before going live with staging:
1. Deploy staging infrastructure with test Supabase project
2. Run full E2E test suite against staging
3. Verify all Lambda actions work (seo-extract, youtube, transcribe, etc.)
4. Test OAuth flows with staging OAuth credentials
5. Validate secret rotation process
6. Practice rollback procedure

## Rollback Plan

If production deployment fails:
1. Revert infrastructure: `pulumi stack select prod && pulumi up --target-dependents <previous-lambda>`
2. Revert Supabase migration: Use Supabase dashboard to restore snapshot
3. Monitor for errors and data integrity issues

## Benefits of This Approach

✅ **Complete isolation**: Staging and prod never interfere
✅ **Pulumi-managed secrets**: Single source of truth for all environments
✅ **Simple workflow**: Go CLI provides clean deployment interface
✅ **Forward-only migrations**: Matches your stated requirement
✅ **Manual promotion**: Full control, no automated surprises
✅ **Standard Pulumi patterns**: Uses stack feature as intended

## Key Design Decisions (from requirements gathering)

1. **Separate Supabase projects**: Full isolation between staging and production
2. **Pulumi stacks**: Use staging/prod stacks (no dev stack, that's local only)
3. **Persistent staging data**: Staging data persists for regression testing
4. **Manual promotion via Go CLI**: Explicit `go run . deploy <env>` commands
5. **Forward-only migrations**: No migration rollbacks, only forward progress
6. **Pulumi as secret source of truth**: All Lambda secrets managed via Pulumi config
