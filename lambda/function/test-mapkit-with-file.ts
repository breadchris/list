import * as jwt from 'jsonwebtoken';
import * as fs from 'fs';

// Read the private key from the downloaded .p8 file
const privateKeyPath = '/Users/hacked/Downloads/AuthKey_F6NF76RBH9.p8';
const privateKey = fs.readFileSync(privateKeyPath, 'utf8');

const keyId = 'F6NF76RBH9';
const teamId = 'GXTMGDAFNK';

console.log('Testing MapKit token generation with actual .p8 file...\n');

const now = Math.floor(Date.now() / 1000);
const expiresAt = now + 3600; // 1 hour

const payload = {
  iss: teamId,
  iat: now,
  exp: expiresAt,
  origin: 'https://list-lyart.vercel.app'
};

try {
  const token = jwt.sign(payload, privateKey, {
    algorithm: 'ES256',
    keyid: keyId,
  });

  console.log('✅ Success!');
  console.log('Token:', token);
  console.log('Expires at:', expiresAt);
  console.log('Expiry date:', new Date(expiresAt * 1000).toISOString());

  // Decode the JWT to verify structure
  const parts = token.split('.');
  const header = JSON.parse(Buffer.from(parts[0], 'base64').toString());
  const decoded = JSON.parse(Buffer.from(parts[1], 'base64').toString());

  console.log('\nJWT Header:', JSON.stringify(header, null, 2));
  console.log('JWT Payload:', JSON.stringify(decoded, null, 2));
} catch (error) {
  console.error('❌ Error:', error);
  process.exit(1);
}
