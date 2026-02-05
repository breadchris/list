import { openai } from "@ai-sdk/openai";
import { anthropic } from "@ai-sdk/anthropic";
import { convertToModelMessages, streamText } from "ai";
import {
  aiDocumentFormats,
  injectDocumentStateMessages,
  toolDefinitionsToToolSet,
} from "@blocknote/xl-ai/server";

// Allow streaming responses up to 30 seconds
export const maxDuration = 30;

export async function POST(req: Request) {
  const { messages, toolDefinitions } = await req.json();

  // Get page context from headers (used by wiki editor)
  const pageTitle = req.headers.get('X-Wiki-Page-Title');
  const pagePath = req.headers.get('X-Wiki-Page-Path');

  // Get requested model from headers (defaults to gpt-4.1-nano)
  const requestedModel = req.headers.get('X-AI-Model') || 'gpt-4.1-nano';

  // Build context-aware system prompt
  let systemPrompt = aiDocumentFormats.html.systemPrompt;
  if (pageTitle) {
    systemPrompt += `\n\nYou are editing a wiki page titled "${pageTitle}"${pagePath ? ` at path "${pagePath}"` : ''}. Use this context when generating content relevant to this page topic.`;
  }

  // Select provider based on model
  const model = requestedModel.startsWith('claude-')
    ? anthropic(requestedModel)
    : openai(requestedModel);

  const result = streamText({
    model,
    system: systemPrompt,
    messages: convertToModelMessages(injectDocumentStateMessages(messages)),
    tools: toolDefinitionsToToolSet(toolDefinitions),
    toolChoice: "required",
  });

  return result.toUIMessageStreamResponse();
}
