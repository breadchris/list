# Deployment Checklist

Follow these steps to deploy the Claude Code Lambda function.

## Pre-Deployment

- [ ] AWS CLI configured with valid credentials
- [ ] Pulumi CLI installed (`curl -fsSL https://get.pulumi.com | sh`)
- [ ] Node.js 20.x or later installed
- [ ] Anthropic API key ready
- [ ] Supabase service role key ready

## Build & Configure

### 1. Install Dependencies
```bash
# Install Lambda function dependencies
cd lambda/function
npm install

# Install Pulumi dependencies
cd ..
npm install
```

- [ ] Lambda function dependencies installed
- [ ] Pulumi dependencies installed

### 2. Build Lambda Code
```bash
cd lambda/function
npm run build
```

- [ ] TypeScript compiled to `/lambda/function/dist`
- [ ] No build errors

### 3. Initialize Pulumi Stack
```bash
cd lambda
pulumi login  # Or pulumi login --local for local state
pulumi stack init dev
```

- [ ] Pulumi stack initialized
- [ ] Stack name: `dev`

### 4. Configure Secrets
```bash
cd lambda

# Set Anthropic API key
pulumi config set --secret anthropic_api_key sk-ant-...

# Set Supabase service role key
pulumi config set --secret supabase_service_role_key eyJhbGc...

# Verify configuration
pulumi config
```

- [ ] `anthropic_api_key` set (secret)
- [ ] `supabase_service_role_key` set (secret)
- [ ] `supabase_url` set (from Pulumi.dev.yaml)
- [ ] `aws:region` set to `us-east-1`

## Deploy Infrastructure

### 5. Preview Deployment
```bash
cd lambda
pulumi preview
```

Expected resources:
- [ ] S3 bucket: `claude-code-sessions`
- [ ] IAM role: `claude-code-lambda-role`
- [ ] IAM policies (2): basic execution + S3 access
- [ ] Lambda function: `claude-code-lambda`
- [ ] API Gateway HTTP API
- [ ] API Gateway integration
- [ ] API Gateway route: `POST /claude-code`
- [ ] API Gateway stage: `$default`
- [ ] Lambda permission for API Gateway

Total: **~10 resources**

### 6. Deploy
```bash
cd lambda
pulumi up
```

- [ ] Review preview
- [ ] Confirm deployment (`yes`)
- [ ] Wait for completion (2-3 minutes)
- [ ] No errors in output

### 7. Verify Outputs
```bash
cd lambda
pulumi stack output
```

Expected outputs:
- [ ] `apiUrl`: `https://{api-id}.execute-api.us-east-1.amazonaws.com/claude-code`
- [ ] `bucketName`: `claude-code-sessions`
- [ ] `lambdaArn`: `arn:aws:lambda:us-east-1:{account}:function:claude-code-lambda`

## Testing

### 8. Manual Test
```bash
# Get API URL
API_URL=$(cd lambda && pulumi stack output apiUrl)

# Test endpoint
curl -X POST "$API_URL" \
  -H "Content-Type: application/json" \
  -d '{"prompt": "What is 2 + 2?"}' | jq
```

Expected response:
- [ ] `success: true`
- [ ] `session_id` present
- [ ] `messages` array present
- [ ] `s3_url` present
- [ ] No errors

### 9. Run Test Suite
```bash
cd lambda

# Set Lambda URL from Pulumi
export LAMBDA_API_URL=$(pulumi stack output apiUrl)

# Run tests
npm test
```

- [ ] All 19 tests pass
- [ ] No test failures
- [ ] Test process terminates properly

## Post-Deployment

### 10. Verify AWS Resources

Check AWS Console:

**S3:**
- [ ] Bucket `claude-code-sessions` exists
- [ ] Versioning enabled
- [ ] Encryption enabled

**Lambda:**
- [ ] Function `claude-code-lambda` exists
- [ ] Runtime: Node.js 20.x
- [ ] Timeout: 300 seconds
- [ ] Memory: 2048 MB
- [ ] Environment variables set (4)

**API Gateway:**
- [ ] HTTP API exists
- [ ] Route `POST /claude-code` configured
- [ ] CORS enabled
- [ ] Stage `$default` deployed

**IAM:**
- [ ] Role `claude-code-lambda-role` exists
- [ ] Policies attached (2)
- [ ] Trust relationship: lambda.amazonaws.com

### 11. Monitor CloudWatch Logs

```bash
aws logs tail /aws/lambda/claude-code-lambda --follow
```

- [ ] Log group exists
- [ ] Logs streaming properly
- [ ] No unexpected errors

### 12. Update Frontend

Update your frontend application to use new endpoint:

```typescript
const CLAUDE_CODE_API = 'https://{api-id}.execute-api.us-east-1.amazonaws.com/claude-code';
```

- [ ] Frontend updated
- [ ] API URL configured
- [ ] Test from browser

## Rollback (If Needed)

If deployment fails or has issues:

```bash
cd lambda
pulumi destroy
```

- [ ] Confirm destruction
- [ ] All resources removed
- [ ] S3 bucket deleted (check manually if versioned)

Then fix issues and redeploy.

## Success Criteria

- ✅ All infrastructure deployed
- ✅ All 19 tests passing
- ✅ Manual curl test successful
- ✅ CloudWatch logs showing execution
- ✅ No errors in Lambda executions
- ✅ Frontend integrated and working

## Troubleshooting

### Build fails
- Check Node.js version: `node --version` (should be 20.x)
- Delete `function/node_modules` and reinstall in `lambda/function/`
- Check TypeScript errors: `cd lambda/function && npm run build`

### Pulumi deployment fails
- Check AWS credentials: `aws sts get-caller-identity`
- Verify IAM permissions for creating resources
- Check Pulumi state: `pulumi stack`

### Lambda timeout
- Check CloudWatch Logs for errors
- Increase timeout in `infra/index.ts`
- Verify `/tmp` has space

### API Gateway 403/404
- Verify route configured correctly
- Check Lambda permission
- Test Lambda directly via AWS Console

### Tests fail
- Verify `LAMBDA_API_URL` set correctly
- Check API is publicly accessible
- Review test output for specific errors
- Verify CORS headers in response

## Next Steps

After successful deployment:
1. Set up CloudWatch alarms for errors
2. Configure auto-scaling (if needed)
3. Set up CI/CD pipeline
4. Monitor costs in AWS Cost Explorer
5. Document API endpoint for team
