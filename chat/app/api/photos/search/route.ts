import { createClient } from "pexels";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("query");
  const page = parseInt(searchParams.get("page") || "1");
  const perPage = parseInt(searchParams.get("per_page") || "30");

  if (!query) {
    return Response.json({ error: "Query required" }, { status: 400 });
  }

  const apiKey = process.env.PEXELS_API_KEY;
  if (!apiKey) {
    return Response.json({ error: "Pexels API key not configured" }, { status: 500 });
  }

  try {
    const client = createClient(apiKey);
    const result = await client.photos.search({ query, per_page: perPage, page });

    return Response.json(result);
  } catch (error) {
    console.error("Pexels API error:", error);
    return Response.json({ error: "Failed to search photos" }, { status: 500 });
  }
}
