#!/usr/bin/env tsx
/**
 * Standalone Lambda Server for Local Development
 *
 * Runs the Lambda handler as a regular Node.js HTTP server without Docker.
 * Perfect for quick iterations and debugging with native Node.js tools.
 *
 * Usage:
 *   npm run dev:local
 *
 * The server will:
 * - Load environment variables from .env.local
 * - Start HTTP server on port 9001 (configurable via PORT env var)
 * - Accept Lambda-formatted requests as HTTP POST /invoke
 * - Return Lambda-formatted responses
 */

import http from 'http';
import { config } from 'dotenv';
import type { APIGatewayProxyEventV2 } from 'aws-lambda';

// Load environment variables from .env.local
config({ path: '.env.local' });

// Mock the awslambda module for local development
// This allows the Lambda code to load without errors
(global as any).awslambda = {
  streamifyResponse: () => {
    // This is a stub - streaming responses won't work locally
    // but the module will load successfully
    return () => {};
  },
  HttpResponseStream: {
    from: (stream: any, metadata: any) => stream
  }
};

// Import handler dynamically to use with async
async function loadHandler() {
  const module = await import('./src/index.js');
  return module.handler;
}

const PORT = process.env.PORT || 9001;

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400',
};

/**
 * Convert HTTP request to Lambda event format
 */
function createLambdaEvent(req: http.IncomingMessage, body: string): APIGatewayProxyEventV2 | any {
  const url = new URL(req.url || '/', `http://${req.headers.host}`);

  // Try to parse body as JSON for direct invocation format
  let parsedBody: any = body;
  try {
    parsedBody = JSON.parse(body);
  } catch (e) {
    // Not JSON, use as-is
  }

  // If body has 'action' field, it's a direct Lambda invocation (not API Gateway)
  if (parsedBody && typeof parsedBody === 'object' && 'action' in parsedBody) {
    return parsedBody;
  }

  // Otherwise, format as API Gateway event
  return {
    version: '2.0',
    routeKey: '$default',
    rawPath: url.pathname,
    rawQueryString: url.search.substring(1),
    headers: req.headers as Record<string, string>,
    requestContext: {
      http: {
        method: req.method || 'GET',
        path: url.pathname,
        protocol: 'HTTP/1.1',
        sourceIp: '127.0.0.1',
        userAgent: req.headers['user-agent'] || '',
      },
      routeKey: '$default',
      stage: '$default',
      time: new Date().toISOString(),
      timeEpoch: Date.now(),
    },
    body: body || undefined,
    isBase64Encoded: false,
  };
}

/**
 * Main server initialization
 */
async function main() {
  // Load handler
  const handler = await loadHandler();

  /**
   * Create HTTP server that wraps Lambda handler
   */
  const server = http.createServer(async (req, res) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);

    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
      res.writeHead(204, corsHeaders);
      res.end();
      return;
    }

    // Read request body
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });

    req.on('end', async () => {
      try {
        // Create Lambda event from HTTP request
        const event = createLambdaEvent(req, body);

        console.log('[REQUEST]', JSON.stringify(event, null, 2).substring(0, 500));

        // Invoke Lambda handler
        const result = await handler(event, {} as any);

        console.log('[RESPONSE]', JSON.stringify(result, null, 2).substring(0, 500));

        // Handle different response types
        if (result && typeof result === 'object') {
          // Check if it's a Web API Response object (from streaming handlers)
          if (result instanceof Response || (result.body && result.headers && typeof result.headers.forEach === 'function')) {
            console.log('[RESPONSE] Detected Web API Response object - streaming mode');

            // Extract headers from Response
            const responseHeaders: Record<string, string> = { ...corsHeaders };
            result.headers.forEach((value: string, key: string) => {
              responseHeaders[key] = value;
            });

            // Write HTTP response headers
            res.writeHead(result.status || 200, responseHeaders);

            // Stream the body
            const reader = result.body.getReader();
            try {
              while (true) {
                const { done, value } = await reader.read();
                if (done) {
                  res.end();
                  return;
                }
                // Write chunk to HTTP response
                res.write(value);
              }
            } catch (error) {
              console.error('[STREAM ERROR]', error);
              res.end();
            }
            return; // Exit early after streaming
          }

          // Lambda response format (statusCode/body)
          const statusCode = result.statusCode || 200;
          const headers = {
            ...corsHeaders,
            'Content-Type': 'application/json',
            ...result.headers,
          };

          res.writeHead(statusCode, headers);
          res.end(result.body || JSON.stringify(result));
        } else {
          // Direct response (not API Gateway format)
          res.writeHead(200, {
            ...corsHeaders,
            'Content-Type': 'application/json',
          });
          res.end(JSON.stringify(result));
        }
      } catch (error) {
        console.error('[ERROR]', error);

        res.writeHead(500, {
          ...corsHeaders,
          'Content-Type': 'application/json',
        });
        res.end(JSON.stringify({
          success: false,
          error: error instanceof Error ? error.message : 'Internal server error',
        }));
      }
    });
  });

  // Start server
  server.listen(PORT, () => {
    console.log('');
    console.log('🚀 Standalone Lambda Server');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`📡 Server listening on http://localhost:${PORT}`);
    console.log('');
    console.log('Endpoints:');
    console.log(`  • POST http://localhost:${PORT}/invoke`);
    console.log(`  • POST http://localhost:${PORT}/content`);
    console.log(`  • POST http://localhost:${PORT}/claude-code`);
    console.log(`  • GET  http://localhost:${PORT}/health`);
    console.log('');
    console.log('Environment:');
    console.log(`  • SUPABASE_URL: ${process.env.SUPABASE_URL}`);
    console.log(`  • ANTHROPIC_API_KEY: ${process.env.ANTHROPIC_API_KEY ? '✓ Set' : '✗ Not set'}`);
    console.log(`  • OPENAI_API_KEY: ${process.env.OPENAI_API_KEY ? '✓ Set' : '✗ Not set'}`);
    console.log(`  • CLOUDFLARE_API_KEY: ${process.env.CLOUDFLARE_API_KEY ? '✓ Set' : '✗ Not set'}`);
    console.log('');
    console.log('💡 Press Ctrl+C to stop');
    console.log('');
  });

  // Graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n\n👋 Shutting down gracefully...');
    server.close(() => {
      console.log('✅ Server stopped');
      process.exit(0);
    });
  });

  process.on('SIGTERM', () => {
    console.log('\n\n👋 Shutting down gracefully...');
    server.close(() => {
      console.log('✅ Server stopped');
      process.exit(0);
    });
  });
}

// Start the server
main().catch(error => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
