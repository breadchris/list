/**
 * Wiki Export Lambda Handler
 * Handles BlockNote document export to HTML/Markdown
 *
 * Supports two modes:
 * 1. Direct blocks mode: Receive blocks array and export
 * 2. Y.js mode: Connect to Y-Sweet, read doc, and export all pages
 */

import type { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { handleBlockNoteExport, type BlockNoteExportPayload } from './blocknote-handler.js';
import { handleYjsExport, type YjsExportPayload } from './yjs-handler.js';

const CORS_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function jsonResponse(statusCode: number, body: any): APIGatewayProxyResultV2 {
  return {
    statusCode,
    headers: CORS_HEADERS,
    body: JSON.stringify(body),
  };
}

export const handler = async (
  event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyResultV2> => {
  console.log('Wiki Export Lambda invoked');

  // Handle CORS preflight
  if (event.requestContext?.http?.method === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: '',
    };
  }

  try {
    // Parse request body
    if (!event.body) {
      return jsonResponse(400, { success: false, error: 'Missing request body' });
    }

    let body: any;
    try {
      body = JSON.parse(event.body);
    } catch (e) {
      return jsonResponse(400, { success: false, error: 'Invalid JSON body' });
    }

    // Route based on mode
    if (body.mode === 'yjs' || body.doc_id) {
      // Y.js mode: fetch doc from Y-Sweet and export all pages
      const payload: YjsExportPayload = {
        doc_id: body.doc_id,
        page_ids: body.page_ids || [],
        pages: body.pages || [],
        format: body.format || 'all',
        store_backup: body.store_backup,
      };

      const result = await handleYjsExport(payload);

      if (!result.success) {
        return jsonResponse(400, result);
      }

      return jsonResponse(200, result);
    } else {
      // Direct blocks mode: export provided blocks
      const payload: BlockNoteExportPayload = {
        blocks: body.blocks,
        format: body.format || 'all',
      };

      const result = await handleBlockNoteExport(payload);

      if (!result.success) {
        return jsonResponse(400, result);
      }

      return jsonResponse(200, result);
    }
  } catch (error: any) {
    console.error('Handler error:', error);
    return jsonResponse(500, {
      success: false,
      error: error.message || 'Internal server error',
    });
  }
};
