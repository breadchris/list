import * as pulumi from '@pulumi/pulumi';
import * as aws from '@pulumi/aws';
import * as docker from '@pulumi/docker';

// Get configuration
const config = new pulumi.Config();
const anthropicApiKey = config.requireSecret('anthropic_api_key');
const supabaseServiceRoleKey = config.requireSecret('supabase_service_role_key');
const supabaseUrl = config.require('supabase_url');
const openaiApiKey = config.requireSecret('openai_api_key');
const cloudflareApiKey = config.requireSecret('cloudflare_api_key');
const cloudflareAccountId = config.require('cloudflare_account_id');
const tmdbApiKey = config.requireSecret('tmdb_api_key');
const deepgramApiKey = config.requireSecret('deepgram_api_key');
const mapkitTeamId = config.require('mapkit_team_id');
const mapkitKeyId = config.require('mapkit_key_id');
const mapkitPrivateKey = config.requireSecret('mapkit_private_key');
const tellerClientCert = config.requireSecret('teller_client_cert');
const tellerClientKey = config.requireSecret('teller_client_key');

// Create S3 bucket for Claude Code sessions
const sessionBucket = new aws.s3.Bucket('claude-code-sessions', {
	bucket: 'claude-code-sessions',
	acl: 'private',
	versioning: {
		enabled: true
	},
	serverSideEncryptionConfiguration: {
		rule: {
			applyServerSideEncryptionByDefault: {
				sseAlgorithm: 'AES256'
			}
		}
	},
	tags: {
		Name: 'Claude Code Sessions',
		ManagedBy: 'Pulumi'
	}
});

// Create IAM role for Lambda
const lambdaRole = new aws.iam.Role('claude-code-lambda-role', {
	assumeRolePolicy: JSON.stringify({
		Version: '2012-10-17',
		Statement: [{
			Action: 'sts:AssumeRole',
			Effect: 'Allow',
			Principal: {
				Service: 'lambda.amazonaws.com'
			}
		}]
	}),
	tags: {
		Name: 'Claude Code Lambda Role',
		ManagedBy: 'Pulumi'
	}
});

// Attach basic Lambda execution policy
const lambdaBasicPolicy = new aws.iam.RolePolicyAttachment('lambda-basic-execution', {
	role: lambdaRole.name,
	policyArn: 'arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole'
});

// Create custom policy for S3 access
const s3Policy = new aws.iam.RolePolicy('lambda-s3-policy', {
	role: lambdaRole.id,
	policy: sessionBucket.arn.apply(bucketArn => JSON.stringify({
		Version: '2012-10-17',
		Statement: [
			{
				Effect: 'Allow',
				Action: [
					's3:ListBucket',
					's3:GetBucketLocation'
				],
				Resource: bucketArn // Bucket-level permissions
			},
			{
				Effect: 'Allow',
				Action: [
					's3:GetObject',
					's3:PutObject',
					's3:HeadObject',
					's3:DeleteObject'
				],
				Resource: `${bucketArn}/*` // Object-level permissions
			}
		]
	}))
});

// Create custom policy for SQS access
const sqsPolicy = new aws.iam.RolePolicy('lambda-sqs-policy', {
	role: lambdaRole.id,
	policy: pulumi.interpolate`{
		"Version": "2012-10-17",
		"Statement": [
			{
				"Effect": "Allow",
				"Action": [
					"sqs:ReceiveMessage",
					"sqs:DeleteMessage",
					"sqs:GetQueueAttributes",
					"sqs:SendMessage"
				],
				"Resource": "*"
			}
		]
	}`
});

// Create ECR repository for Lambda Docker image
const ecrRepo = new aws.ecr.Repository('claude-code-lambda-repo', {
	name: 'claude-code-lambda',
	forceDelete: true, // Allow deletion even with images
	tags: {
		Name: 'Claude Code Lambda Repository',
		ManagedBy: 'Pulumi'
	}
});

// Get ECR authorization token
const authToken = aws.ecr.getAuthorizationTokenOutput({
	registryId: ecrRepo.registryId
});

// Build and push Docker image to ECR
const image = new docker.Image('claude-code-lambda-image', {
	imageName: pulumi.interpolate`${ecrRepo.repositoryUrl}:latest`,
	build: {
		context: './function',
		dockerfile: './function/Dockerfile',
		platform: 'linux/amd64' // Lambda requires amd64
	},
	registry: {
		server: ecrRepo.repositoryUrl,
		username: authToken.userName,
		password: authToken.password
	}
});

// Create SQS Dead Letter Queue for failed content processing jobs
const contentDLQ = new aws.sqs.Queue('content-processing-dlq', {
	name: 'content-processing-dlq',
	messageRetentionSeconds: 1209600, // 14 days
	tags: {
		Name: 'Content Processing DLQ',
		ManagedBy: 'Pulumi'
	}
});

// Create SQS Queue for content processing jobs
const contentQueue = new aws.sqs.Queue('content-processing-queue', {
	name: 'content-processing-queue',
	visibilityTimeoutSeconds: 360, // 6 minutes (longer than Lambda timeout)
	messageRetentionSeconds: 345600, // 4 days
	receiveWaitTimeSeconds: 20, // Long polling
	redrivePolicy: contentDLQ.arn.apply(dlqArn => JSON.stringify({
		deadLetterTargetArn: dlqArn,
		maxReceiveCount: 3 // Retry failed messages 3 times before moving to DLQ
	})),
	tags: {
		Name: 'Content Processing Queue',
		ManagedBy: 'Pulumi'
	}
});

// Create Lambda function with Docker image
const lambdaFunction = new aws.lambda.Function('claude-code-lambda', {
	packageType: 'Image',
	role: lambdaRole.arn,
	imageUri: image.imageName,
	timeout: 300, // 5 minutes
	memorySize: 2048, // 2GB for Claude SDK
	environment: {
		variables: {
			NODE_ENV: 'production',
			S3_BUCKET_NAME: sessionBucket.bucket,
			CONTENT_QUEUE_URL: contentQueue.url,
			ANTHROPIC_API_KEY: anthropicApiKey,
			SUPABASE_SERVICE_ROLE_KEY: supabaseServiceRoleKey,
			SUPABASE_URL: supabaseUrl,
			OPENAI_API_KEY: openaiApiKey,
			CLOUDFLARE_API_KEY: cloudflareApiKey,
			CLOUDFLARE_ACCOUNT_ID: cloudflareAccountId,
			TMDB_API_KEY: tmdbApiKey,
			DEEPGRAM_API_KEY: deepgramApiKey,
			MAPKIT_TEAM_ID: mapkitTeamId,
			MAPKIT_KEY_ID: mapkitKeyId,
			MAPKIT_PRIVATE_KEY: mapkitPrivateKey,
			TELLER_CLIENT_CERT: tellerClientCert,
			TELLER_CLIENT_KEY: tellerClientKey,
			HOME: '/tmp', // Claude CLI needs a HOME directory for config
			IS_SANDBOX: '1' // Enable bypassPermissions mode for Claude CLI
		}
	},
	tags: {
		Name: 'Claude Code Lambda',
		ManagedBy: 'Pulumi'
	}
});

// Create API Gateway HTTP API
const api = new aws.apigatewayv2.Api('claude-code-api', {
	protocolType: 'HTTP',
	corsConfiguration: {
		allowOrigins: ['*'],
		allowMethods: ['GET', 'POST', 'OPTIONS'],
		allowHeaders: ['Content-Type'],
		maxAge: 86400
	},
	tags: {
		Name: 'Claude Code API',
		ManagedBy: 'Pulumi'
	}
});

// Create Lambda integration
const integration = new aws.apigatewayv2.Integration('lambda-integration', {
	apiId: api.id,
	integrationType: 'AWS_PROXY',
	integrationUri: lambdaFunction.arn,
	payloadFormatVersion: '2.0'
});

// Create route for /content (unified endpoint for all operations)
const contentRoute = new aws.apigatewayv2.Route('content-route', {
	apiId: api.id,
	routeKey: 'POST /content',
	target: pulumi.interpolate`integrations/${integration.id}`
});

// Create route for /health (health check endpoint)
const healthRoute = new aws.apigatewayv2.Route('health-route', {
	apiId: api.id,
	routeKey: 'GET /health',
	target: pulumi.interpolate`integrations/${integration.id}`
});

// Create route for /mapkit/token (MapKit JWT token generation)
const mapkitTokenRoute = new aws.apigatewayv2.Route('mapkit-token-route', {
	apiId: api.id,
	routeKey: 'POST /mapkit/token',
	target: pulumi.interpolate`integrations/${integration.id}`
});

// Create default stage
const stage = new aws.apigatewayv2.Stage('default-stage', {
	apiId: api.id,
	name: '$default',
	autoDeploy: true,
	tags: {
		Name: 'Claude Code API Default Stage',
		ManagedBy: 'Pulumi'
	}
});

// Grant API Gateway permission to invoke Lambda
const lambdaPermission = new aws.lambda.Permission('api-gateway-invoke', {
	action: 'lambda:InvokeFunction',
	function: lambdaFunction.name,
	principal: 'apigateway.amazonaws.com',
	sourceArn: pulumi.interpolate`${api.executionArn}/*/*`
});

// Create Lambda event source mapping for SQS content queue
const sqsEventSource = new aws.lambda.EventSourceMapping('content-queue-event-source', {
	eventSourceArn: contentQueue.arn,
	functionName: lambdaFunction.name,
	batchSize: 1, // Process one message at a time (jobs can be long-running)
	maximumBatchingWindowInSeconds: 0, // Start processing immediately
	functionResponseTypes: ['ReportBatchItemFailures'], // Enable partial batch responses
	scalingConfig: {
		maximumConcurrency: 10 // Limit concurrent executions to 10
	},
	tags: {
		Name: 'Content Queue Event Source',
		ManagedBy: 'Pulumi'
	}
});

// Create IAM user for Supabase Edge Function (read-only S3 access)
const supabaseUser = new aws.iam.User('supabase-edge-function-user', {
	name: 'supabase-edge-function-s3-read',
	tags: {
		Name: 'Supabase Edge Function User',
		ManagedBy: 'Pulumi'
	}
});

// Create read-only S3 policy for Supabase Edge Function
const supabaseS3ReadPolicy = new aws.iam.UserPolicy('supabase-s3-read-policy', {
	user: supabaseUser.name,
	policy: sessionBucket.arn.apply(bucketArn => JSON.stringify({
		Version: '2012-10-17',
		Statement: [
			{
				Effect: 'Allow',
				Action: [
					's3:GetObject',
					's3:ListBucket'
				],
				Resource: [
					bucketArn,        // Bucket-level permissions for ListBucket
					`${bucketArn}/*`  // Object-level permissions for GetObject
				]
			}
		]
	}))
});

// Create access key for Supabase Edge Function
const supabaseAccessKey = new aws.iam.AccessKey('supabase-access-key', {
	user: supabaseUser.name
});

// Export outputs
export const apiUrl = pulumi.interpolate`${api.apiEndpoint}/content`;
export const contentEndpoint = pulumi.interpolate`${api.apiEndpoint}/content`;
export const bucketName = sessionBucket.bucket;
export const lambdaArn = lambdaFunction.arn;

// Export SQS queue information
export const contentQueueUrl = contentQueue.url;
export const contentQueueArn = contentQueue.arn;
export const contentDLQUrl = contentDLQ.url;
export const contentDLQArn = contentDLQ.arn;

// Export Supabase Edge Function credentials (for setting as Supabase secrets)
export const supabaseAwsAccessKeyId = supabaseAccessKey.id;
export const supabaseAwsSecretAccessKey = pulumi.secret(supabaseAccessKey.secret);
export const supabaseAwsRegion = pulumi.output('us-east-1');
export const supabaseS3BucketName = sessionBucket.bucket;
export const supabaseLambdaEndpoint = pulumi.interpolate`${api.apiEndpoint}/content`;
