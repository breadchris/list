import { DocumentManager } from '@y-sweet/sdk';
import { NextResponse } from 'next/server';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

const connectionString = process.env.CONNECTION_STRING;

if (!connectionString) {
  throw new Error(
    'CONNECTION_STRING environment variable is required. ' +
    'Get one from https://jamsocket.com/dashboard'
  );
}

const manager = new DocumentManager(connectionString);

// Handle preflight OPTIONS request for CORS
export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders });
}

export async function POST(request: Request) {
  try {
    const { docId } = await request.json();

    if (!docId) {
      return NextResponse.json(
        { error: 'docId is required in request body' },
        { status: 400, headers: corsHeaders }
      );
    }

    // Return readonly token - mutations will be ignored by Y-Sweet server
    const clientToken = await manager.getOrCreateDocAndToken(docId, {
      authorization: 'read-only',
    });

    return NextResponse.json(clientToken, { headers: corsHeaders });
  } catch (error) {
    console.error('Error generating readonly Y-Sweet token:', error);
    return NextResponse.json(
      { error: 'Failed to generate authentication token' },
      { status: 500, headers: corsHeaders }
    );
  }
}
