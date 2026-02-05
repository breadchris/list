import { openai } from "@ai-sdk/openai";
import { streamObject } from "ai";
import { aiDrawResponseSchema } from "@/components/paint/schemas/ai-draw-schema";

export interface PaintAIRequestBody {
  prompt: string;
  columns: number;
  rows: number;
  current_grid: string[];
}

export async function POST(req: Request) {
  const body: PaintAIRequestBody = await req.json();
  const { prompt, columns, rows, current_grid } = body;

  if (!prompt || typeof prompt !== "string") {
    return new Response("Invalid prompt", { status: 400 });
  }

  if (!columns || !rows || columns < 1 || rows < 1) {
    return new Response("Invalid grid dimensions", { status: 400 });
  }

  const systemPrompt = buildSystemPrompt(columns, rows, current_grid);

  const result = streamObject({
    schema: aiDrawResponseSchema,
    output: "object",
    model: openai("gpt-4.1-nano"),
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: prompt },
    ],
  });

  return result.toTextStreamResponse();
}

function buildSystemPrompt(
  columns: number,
  rows: number,
  currentGrid: string[]
): string {
  // Summarize existing canvas (non-empty pixels)
  const existingPixels: string[] = [];
  for (let i = 0; i < currentGrid.length; i++) {
    if (currentGrid[i] && currentGrid[i] !== "") {
      const x = i % columns;
      const y = Math.floor(i / columns);
      existingPixels.push(`(${x},${y}): ${currentGrid[i]}`);
    }
  }

  const existingContext =
    existingPixels.length > 0
      ? `\n\nExisting pixels on canvas:\n${existingPixels.slice(0, 100).join("\n")}${existingPixels.length > 100 ? `\n... and ${existingPixels.length - 100} more` : ""}`
      : "\n\nThe canvas is currently empty.";

  return `You are a pixel art generator. You create pixel art by specifying coordinates and colors.

CANVAS SPECIFICATIONS:
- Grid size: ${columns} columns x ${rows} rows
- Coordinate system: x=0 is leftmost column, y=0 is topmost row
- Valid x range: 0 to ${columns - 1}
- Valid y range: 0 to ${rows - 1}
- Index formula: index = y * ${columns} + x

COLOR FORMAT:
- Use RGBA strings: "rgba(R, G, B, A)" where R,G,B are 0-255 and A is 0-1
- Common colors:
  - Black: "rgba(0, 0, 0, 1)"
  - White: "rgba(255, 255, 255, 1)"
  - Red: "rgba(255, 0, 0, 1)"
  - Green: "rgba(0, 255, 0, 1)"
  - Blue: "rgba(0, 0, 255, 1)"
  - Yellow: "rgba(255, 255, 0, 1)"
  - Orange: "rgba(255, 165, 0, 1)"
  - Purple: "rgba(128, 0, 128, 1)"
  - Pink: "rgba(255, 192, 203, 1)"
  - Brown: "rgba(139, 69, 19, 1)"
  - Gray: "rgba(128, 128, 128, 1)"
  - Transparent/Erase: ""

${existingContext}

INSTRUCTIONS:
1. Analyze what the user wants to draw
2. Plan your pixel art considering the ${columns}x${rows} grid constraints
3. Generate pixel operations one at a time in a logical drawing order
4. Add to existing content - don't clear pixels unless specifically asked
5. Use appropriate colors and keep the art recognizable at low resolution
6. For complex shapes, outline first then fill

OUTPUT:
Return a JSON object with:
- "thinking": Brief description of your approach (optional)
- "pixels": Array of {x, y, color} operations in drawing order

Generate pixels in a visually pleasing order (e.g., outline first, then fill, or top-to-bottom).`;
}
