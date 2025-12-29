/**
 * Wiki Server Editor - Read/write BlockNote content via Y.js
 * Uses direct Y.XmlFragment manipulation for reading and writing
 *
 * Note: We cannot use @blocknote/server-util due to ESM/ProseMirror
 * dependency issues when running in Node.js via tsx.
 */

import * as Y from "yjs";

/**
 * Convert Y.XmlElement to BlockNote block format
 */
function xmlElementToBlock(element: Y.XmlElement): unknown | null {
  try {
    const type = element.nodeName;
    const attrs = element.getAttributes();

    // Build content array from child elements
    const content: unknown[] = [];
    const children: unknown[] = [];

    element.forEach((child) => {
      if (child instanceof Y.XmlText) {
        const text = child.toString();
        if (text) {
          content.push({ type: "text", text, styles: {} });
        }
      } else if (child instanceof Y.XmlElement) {
        // Check if this is a nested block (blockGroup/blockContainer) or inline content
        const childName = child.nodeName;
        if (childName === "blockGroup" || childName === "blockContainer") {
          // This is a nested block - add to children
          const childBlock = xmlElementToBlock(child);
          if (childBlock) {
            children.push(childBlock);
          }
        } else {
          // This is inline content or a content block
          const childBlock = xmlElementToBlock(child);
          if (childBlock) {
            content.push(childBlock);
          }
        }
      }
    });

    return {
      id: attrs.id || crypto.randomUUID(),
      type: type || "paragraph",
      props: attrs,
      content: content.length > 0 ? content : undefined,
      children: children.length > 0 ? children : [],
    };
  } catch {
    return null;
  }
}

/**
 * Get BlockNote blocks from Y.XmlFragment
 */
function getBlocksFromFragment(fragment: Y.XmlFragment): unknown[] {
  const blocks: unknown[] = [];

  fragment.forEach((item) => {
    if (item instanceof Y.XmlElement) {
      const block = xmlElementToBlock(item);
      if (block) {
        blocks.push(block);
      }
    }
  });

  return blocks;
}

/**
 * Get page content as BlockNote blocks from Y.XmlFragment
 */
export async function getPageBlocks(
  doc: Y.Doc,
  pageId: string
): Promise<unknown[]> {
  const fragment = doc.getXmlFragment(`wiki-page-${pageId}`);
  return getBlocksFromFragment(fragment);
}

/**
 * Convert a BlockNote block to Y.XmlElement
 */
function blockToXmlElement(block: any): Y.XmlElement {
  const type = block.type || "paragraph";

  // Create blockContainer wrapping the actual block
  const blockContainer = new Y.XmlElement("blockContainer");
  blockContainer.setAttribute("id", block.id || crypto.randomUUID());

  // Create the content block (paragraph, heading, etc.)
  const contentBlock = new Y.XmlElement(type);

  // Set props as attributes
  if (block.props) {
    for (const [key, value] of Object.entries(block.props)) {
      if (value !== undefined && value !== null) {
        contentBlock.setAttribute(key, String(value));
      }
    }
  }

  // Add text content
  if (block.content && Array.isArray(block.content)) {
    for (const item of block.content) {
      if (item.type === "text" && item.text) {
        const textNode = new Y.XmlText();
        textNode.insert(0, item.text);
        contentBlock.push([textNode]);
      }
    }
  }

  // Add content block to container
  blockContainer.push([contentBlock]);

  // Handle nested children (for lists, etc.)
  if (block.children && block.children.length > 0) {
    const blockGroup = new Y.XmlElement("blockGroup");
    for (const child of block.children) {
      blockGroup.push([blockToXmlElement(child)]);
    }
    blockContainer.push([blockGroup]);
  }

  return blockContainer;
}

/**
 * Set page content from BlockNote blocks to Y.XmlFragment
 */
export async function setPageBlocks(
  doc: Y.Doc,
  pageId: string,
  blocks: unknown[]
): Promise<void> {
  const fragment = doc.getXmlFragment(`wiki-page-${pageId}`);

  doc.transact(() => {
    // Clear existing content
    fragment.delete(0, fragment.length);

    // Create root blockGroup
    const blockGroup = new Y.XmlElement("blockGroup");

    // Convert and add each block
    for (const block of blocks) {
      blockGroup.push([blockToXmlElement(block)]);
    }

    fragment.push([blockGroup]);
  });
}

/**
 * Convert embedded HTML-like link tags to markdown format
 * e.g., <link href="/foo">Bar</link> → [Bar](/foo)
 */
function convertHtmlLinksToMarkdown(text: string): string {
  // Match <link ... href="..." ...>text</link> pattern
  return text.replace(
    /<link[^>]*\shref="([^"]*)"[^>]*>([^<]*)<\/link>/g,
    (_, href, linkText) => `[${linkText}](${href})`
  );
}

/**
 * Extract text content from a block's content array
 */
function extractTextFromContent(content: unknown[]): string {
  let text = "";
  for (const item of content as any[]) {
    if (item.type === "text") {
      // Convert embedded HTML links to markdown
      text += convertHtmlLinksToMarkdown(item.text || "");
    } else if (item.type === "link") {
      // Handle links - extract text from link content and format as markdown link
      const linkText = extractTextFromContent(item.content || []);
      const href = item.href || "";
      if (href) {
        text += `[${linkText}](${href})`;
      } else {
        text += linkText;
      }
    } else if (item.type === "wikiLink") {
      // Handle wiki links - use display_text or page_path
      const displayText = item.props?.display_text || item.props?.page_path || "";
      text += `[[${displayText}]]`;
    }
  }
  return text;
}

/**
 * Convert a single content block to markdown
 */
function contentBlockToMarkdown(block: any, indent: string = ""): string {
  const type = block.type || "paragraph";
  const content = block.content || [];
  const text = extractTextFromContent(content);

  let line = "";

  switch (type) {
    case "heading":
      const level = block.props?.level || 1;
      line = "#".repeat(level) + " " + text;
      break;
    case "bulletListItem":
      line = "- " + text;
      break;
    case "numberedListItem":
      line = "1. " + text;
      break;
    case "checkListItem":
      const checked = block.props?.checked ? "x" : " ";
      line = `- [${checked}] ` + text;
      break;
    case "codeBlock":
      const lang = block.props?.language || "";
      line = "```" + lang + "\n" + text + "\n```";
      break;
    case "image":
      const url = block.props?.url || "";
      const alt = block.props?.caption || "image";
      line = `![${alt}](${url})`;
      break;
    case "table":
      // Basic table handling - just note it exists
      line = "[table]";
      break;
    case "paragraph":
    default:
      line = text;
      break;
  }

  return indent + line;
}

/**
 * Convert blocks to simple markdown (basic implementation)
 * Handles BlockNote's nested blockGroup/blockContainer structure
 *
 * Structure is: blockGroup.children → blockContainer.content → actual blocks
 */
function blocksToSimpleMarkdown(blocks: unknown[], indent: string = ""): string {
  const lines: string[] = [];

  for (const block of blocks) {
    const b = block as any;
    const type = b.type || "paragraph";

    // blockGroup - recurse into children (which are blockContainers)
    if (type === "blockGroup") {
      if (b.children && b.children.length > 0) {
        const childMd = blocksToSimpleMarkdown(b.children, indent);
        if (childMd.trim()) {
          lines.push(childMd);
        }
      }
      continue;
    }

    // blockContainer - recurse into content (which are the actual blocks)
    if (type === "blockContainer") {
      // Process content array (actual blocks like heading, paragraph, etc.)
      if (b.content && b.content.length > 0) {
        const contentMd = blocksToSimpleMarkdown(b.content, indent);
        if (contentMd.trim()) {
          lines.push(contentMd);
        }
      }
      // Also process children if any (nested block groups)
      if (b.children && b.children.length > 0) {
        const childMd = blocksToSimpleMarkdown(b.children, indent + "  ");
        if (childMd.trim()) {
          lines.push(childMd);
        }
      }
      continue;
    }

    // Actual content block - convert to markdown
    const line = contentBlockToMarkdown(b, indent);
    if (line.trim()) {
      lines.push(line);
    }

    // Handle nested children (indented blocks within a content block)
    if (b.children && b.children.length > 0) {
      const childMd = blocksToSimpleMarkdown(b.children, indent + "  ");
      if (childMd.trim()) {
        lines.push(childMd);
      }
    }
  }

  return lines.join("\n\n");
}

/**
 * Get page content as markdown string
 */
export async function getPageMarkdown(
  doc: Y.Doc,
  pageId: string
): Promise<string> {
  const blocks = await getPageBlocks(doc, pageId);
  return blocksToSimpleMarkdown(blocks);
}

/**
 * Parse markdown into BlockNote block format
 * Supports: headings, paragraphs, bullet lists, numbered lists, code blocks
 */
function parseMarkdown(markdown: string): any[] {
  const lines = markdown.split("\n");
  const blocks: any[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Skip empty lines
    if (line.trim() === "") {
      i++;
      continue;
    }

    // Code block (```)
    if (line.startsWith("```")) {
      const lang = line.slice(3).trim();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith("```")) {
        codeLines.push(lines[i]);
        i++;
      }
      i++; // Skip closing ```
      blocks.push({
        id: crypto.randomUUID(),
        type: "codeBlock",
        props: { language: lang || "text" },
        content: [{ type: "text", text: codeLines.join("\n") }],
        children: [],
      });
      continue;
    }

    // Heading (# ## ###)
    const headingMatch = line.match(/^(#{1,3})\s+(.+)$/);
    if (headingMatch) {
      blocks.push({
        id: crypto.randomUUID(),
        type: "heading",
        props: { level: headingMatch[1].length },
        content: [{ type: "text", text: headingMatch[2] }],
        children: [],
      });
      i++;
      continue;
    }

    // Bullet list (- or *)
    if (line.match(/^\s*[-*]\s+/)) {
      const text = line.replace(/^\s*[-*]\s+/, "");
      blocks.push({
        id: crypto.randomUUID(),
        type: "bulletListItem",
        props: {},
        content: [{ type: "text", text }],
        children: [],
      });
      i++;
      continue;
    }

    // Numbered list (1. 2. etc)
    if (line.match(/^\s*\d+\.\s+/)) {
      const text = line.replace(/^\s*\d+\.\s+/, "");
      blocks.push({
        id: crypto.randomUUID(),
        type: "numberedListItem",
        props: {},
        content: [{ type: "text", text }],
        children: [],
      });
      i++;
      continue;
    }

    // Default: paragraph
    blocks.push({
      id: crypto.randomUUID(),
      type: "paragraph",
      props: {},
      content: [{ type: "text", text: line }],
      children: [],
    });
    i++;
  }

  return blocks;
}

/**
 * Set page content from markdown string
 */
export async function setPageFromMarkdown(
  doc: Y.Doc,
  pageId: string,
  markdown: string
): Promise<void> {
  const blocks = parseMarkdown(markdown);
  await setPageBlocks(doc, pageId, blocks);
}

/**
 * Get page content as HTML string (basic implementation)
 */
export async function getPageHtml(
  doc: Y.Doc,
  pageId: string
): Promise<string> {
  const blocks = await getPageBlocks(doc, pageId);

  function blockToHtml(block: any): string {
    const type = block.type || "paragraph";
    const content = block.content || [];

    let text = "";
    for (const item of content) {
      if (item.type === "text") {
        text += item.text || "";
      }
    }

    switch (type) {
      case "heading":
        const level = block.props?.level || 1;
        return `<h${level}>${text}</h${level}>`;
      case "bulletListItem":
        return `<li>${text}</li>`;
      case "numberedListItem":
        return `<li>${text}</li>`;
      case "paragraph":
      default:
        return `<p>${text}</p>`;
    }
  }

  return blocks.map(blockToHtml).join("\n");
}
