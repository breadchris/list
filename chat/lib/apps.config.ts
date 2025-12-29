import {
  MessageSquare,
  MessageCircle,
  BookOpen,
  Upload,
  List,
  Wallet,
  Paintbrush,
  Stamp,
  ListVideo,
  BookText,
  UsersRound,
  Calendar,
  Code2,
  Camera,
  type LucideIcon,
} from "lucide-react";
import type { z } from "zod";

export type RenderMode = "list" | "chat" | "calendar" | "reader" | "uploads" | "money" | "maps" | "paint" | "do" | "dj" | "signal" | "wiki" | "bookclub" | "time" | "code" | "photos";

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
    id: "list",
    name: "List",
    description:
      "Hierarchical content management with real-time collaboration",
    icon: List,
    color: "text-purple-400",
    bgColor: "bg-purple-400/10",
    placeholder: "Add content...",
    renderMode: "list",
  },
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
    id: "reader",
    name: "read",
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
    name: "upload",
    description:
      "Upload and manage your files. Supports documents, images, audio, video, and more",
    icon: Upload,
    color: "text-pink-400",
    bgColor: "bg-pink-400/10",
    placeholder: "Drop files here or click to upload...",
    renderMode: "uploads",
  },
  {
    id: "money",
    name: "save",
    description:
      "Connect bank accounts and track transactions with Teller",
    icon: Wallet,
    color: "text-emerald-400",
    bgColor: "bg-emerald-400/10",
    placeholder: "View your connected accounts...",
    renderMode: "money",
  },
  {
    id: "paint",
    name: "paint",
    description:
      "Create pixel art with real-time collaboration and animation support",
    icon: Paintbrush,
    color: "text-rose-400",
    bgColor: "bg-rose-400/10",
    placeholder: "Start drawing...",
    renderMode: "paint",
  },
  {
    id: "do",
    name: "do",
    description:
      "Track daily habits with stamps on a passport page",
    icon: Stamp,
    color: "text-lime-400",
    bgColor: "bg-lime-400/10",
    placeholder: "Track your habits...",
    renderMode: "do",
  },
  {
    id: "dj",
    name: "dj",
    description:
      "Collaborative video queue for watching YouTube together",
    icon: ListVideo,
    color: "text-violet-400",
    bgColor: "bg-violet-400/10",
    placeholder: "Press Cmd+K to add a video...",
    renderMode: "dj",
  },
  {
    id: "signal",
    name: "signal",
    description:
      "Signal-style messaging with conversations and message bubbles",
    icon: MessageCircle,
    color: "text-blue-400",
    bgColor: "bg-blue-400/10",
    placeholder: "Type a message...",
    renderMode: "signal",
  },
  {
    id: "wiki",
    name: "wiki",
    description:
      "Collaborative wiki builder with multi-panel navigation and real-time editing",
    icon: BookText,
    color: "text-teal-400",
    bgColor: "bg-teal-400/10",
    placeholder: "Create and link wiki pages...",
    renderMode: "wiki",
  },
  {
    id: "bookclub",
    name: "club",
    description:
      "Collaborative book clubs with shared reading progress and highlights",
    icon: UsersRound,
    color: "text-orange-400",
    bgColor: "bg-orange-400/10",
    placeholder: "Create or join a book club...",
    renderMode: "bookclub",
  },
  {
    id: "time",
    name: "time",
    description:
      "Collaborative calendar with real-time event sync",
    icon: Calendar,
    color: "text-sky-400",
    bgColor: "bg-sky-400/10",
    placeholder: "Click to add an event...",
    renderMode: "time",
  },
  {
    id: "code",
    name: "code",
    description:
      "Generate and preview TSX components with Claude Code",
    icon: Code2,
    color: "text-indigo-400",
    bgColor: "bg-indigo-400/10",
    placeholder: "Describe your component...",
    renderMode: "code",
  },
  {
    id: "photos",
    name: "photos",
    description:
      "Search Pexels for images, edit, and save to your library",
    icon: Camera,
    color: "text-fuchsia-400",
    bgColor: "bg-fuchsia-400/10",
    placeholder: "Search for photos...",
    renderMode: "photos",
  },
];

export function getAppById(id: string): AppConfig | undefined {
  return apps.find((app) => app.id === id);
}

export function getAllApps(): AppConfig[] {
  return apps;
}
