import * as pulumi from '@pulumi/pulumi';
import * as aws from '@pulumi/aws';
import * as path from 'path';

// Get configuration
const config = new pulumi.Config();
const anthropicApiKey = config.requireSecret('anthropic_api_key');
const supabaseServiceRoleKey = config.requireSecret('supabase_service_role_key');
const supabaseUrl = config.require('supabase_url');

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
		Statement: [{
			Effect: 'Allow',
			Action: [
				's3:GetObject',
				's3:PutObject',
				's3:HeadObject',
				's3:DeleteObject'
			],
			Resource: `${bucketArn}/*`
		}]
	}))
});

// Build Lambda package - use bundled file (CommonJS format, no package.json type needed)
const lambdaCode = new pulumi.asset.AssetArchive({
	'index.js': new pulumi.asset.FileAsset('./function/dist/index.bundled.js')
});

// Create Lambda function
const lambdaFunction = new aws.lambda.Function('claude-code-lambda', {
	runtime: aws.lambda.Runtime.NodeJS20dX,
	role: lambdaRole.arn,
	handler: 'index.handler',
	code: lambdaCode,
	timeout: 300, // 5 minutes
	memorySize: 2048, // 2GB for Claude SDK
	environment: {
		variables: {
			NODE_ENV: 'production',
			S3_BUCKET_NAME: sessionBucket.bucket,
			ANTHROPIC_API_KEY: anthropicApiKey,
			SUPABASE_SERVICE_ROLE_KEY: supabaseServiceRoleKey,
			SUPABASE_URL: supabaseUrl
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

// Create route for /claude-code
const route = new aws.apigatewayv2.Route('claude-code-route', {
	apiId: api.id,
	routeKey: 'POST /claude-code',
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

// Export outputs
export const apiUrl = pulumi.interpolate`${api.apiEndpoint}/claude-code`;
export const bucketName = sessionBucket.bucket;
export const lambdaArn = lambdaFunction.arn;
