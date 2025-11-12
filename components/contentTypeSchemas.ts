import { z } from "zod";

/**
 * Schema definitions for configurable content types
 * These schemas are sent to the Lambda server for structured content generation
 */

// Recipe content type
const recipeSchema = z.object({
  title: z.string().describe("Recipe title"),
  description: z.string().describe("Brief description of the dish"),
  prep_time: z.number().describe("Preparation time in minutes"),
  cook_time: z.number().describe("Cooking time in minutes"),
  servings: z.number().describe("Number of servings"),
  ingredients: z.array(
    z.object({
      item: z.string().describe("Ingredient name"),
      amount: z.string().describe("Amount (e.g., '2 cups', '1 tablespoon')"),
      notes: z.string().optional().describe("Optional notes about ingredient"),
    })
  ).describe("List of ingredients with amounts"),
  instructions: z.array(
    z.object({
      step_number: z.number().describe("Step number in sequence"),
      instruction: z.string().describe("Detailed instruction for this step"),
      duration: z.number().optional().describe("Estimated duration for this step in minutes"),
    })
  ).describe("Step-by-step cooking instructions"),
  tags: z.array(z.string()).describe("Recipe tags (e.g., 'vegetarian', 'quick', 'dessert')"),
  difficulty: z.enum(["easy", "medium", "hard"]).describe("Recipe difficulty level"),
  cuisine: z.string().optional().describe("Cuisine type (e.g., 'Italian', 'Chinese')"),
  notes: z.string().optional().describe("Additional notes or tips"),
});

// Task list content type
const taskListSchema = z.object({
  title: z.string().describe("Task list title"),
  description: z.string().optional().describe("Description of what this task list is for"),
  tasks: z.array(
    z.object({
      task_id: z.string().describe("Unique identifier for the task"),
      title: z.string().describe("Task title"),
      description: z.string().optional().describe("Detailed task description"),
      priority: z.enum(["low", "medium", "high", "urgent"]).describe("Task priority level"),
      estimated_duration: z.number().optional().describe("Estimated duration in minutes"),
      due_date: z.string().optional().describe("Due date in ISO format"),
      tags: z.array(z.string()).optional().describe("Task tags"),
      subtasks: z.array(
        z.object({
          subtask_id: z.string().describe("Unique identifier for subtask"),
          title: z.string().describe("Subtask title"),
        })
      ).optional().describe("List of subtasks"),
    })
  ).describe("List of tasks"),
  category: z.string().optional().describe("Task list category (e.g., 'Work', 'Personal')"),
});

// Event content type
const eventSchema = z.object({
  title: z.string().describe("Event title"),
  description: z.string().describe("Event description"),
  start_date: z.string().describe("Event start date/time in ISO format"),
  end_date: z.string().describe("Event end date/time in ISO format"),
  location: z.object({
    name: z.string().describe("Location name"),
    address: z.string().optional().describe("Street address"),
    coordinates: z.object({
      latitude: z.number(),
      longitude: z.number(),
    }).optional().describe("GPS coordinates"),
  }).optional().describe("Event location details"),
  participants: z.array(
    z.object({
      name: z.string().describe("Participant name"),
      email: z.string().optional().describe("Participant email"),
      role: z.string().optional().describe("Participant role (e.g., 'organizer', 'speaker')"),
    })
  ).optional().describe("Event participants"),
  agenda: z.array(
    z.object({
      time: z.string().describe("Time slot (e.g., '9:00 AM' or ISO format)"),
      item: z.string().describe("Agenda item title"),
      duration: z.number().optional().describe("Duration in minutes"),
      description: z.string().optional().describe("Agenda item description"),
    })
  ).optional().describe("Event agenda"),
  tags: z.array(z.string()).describe("Event tags (e.g., 'conference', 'meeting', 'social')"),
  category: z.string().optional().describe("Event category"),
  notes: z.string().optional().describe("Additional notes"),
  reminders: z.array(
    z.object({
      time_before: z.number().describe("Minutes before event to remind"),
      message: z.string().optional().describe("Reminder message"),
    })
  ).optional().describe("Event reminders"),
});

// Book summary content type
const bookSummarySchema = z.object({
  title: z.string().describe("Book title"),
  author: z.string().describe("Book author"),
  publication_year: z.number().optional().describe("Year of publication"),
  genre: z.string().optional().describe("Book genre"),
  synopsis: z.string().describe("Brief synopsis of the book"),
  key_themes: z.array(z.string()).describe("Major themes explored in the book"),
  main_characters: z.array(
    z.object({
      name: z.string().describe("Character name"),
      description: z.string().describe("Character description and role"),
    })
  ).optional().describe("Main characters"),
  chapters: z.array(
    z.object({
      chapter_number: z.number().describe("Chapter number"),
      title: z.string().optional().describe("Chapter title"),
      summary: z.string().describe("Chapter summary"),
      key_points: z.array(z.string()).optional().describe("Key points from this chapter"),
    })
  ).describe("Chapter-by-chapter summaries"),
  key_quotes: z.array(
    z.object({
      quote: z.string().describe("The quote text"),
      context: z.string().optional().describe("Context or explanation of the quote"),
      page: z.number().optional().describe("Page number where quote appears"),
    })
  ).optional().describe("Notable quotes from the book"),
  takeaways: z.array(z.string()).describe("Key takeaways or lessons"),
  rating: z.number().min(1).max(5).optional().describe("Rating out of 5"),
  review: z.string().optional().describe("Personal review or critique"),
  tags: z.array(z.string()).describe("Book tags"),
});

/**
 * Content type configuration with metadata for UI and generation
 */
export interface ContentTypeConfig {
  id: string;
  schema: z.ZodType<any>;
  display_name: string;
  icon: string;
  color: string;
  system_prompt: string;
  example_queries: string[];
}

/**
 * Registry of all available content type schemas
 * Used for intent detection and structured generation
 */
export const CONTENT_TYPE_SCHEMAS: Record<string, ContentTypeConfig> = {
  recipe: {
    id: "recipe",
    schema: recipeSchema,
    display_name: "Recipe",
    icon: "🍳",
    color: "#F59E0B", // amber
    system_prompt: `You are a helpful cooking assistant that generates detailed recipes.
Create complete, practical recipes with clear instructions and accurate measurements.
Include helpful notes and tips where appropriate.`,
    example_queries: [
      "chocolate chip cookies recipe",
      "quick weeknight pasta dinner",
      "vegan breakfast ideas",
    ],
  },
  task_list: {
    id: "task_list",
    schema: taskListSchema,
    display_name: "Task List",
    icon: "✅",
    color: "#10B981", // green
    system_prompt: `You are a productivity assistant that helps organize tasks and projects.
Create clear, actionable task lists with appropriate priorities and time estimates.
Break down complex tasks into manageable subtasks when needed.`,
    example_queries: [
      "plan a website redesign project",
      "organize a birthday party",
      "study plan for exam",
    ],
  },
  event: {
    id: "event",
    schema: eventSchema,
    display_name: "Event",
    icon: "📅",
    color: "#3B82F6", // blue
    system_prompt: `You are an event planning assistant that creates detailed event specifications.
Generate complete event details with schedules, locations, and logistics.
Include practical information that helps with event execution.`,
    example_queries: [
      "team building workshop agenda",
      "conference schedule",
      "wedding reception timeline",
    ],
  },
  book_summary: {
    id: "book_summary",
    schema: bookSummarySchema,
    display_name: "Book Summary",
    icon: "📚",
    color: "#8B5CF6", // purple
    system_prompt: `You are a literary analyst that creates comprehensive book summaries.
Provide insightful chapter-by-chapter breakdowns with key themes and takeaways.
Include memorable quotes and character analysis where relevant.`,
    example_queries: [
      "summarize 1984 by George Orwell",
      "breakdown of Atomic Habits",
      "key points from Sapiens",
    ],
  },
};

/**
 * Helper function to get all content type IDs
 */
export function getContentTypeIds(): string[] {
  return Object.keys(CONTENT_TYPE_SCHEMAS);
}

/**
 * Helper function to get content type config by ID
 */
export function getContentTypeConfig(id: string): ContentTypeConfig | undefined {
  return CONTENT_TYPE_SCHEMAS[id];
}

/**
 * Type exports for TypeScript consumers
 */
export type RecipeData = z.infer<typeof recipeSchema>;
export type TaskListData = z.infer<typeof taskListSchema>;
export type EventData = z.infer<typeof eventSchema>;
export type BookSummaryData = z.infer<typeof bookSummarySchema>;
