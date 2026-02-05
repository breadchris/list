import { z } from "zod";

// Individual pixel operation
export const pixelOperationSchema = z.object({
  x: z.number().int().min(0).describe("X coordinate (0-indexed from left)"),
  y: z.number().int().min(0).describe("Y coordinate (0-indexed from top)"),
  color: z
    .string()
    .describe("RGBA color string like 'rgba(255, 0, 0, 1)' or empty string to erase"),
});

// Complete AI draw response - uses array for streamable pixels
export const aiDrawResponseSchema = z.object({
  thinking: z
    .string()
    .optional()
    .describe("Brief reasoning about the drawing approach"),
  pixels: z
    .array(pixelOperationSchema)
    .describe("Array of pixel operations to draw"),
});

export type PixelOperation = z.infer<typeof pixelOperationSchema>;
export type AIDrawResponse = z.infer<typeof aiDrawResponseSchema>;
