import { Metadata } from "next";
import { notFound } from "next/navigation";
import { PublicContentView } from "@/components/list/PublicContentView";
import { createServerSupabaseClient } from "@/lib/supabase-server";

interface Props {
  params: Promise<{
    contentId: string;
  }>;
}

// Fetch public content server-side
async function getPublicContent(contentId: string) {
  const supabase = createServerSupabaseClient();

  const { data, error } = await supabase
    .from("public_content")
    .select(
      `
      id,
      created_at,
      updated_at,
      type,
      data,
      metadata,
      parent_content_id,
      shared_at,
      shared_by
    `
    )
    .eq("id", contentId)
    .single();

  if (error) {
    if (error.code === "PGRST116") {
      return null;
    }
    console.error("Error fetching public content:", error);
    return null;
  }

  return data;
}

// Generate SEO metadata
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { contentId } = await params;
  const content = await getPublicContent(contentId);

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://www.justshare.io";
  const pageUrl = `${baseUrl}/public/content/${contentId}`;

  // Default metadata
  const defaults: Metadata = {
    title: "Shared Content - justshare",
    description: "View shared content on justshare",
    openGraph: {
      title: "Shared Content",
      description: "View shared content on justshare",
      url: pageUrl,
      siteName: "justshare",
      type: "article",
    },
    twitter: {
      card: "summary",
      title: "Shared Content",
      description: "View shared content on justshare",
    },
  };

  if (!content) {
    return defaults;
  }

  // Extract metadata based on content type
  let title: string;
  let description: string;
  let image: string | undefined;

  if (content.type === "seo" && content.metadata) {
    // SEO content has rich metadata
    title = content.metadata.title || content.data || "Shared Link";
    description =
      content.metadata.description ||
      `Shared from ${content.metadata.domain || "justshare"}`;
    image = content.metadata.image;
  } else if (content.type === "video_section" && content.metadata) {
    // Video section with YouTube metadata
    title = content.data || "Video Clip";
    description = `Watch this video clip on justshare`;
    // YouTube thumbnail from video URL
    if (content.metadata.youtube_url) {
      const videoId = extractYouTubeId(content.metadata.youtube_url);
      if (videoId) {
        image = `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
      }
    }
  } else {
    // Plain text content
    const textPreview = content.data?.slice(0, 100) || "";
    title = textPreview.length > 60 ? `${textPreview.slice(0, 60)}...` : textPreview || "Shared Content";
    description =
      content.data?.length > 100
        ? `${content.data.slice(0, 160)}...`
        : content.data || "View shared content on justshare";
  }

  // Clean up title for display
  const displayTitle = `${title} - justshare`;

  return {
    title: displayTitle,
    description,
    openGraph: {
      title,
      description,
      url: pageUrl,
      siteName: "justshare",
      type: "article",
      ...(image && {
        images: [
          {
            url: image,
            width: 1200,
            height: 630,
            alt: title,
          },
        ],
      }),
    },
    twitter: {
      card: image ? "summary_large_image" : "summary",
      title,
      description,
      ...(image && { images: [image] }),
    },
    alternates: {
      canonical: pageUrl,
    },
  };
}

// Extract YouTube video ID from URL
function extractYouTubeId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
    /youtube\.com\/v\/([^&\n?#]+)/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) {
      return match[1];
    }
  }

  return null;
}

export default async function PublicContentPage({ params }: Props) {
  const { contentId } = await params;
  const content = await getPublicContent(contentId);

  if (!content) {
    notFound();
  }

  return <PublicContentView initialContent={content} contentId={contentId} />;
}
