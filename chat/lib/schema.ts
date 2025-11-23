import { z } from "zod";

export const recipeSchema = z.object({
  name: z.string().describe("The name of the recipe"),
  description: z.string().describe("A brief description of the dish"),
  ingredients: z.array(z.string()).describe("List of ingredients with quantities"),
  steps: z.array(z.string()).describe("Step-by-step cooking instructions"),
});

export const recipeSchemaObject = z.object({ recipe: recipeSchema });

export type Recipe = z.infer<typeof recipeSchema>;

export const questionItemSchema = z.object({
  question: z.string().describe("A fun, engaging question"),
});

export const questionsSchema = z.array(questionItemSchema);

export const questionsSchemaObject = z.object({ questions: questionsSchema });

export type QuestionItem = z.infer<typeof questionItemSchema>;
export type Questions = z.infer<typeof questionsSchema>;
