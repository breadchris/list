/**
 * Test script to validate wikiLink export works correctly
 * Run with: npx tsx test-wikilink-export.ts
 */

const LAMBDA_ENDPOINT = "https://6jvwlnnks2.execute-api.us-east-1.amazonaws.com/content";

async function testWikiLinkExport() {
  console.log("Testing wikiLink export...\n");

  const payload = {
    action: "blocknote-export",
    payload: {
      blocks: [
        {
          id: "test-1",
          type: "paragraph",
          content: [
            { type: "text", text: "See " },
            {
              type: "wikiLink",
              props: {
                page_path: "test-page",
                display_text: "Test Link",
                exists: true,
              },
            },
            { type: "text", text: " for more info." },
          ],
          props: {},
          children: [],
        },
      ],
      format: "all",
    },
    sync: true,
  };

  try {
    const response = await fetch(LAMBDA_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const result = await response.json();

    console.log("Response status:", response.status);
    console.log("Success:", result.success);

    if (!result.success) {
      console.error("❌ FAILED:", result.error);
      process.exit(1);
    }

    const { html_full, html_lossy, markdown } = result.data;

    // Validate HTML contains wiki link
    const htmlHasLink = html_full.includes('href="/wiki/test-page"');
    const htmlHasClass = html_full.includes('class="wiki-link"');
    const htmlHasText = html_full.includes("Test Link");

    console.log("\n--- HTML Full ---");
    console.log(html_full);

    console.log("\n--- HTML Lossy ---");
    console.log(html_lossy);

    console.log("\n--- Markdown ---");
    console.log(markdown);

    console.log("\n--- Validation ---");
    console.log("HTML has /wiki/test-page link:", htmlHasLink ? "✅" : "❌");
    console.log("HTML has wiki-link class:", htmlHasClass ? "✅" : "❌");
    console.log("HTML has 'Test Link' text:", htmlHasText ? "✅" : "❌");

    // Validate Markdown
    const mdHasLink = markdown.includes("[Test Link](/wiki/test-page)");
    console.log("Markdown has [Test Link](/wiki/test-page):", mdHasLink ? "✅" : "❌");

    const allPassed = htmlHasLink && htmlHasClass && htmlHasText && mdHasLink;

    console.log("\n" + (allPassed ? "✅ ALL TESTS PASSED" : "❌ SOME TESTS FAILED"));
    process.exit(allPassed ? 0 : 1);
  } catch (error) {
    console.error("❌ Request failed:", error);
    process.exit(1);
  }
}

testWikiLinkExport();
