// Content type constant for Supabase
export const RABBIT_HOLE_CONTENT_TYPE = "rabbit-hole" as const;

// A single page in the rabbit hole exploration
export interface RabbitHolePage {
  id: string;
  query: string;                   // Topic/question asked
  content: string;                 // Markdown response
  parent_page_id?: string;         // ID of parent page (undefined for root)
  link_text?: string;              // Link text that was clicked to get here
  context?: string;                // Context snippet from parent page
  status: "streaming" | "complete" | "error";
  created_at: string;
}

// Metadata stored in the content record
export interface RabbitHoleMetadata {
  title: string;
  created_by_username?: string;
  pages: Record<string, RabbitHolePage>;
  root_page_id: string | null;
}

// The full room record from Supabase
export interface RabbitHoleRoom {
  id: string;
  type: typeof RABBIT_HOLE_CONTENT_TYPE;
  data: string;                    // Room title
  group_id: string;
  user_id: string;
  metadata: RabbitHoleMetadata;
  created_at: string;
  updated_at?: string;
}

// A panel in the UI (references a page)
export interface RabbitHolePanel {
  id: string;
  page_id: string;
}

// Tree node for sidebar
export interface RabbitHoleTreeNode {
  page: RabbitHolePage;
  children: RabbitHoleTreeNode[];
}

// API request payload
export interface RabbitHoleStreamRequest {
  query: string;
  context?: string;
  link_text?: string;
}
