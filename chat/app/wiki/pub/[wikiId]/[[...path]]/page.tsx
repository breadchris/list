import { PublicWikiViewer } from "@/components/wiki/public-wiki-viewer";

interface Props {
  params: Promise<{
    wikiId: string;
    path?: string[];
  }>;
}

/**
 * Public wiki page
 *
 * Renders a readonly view of a wiki using live Y.js connection.
 * Any wiki is accessible via /wiki/pub/{wikiId} - no explicit publish step needed.
 */
export default async function PublicWikiPage({ params }: Props) {
  const { wikiId, path } = await params;
  const pagePath =
    path?.map((segment) => decodeURIComponent(segment)).join("/") || "index";

  return <PublicWikiViewer wikiId={wikiId} initialPath={pagePath} />;
}

/**
 * Generate metadata for SEO
 */
export async function generateMetadata({ params }: Props) {
  const { wikiId, path } = await params;
  const pagePath =
    path?.map((segment) => decodeURIComponent(segment)).join("/") || "index";

  // Basic metadata - page title comes from Y.js client-side
  return {
    title: `Wiki - ${pagePath === "index" ? "Home" : pathToTitle(pagePath)}`,
    description: "Published wiki",
  };
}

/**
 * Convert path to human-readable title
 */
function pathToTitle(path: string): string {
  const segments = path.split("/");
  const lastSegment = segments[segments.length - 1];
  return lastSegment
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}
