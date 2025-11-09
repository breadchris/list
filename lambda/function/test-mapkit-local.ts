import { generateMapKitToken } from './src/mapkit-token-handler.js';

async function test() {
  console.log('Testing MapKit token generation locally...\n');

  // Set environment variables from Pulumi config
  // These would normally be set in the shell

  try {
    const result = await generateMapKitToken({
      origin: 'https://list-lyart.vercel.app'
    });

    console.log('✅ Success!');
    console.log('Token:', result.token);
    console.log('Expires at:', result.expires_at);
    console.log('Expiry date:', new Date(result.expires_at * 1000).toISOString());

    // Decode the JWT to verify structure
    const parts = result.token.split('.');
    const header = JSON.parse(Buffer.from(parts[0], 'base64').toString());
    const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());

    console.log('\nJWT Header:', JSON.stringify(header, null, 2));
    console.log('JWT Payload:', JSON.stringify(payload, null, 2));

  } catch (error) {
    console.error('❌ Error:', error instanceof Error ? error.message : error);
    console.error('Stack:', error);
    process.exit(1);
  }
}

test();
