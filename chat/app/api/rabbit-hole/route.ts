import { openai } from "@ai-sdk/openai";
import { streamText } from "ai";

// Allow streaming responses up to 60 seconds
export const maxDuration = 60;

export async function POST(req: Request) {
  const { query, context, link_text } = await req.json();

  if (!query || typeof query !== "string") {
    return new Response(JSON.stringify({ error: "Query is required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const systemPrompt = `You are a research assistant helping users quickly traverse domains of knowledge. Your goal is to provide concise explanations densely packed with links to related concepts.

Guidelines:
1. Keep explanations SHORT and scannable (150-300 words max)
2. Use brief paragraphs and bullet points
3. Prioritize LINKS over prose - embed 8-15 internal links throughout
4. Every key concept, term, or related idea should be a clickable link
5. Focus on breadth of connections rather than depth of explanation

Link format rules:
- Use markdown links: [display text](target topic)
- Links are for related concepts, NOT external URLs
- Make every interesting term a link - be aggressive with linking
- Examples: [machine learning](machine learning), [neural networks](neural networks), [backpropagation](backpropagation)

Structure:
- One short intro paragraph with several links
- Bullet points listing key aspects (each with links)
- Brief connections to related domains (more links)

${context ? `\nContext from previous exploration:\n"${context}"\n\nBriefly connect to this context.` : ""}
${link_text ? `\nUser clicked "${link_text}" to reach this topic. Briefly acknowledge.` : ""}`;

  const result = streamText({
    model: openai("gpt-4.1-nano"),
    system: systemPrompt,
    messages: [
      {
        role: "user",
        content: query,
      },
    ],
    temperature: 0.7,
    maxTokens: 800,
  });

  return result.toTextStreamResponse();
}
