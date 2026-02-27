export type Persona = {
  id: string;
  name: string;
  role: string;
  description: string;
  initialPrompt: string;
  systemPrompt: string;
  color: string;
  avatarPath?: string; // Path in storage
  avatarUrl?: string; // Signed URL for display
};

export type StructuredQuestion = {
  id: string;
  question?: string; // Legacy/Single
  options?: {      // Legacy/Single
    id: string;
    label: string;
    description?: string;
  }[];
  title?: string; // New: Group title
  questions?: {   // New: Multiple questions
      id: string;
      text: string;
      options: {
        id: string;
        label: string;
        description?: string;
      }[];
      allowCustomInput?: boolean;
  }[];
  allowCustomInput?: boolean;
};

export type ChatSession = {
  id: string;
  title: string;
  createdAt: Date;
  updatedAt: Date;
  preview?: string; // Short preview of the last message
  constraints?: Record<string, string>;
};

export type Message = {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  timestamp: Date;
  personaId?: string; // If from AI
  structuredQuestion?: StructuredQuestion;
  sessionId?: string;
  wikiAction?: {
      path: string;
      content: string;
      status: 'pending' | 'approved' | 'rejected' | 'completed';
  };
  recipe?: Recipe;
};

export type Recipe = {
  title: string;
  description: string;
  prepTime: string;
  cookTime: string;
  servings: number;
  ingredients: { item: string; quantity: string; unit?: string }[];
  instructions: { step: number; text: string }[];
  difficulty: 'easy' | 'medium' | 'hard';
  calories?: number;
};

export type TimelineEntry = {
  id: string;
  content: string; // Text summary or fallback
  timestamp: Date;
  tags?: string[];
  personaId?: string;
  sessionId?: string;
  type?: 'text' | 'recipe' | 'question' | 'wiki'; // New field
  metadata?: any; // New field for storing structured data (Recipe, StructuredQuestion, etc.)
};

export interface PaneContent {
  text?: string;
  files?: any[];
  [key: string]: any;
}

export interface IPane {
  acceptContent: (content: PaneContent) => void;
  updateContent?: (content: any) => void;
  moveContent?: (target: string, content: any) => void;
  toggleSettings?: () => void;
  startEditing?: (id: string) => void;
}
