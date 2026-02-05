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
  Palette,
  Banknote,
  Compass,
  Bot,
  StickyNote,
  type LucideIcon,
} from "lucide-react";
import type { z } from "zod";

export type RenderMode = "list" | "chat" | "calendar" | "reader" | "uploads" | "money" | "maps" | "paint" | "do" | "dj" | "signal" | "wiki" | "bookclub" | "time" | "code" | "photos" | "ineedart" | "transfer" | "rabbit-hole" | "agents" | "notes";

/**
 * Defines a public route pattern for an app that bypasses authentication
 */
export interface PublicRoutePattern {
  /** Route prefix to match (e.g., "/art/", "/dj/") */
  prefix: string;
  /** If true, prefix alone is NOT public, only paths beyond it */
  requiresSegment?: boolean;
  /** Query param conditions - if set, one must match for route to be public */
  queryParams?: { name: string; values: string[] }[];
}

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
  hidden?: boolean;
  /** Routes that bypass authentication */
  publicRoutes?: PublicRoutePattern[];
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
    hidden: true,
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
    hidden: true,
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
    hidden: true,
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
    hidden: true,
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
    publicRoutes: [
      {
        prefix: "/dj/",
        requiresSegment: true,
        queryParams: [{ name: "mode", values: ["watch", "contribute"] }],
      },
    ],
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
    hidden: true,
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
    publicRoutes: [
      { prefix: "/wiki/pub/" },
    ],
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
    hidden: true,
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
  {
    id: "ineedart",
    name: "art",
    description:
      "Request art from artists with prompts and inspiration images",
    icon: Palette,
    color: "text-pink-400",
    bgColor: "bg-pink-400/10",
    placeholder: "Describe the art you need...",
    renderMode: "ineedart",
    publicRoutes: [
      { prefix: "/art/", requiresSegment: true },
    ],
  },
  {
    id: "transfer",
    name: "pay",
    description:
      "Send and receive money with Stripe Connect",
    icon: Banknote,
    color: "text-green-400",
    bgColor: "bg-green-400/10",
    placeholder: "Send money...",
    renderMode: "transfer",
  },
  {
    id: "rabbit-hole",
    name: "explore",
    description:
      "Explore topics in depth with AI-guided research",
    icon: Compass,
    color: "text-purple-400",
    bgColor: "bg-purple-400/10",
    placeholder: "Enter a topic to explore...",
    renderMode: "rabbit-hole",
    publicRoutes: [
      { prefix: "/rabbit-hole/pub/" },
    ],
  },
  {
    id: "agents",
    name: "agents",
    description:
      "Build and deploy AI agents with tools, workflows, and memory",
    icon: Bot,
    color: "text-cyan-400",
    bgColor: "bg-cyan-400/10",
    placeholder: "Create an AI agent...",
    renderMode: "agents",
  },
  {
    id: "notes",
    name: "notes",
    description:
      "Collaborative note-taking with real-time sync powered by Electric SQL and Yjs",
    icon: StickyNote,
    color: "text-yellow-400",
    bgColor: "bg-yellow-400/10",
    placeholder: "Create a new note...",
    renderMode: "notes",
  },
];

export function getAppById(id: string): AppConfig | undefined {
  return apps.find((app) => app.id === id);
}

export function getAllApps(): AppConfig[] {
  return apps.filter((app) => !app.hidden);
}
