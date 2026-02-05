import Typesense from "typesense";

// Typesense client for search operations (uses search-only API key)
export const typesenseClient = new Typesense.Client({
  nodes: [
    {
      host: process.env.TYPESENSE_HOST || "",
      port: parseInt(process.env.TYPESENSE_PORT || "443"),
      protocol: process.env.TYPESENSE_PROTOCOL || "https",
    },
  ],
  apiKey: process.env.TYPESENSE_SEARCH_API_KEY || "",
  connectionTimeoutSeconds: 2,
});

// Typesense admin client for indexing operations (uses admin API key)
export const typesenseAdminClient = new Typesense.Client({
  nodes: [
    {
      host: process.env.TYPESENSE_HOST || "",
      port: parseInt(process.env.TYPESENSE_PORT || "443"),
      protocol: process.env.TYPESENSE_PROTOCOL || "https",
    },
  ],
  apiKey: process.env.TYPESENSE_ADMIN_API_KEY || "",
  connectionTimeoutSeconds: 10,
});

export const ARTICLES_COLLECTION_NAME = "omnivore_articles";

// Typesense schema for omnivore articles
export const articlesSchema = {
  name: ARTICLES_COLLECTION_NAME,
  fields: [
    { name: "id", type: "string" as const },
    { name: "content_id", type: "string" as const },
    { name: "url", type: "string" as const },
    { name: "domain", type: "string" as const, facet: true },
    { name: "title", type: "string" as const },
    { name: "content", type: "string" as const },
    { name: "created_at", type: "int64" as const },
  ],
  default_sorting_field: "created_at",
};

export interface ArticleDocument {
  id: string;
  content_id: string;
  url: string;
  domain: string;
  title: string;
  content: string;
  created_at: number;
}
