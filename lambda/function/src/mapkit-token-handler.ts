import * as jwt from 'jsonwebtoken';

/**
 * MapKit JS JWT Token Handler
 *
 * Generates JWT tokens for Apple MapKit JS authentication.
 * Tokens are signed with the private key from Apple Developer Console.
 *
 * Required environment variables:
 * - MAPKIT_TEAM_ID: Apple Developer Team ID
 * - MAPKIT_KEY_ID: MapKit JS Key ID
 * - MAPKIT_PRIVATE_KEY: Base64-encoded .p8 private key file content
 */

interface MapKitTokenRequest {
  // Optional origin restriction for the token
  origin?: string;
}

interface MapKitTokenResponse {
  token: string;
  expires_at: number;
}

/**
 * Generate a MapKit JS JWT token
 *
 * @param request - Optional request parameters
 * @returns JWT token and expiration timestamp
 */
export async function generateMapKitToken(request: MapKitTokenRequest = {}): Promise<MapKitTokenResponse> {
  const teamId = process.env.MAPKIT_TEAM_ID;
  const keyId = process.env.MAPKIT_KEY_ID;
  const privateKeyBase64 = process.env.MAPKIT_PRIVATE_KEY;

  // Validate required environment variables
  if (!teamId) {
    throw new Error('MAPKIT_TEAM_ID environment variable is not set');
  }
  if (!keyId) {
    throw new Error('MAPKIT_KEY_ID environment variable is not set');
  }
  if (!privateKeyBase64) {
    throw new Error('MAPKIT_PRIVATE_KEY environment variable is not set');
  }

  // Decode the base64-encoded private key
  // The private key is in PEM format (PKCS#8) from Apple's .p8 file
  const privateKey = Buffer.from(privateKeyBase64, 'base64').toString('utf-8');

  // Token expiration: 1 hour from now
  const now = Math.floor(Date.now() / 1000);
  const expiresAt = now + 3600; // 1 hour

  // JWT payload following Apple's MapKit JS requirements
  const payload = {
    iss: teamId,
    iat: now,
    exp: expiresAt,
    ...(request.origin && { origin: request.origin })
  };

  // Sign the JWT using jsonwebtoken (following Apple's example)
  let token: string;
  try {
    token = jwt.sign(payload, privateKey, {
      algorithm: 'ES256',
      keyid: keyId,
    });
  } catch (error) {
    console.error('Failed to sign MapKit JWT:', error);
    throw new Error('Failed to generate MapKit token: ' + (error as Error).message);
  }

  return {
    token,
    expires_at: expiresAt,
  };
}

/**
 * Handle MapKit token request
 *
 * Lambda handler function for generating MapKit JS tokens
 */
export async function handleMapKitTokenRequest(event: any): Promise<any> {
  try {
    // Parse request body if present
    let requestBody: MapKitTokenRequest = {};
    if (event.body) {
      try {
        requestBody = JSON.parse(event.body);
      } catch (error) {
        console.warn('Failed to parse request body, using default options');
      }
    }

    // Generate token
    const response = await generateMapKitToken(requestBody);

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
      body: JSON.stringify(response),
    };
  } catch (error) {
    console.error('MapKit token generation error:', error);

    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        error: 'Failed to generate MapKit token',
        message: (error as Error).message,
      }),
    };
  }
}
