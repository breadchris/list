import {
  MessageSquare,
  Calendar,
  FileText,
  BookOpen,
  Upload,
  type LucideIcon,
} from "lucide-react";
import { calendarSchemaObject } from "./schema";
import type { z } from "zod";

export type RenderMode = "list" | "chat" | "calendar" | "editor" | "reader" | "uploads";

export interface AppConfig {
  id: string;
  name: string;
  description: string;
  icon: LucideIcon;
  color: string;
  bgColor: string;
  schema?: z.ZodSchema<any>;
  apiEndpoint?: string;
  placeholder: string;
  loadingText?: string;
  renderMode: RenderMode;
}

export const apps: AppConfig[] = [
  {
    id: "chat",
    name: "chat",
    description:
      "Real-time collaborative chat with threaded conversations powered by Yjs",
    icon: MessageSquare,
    color: "text-cyan-400",
    bgColor: "bg-cyan-400/10",
    placeholder: "Type a message...",
    renderMode: "chat",
  },
  {
    id: "calendar",
    name: "Calendar",
    description:
      "Generate calendar events from your plans and ideas",
    icon: Calendar,
    color: "text-blue-400",
    bgColor: "bg-blue-400/10",
    schema: calendarSchemaObject,
    apiEndpoint: "/api/object",
    placeholder: "Describe your plans... (e.g., 'Plan a week of workouts', 'Schedule a 3-day conference')",
    loadingText: "Generating calendar events...",
    renderMode: "calendar",
  },
  {
    id: "editor",
    name: "Markdown Editor",
    description:
      "Collaborative note-taking with markdown support and real-time sync",
    icon: FileText,
    color: "text-green-400",
    bgColor: "bg-green-400/10",
    placeholder: "Start typing...",
    renderMode: "editor",
  },
  {
    id: "reader",
    name: "EPUB Reader",
    description:
      "Read and annotate EPUB files with collaborative highlights and real-time sync",
    icon: BookOpen,
    color: "text-amber-400",
    bgColor: "bg-amber-400/10",
    placeholder: "Upload an EPUB file to start reading...",
    renderMode: "reader",
  },
  {
    id: "uploads",
    name: "File Uploads",
    description:
      "Upload and manage your files. Supports documents, images, audio, video, and more",
    icon: Upload,
    color: "text-pink-400",
    bgColor: "bg-pink-400/10",
    placeholder: "Drop files here or click to upload...",
    renderMode: "uploads",
  },
];

export function getAppById(id: string): AppConfig | undefined {
  return apps.find((app) => app.id === id);
}

export function getAllApps(): AppConfig[] {
  return apps;
}
