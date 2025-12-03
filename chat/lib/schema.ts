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

export const listItemSchema = z.object({
  content: z.string().describe("The list item text"),
});

export const listItemsSchema = z.array(listItemSchema);

export const listItemsSchemaObject = z.object({ items: listItemsSchema });

export type ListItem = z.infer<typeof listItemSchema>;
export type ListItems = z.infer<typeof listItemsSchema>;

export const codeVariantSchema = z.object({
  name: z.string().describe("A short descriptive name for this variant"),
  code: z.string().describe("The complete TSX component code"),
});

export const codeVariantsSchema = z.array(codeVariantSchema);

export const codeVariantsSchemaObject = z.object({
  reasoning: z.string().describe("Your thought process analyzing the user's request and planning the component designs"),
  variants: codeVariantsSchema,
});

export type CodeVariant = z.infer<typeof codeVariantSchema>;
export type CodeVariants = z.infer<typeof codeVariantsSchema>;

export const calendarEventSchema = z.object({
  title: z.string().describe("The title/name of the event"),
  date: z.string().describe("The date of the event in YYYY-MM-DD format"),
  start_time: z.string().optional().describe("Start time in HH:MM format (24-hour)"),
  end_time: z.string().optional().describe("End time in HH:MM format (24-hour)"),
  description: z.string().optional().describe("A brief description of the event"),
  location: z.string().optional().describe("The location or venue of the event"),
});

export const calendarEventsSchema = z.array(calendarEventSchema);

export const calendarSchemaObject = z.object({
  events: calendarEventsSchema,
});

export type CalendarEvent = z.infer<typeof calendarEventSchema>;
export type CalendarEvents = z.infer<typeof calendarEventsSchema>;

export const botBuilderSchema = z.object({
  step: z.enum(["collect_name", "collect_description", "collect_personality", "confirm", "complete"]).describe("Current step in bot creation process"),
  bot_mention: z.string().optional().describe("The bot's mention name (without @)"),
  bot_description: z.string().optional().describe("Brief description of what the bot does"),
  personality_lines: z.array(z.string()).optional().describe("List of personality traits/instructions"),
  message: z.string().min(1).describe("Message to show the user (must not be empty)"),
  show_create_button: z.boolean().optional().describe("Whether to show the create bot button"),
});

export const botBuilderSchemaObject = z.object({
  response: botBuilderSchema,
});

export type BotBuilderResponse = z.infer<typeof botBuilderSchema>;

export const chatResponseSchema = z.object({
  message: z.string().describe("The bot's response message"),
});

export const chatResponseSchemaObject = z.object({
  response: chatResponseSchema,
});

export type ChatResponse = z.infer<typeof chatResponseSchema>;
