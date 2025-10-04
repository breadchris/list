# Lambda Directory Structure

## Overview

The Lambda directory is organized with isolated deployable code and infrastructure code at the root level.

## Directory Layout

```
/lambda/
├── function/                    # Deployable Lambda code (isolated)
│   ├── src/
│   │   ├── index.ts            # Lambda handler
│   │   ├── claude-executor.ts  # Claude Code SDK wrapper
│   │   └── session-manager.ts  # S3 session storage
│   ├── dist/                   # Build output (created by tsc)
│   ├── package.json            # Lambda runtime dependencies
│   ├── package-lock.json
│   ├── node_modules/           # Lambda dependencies only
│   └── tsconfig.json           # Lambda TypeScript config
│
├── tests/
│   └── claude-code-lambda.spec.ts  # Playwright E2E tests
│
├── index.ts                    # Pulumi infrastructure code
├── package.json                # Pulumi dependencies
├── node_modules/               # Pulumi dependencies only
├── tsconfig.json               # Pulumi TypeScript config
├── Pulumi.yaml                 # Pulumi project config
├── Pulumi.dev.yaml             # Dev stack config
├── playwright.config.ts        # Test configuration
├── .gitignore
├── README.md                   # Main documentation
├── DEPLOYMENT_CHECKLIST.md     # Step-by-step deployment guide
├── MIGRATION.md                # Migration from Cloudflare Worker
└── STRUCTURE.md                # This file
```

## Key Principles

### 1. Isolation of Deployable Code

The `/function/` directory contains ONLY the code that gets deployed to Lambda:
- **Source code**: Handler and business logic
- **Dependencies**: Only runtime dependencies (`@aws-sdk`, `@anthropic-ai`, etc.)
- **Build output**: TypeScript compiled to JavaScript in `function/dist/`

This isolation ensures:
- ✅ Clean separation of concerns
- ✅ Smaller deployment packages (no Pulumi deps)
- ✅ Independent dependency management
- ✅ Easier testing and debugging

### 2. Infrastructure at Root

Pulumi infrastructure code lives at `/lambda/` root level:
- **Infrastructure code**: `index.ts` defines AWS resources
- **Pulumi config**: `Pulumi.yaml`, stack configs
- **Pulumi dependencies**: `@pulumi/aws`, `@pulumi/pulumi`

This provides:
- ✅ Standard Pulumi project layout
- ✅ Clear separation from deployable code
- ✅ Easy access to infrastructure commands

### 3. Shared Resources

Some resources are shared at the root:
- **Tests**: E2E tests that call the deployed API
- **Documentation**: Comprehensive guides and checklists
- **Playwright config**: Test runner configuration

## Build Workflow

### Step 1: Build Lambda Function
```bash
cd lambda/function
npm install
npm run build
```

This creates:
- `function/dist/index.js` - Lambda handler
- `function/dist/claude-executor.js`
- `function/dist/session-manager.js`
- Source maps for debugging

### Step 2: Deploy with Pulumi
```bash
cd lambda
npm install  # Install Pulumi dependencies
pulumi up
```

Pulumi reads `function/dist/` and packages it for Lambda deployment.

## Dependency Management

### Lambda Function Dependencies (`function/package.json`)
```json
{
  "dependencies": {
    "@anthropic-ai/claude-agent-sdk": "^0.1.0",
    "@aws-sdk/client-s3": "^3.698.0",
    "@supabase/supabase-js": "^2.47.10",
    "jszip": "^3.10.1"
  }
}
```

These are deployed to Lambda.

### Pulumi Dependencies (`package.json`)
```json
{
  "dependencies": {
    "@pulumi/pulumi": "^3.0.0",
    "@pulumi/aws": "^6.0.0"
  }
}
```

These are NOT deployed to Lambda - only used for infrastructure deployment.

## Benefits of This Structure

1. **Smaller Lambda Packages**
   - Only function code and its dependencies
   - No infrastructure or test dependencies
   - Faster deployments and cold starts

2. **Clear Separation**
   - Easy to find Lambda code vs infrastructure
   - Prevents accidental inclusion of dev dependencies
   - Simpler to reason about what gets deployed

3. **Independent Updates**
   - Update Lambda code without touching infrastructure
   - Update infrastructure without rebuilding Lambda
   - Clear versioning of each component

4. **Standard Practices**
   - Follows Pulumi best practices
   - Familiar to developers with Lambda experience
   - Easy to integrate with CI/CD pipelines

## Common Tasks

### Add a Lambda Dependency
```bash
cd lambda/function
npm install <package>
npm run build
cd ..
pulumi up
```

### Update Infrastructure
```bash
cd lambda
# Edit index.ts
pulumi up
```

### Run Tests
```bash
cd lambda
export LAMBDA_API_URL=$(pulumi stack output apiUrl)
npm test
```

### Clean Build
```bash
cd lambda/function
rm -rf dist node_modules
npm install
npm run build
```

## Migration Notes

This structure was reorganized from the initial layout where:
- Lambda code was in `/lambda/src/`
- Pulumi code was in `/lambda/infra/`
- Single `node_modules` with mixed dependencies

The new structure provides better isolation and follows standard Pulumi patterns.
