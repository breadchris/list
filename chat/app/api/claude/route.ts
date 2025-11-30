/**
 * API route for Claude Code bot
 * Invokes the AWS Lambda claude-code action and returns TSX components
 */

const LAMBDA_URL = "https://6jvwlnnks2.execute-api.us-east-1.amazonaws.com/content";

interface ClaudeCodePayload {
  prompt: string;
  user_id: string;
  group_id: string;
  parent_content_id: string | null;
}

interface TsxFile {
  path: string;
  content: string; // Base64 encoded
}

interface ClaudeCodeResult {
  success: boolean;
  session_id?: string;
  messages?: unknown[];
  tsx_files?: TsxFile[];
  s3_url?: string;
  file_count?: number;
  error?: string;
  stdout?: string;
  stderr?: string;
  exitCode?: number;
}

interface JobResponse {
  success: boolean;
  job_id?: string;
  job?: {
    job_id: string;
    status: "pending" | "processing" | "completed" | "failed";
    result?: ClaudeCodeResult;
    error?: string;
  };
  error?: string;
}

export interface ClaudeApiResponse {
  success: boolean;
  variants?: Array<{ name: string; code: string }>;
  error?: string;
  session_id?: string;
}

async function submitJob(prompt: string): Promise<string> {
  const response = await fetch(LAMBDA_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "claude-code",
      payload: {
        prompt,
        user_id: "6a922e44-464c-47c2-acbb-5df7dff67e63",
        group_id: "4a28626e-e34d-4c9a-822d-375dc7e587b2",
        parent_content_id: null,
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Lambda request failed: ${response.status} - ${errorText}`);
  }

  const data: JobResponse = await response.json();

  if (!data.job_id) {
    throw new Error(data.error || "No job_id returned from lambda");
  }

  return data.job_id;
}

async function pollJobStatus(jobId: string): Promise<ClaudeCodeResult> {
  const maxAttempts = 120; // 4 minutes max
  let attempt = 0;

  while (attempt < maxAttempts) {
    attempt++;

    // Exponential backoff
    const intervalMs = attempt <= 10 ? 1000 : attempt <= 30 ? 2000 : 3000;

    if (attempt > 1) {
      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }

    const response = await fetch(LAMBDA_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "get-job",
        payload: { job_id: jobId },
      }),
    });

    if (!response.ok) {
      if (attempt < 5) continue;
      throw new Error(`Failed to check job status: ${response.status}`);
    }

    const data: JobResponse = await response.json();

    if (!data.success || !data.job) {
      if (attempt < 5) continue;
      throw new Error(data.error || "Failed to get job status");
    }

    const { status, result, error } = data.job;

    console.log(`[Claude API] Poll job=${jobId} attempt=${attempt}: status=${status}`);

    if (status === "completed" && result) {
      console.log(`[Claude API] Job completed. Result keys: ${Object.keys(result).join(", ")}`);
      console.log(`[Claude API] tsx_files count: ${result.tsx_files?.length ?? 0}`);
      console.log(`[Claude API] file_count: ${result.file_count ?? 0}`);
      if (result.tsx_files?.length) {
        console.log(`[Claude API] TSX files: ${result.tsx_files.map(f => f.path).join(", ")}`);
      }
      return result;
    }

    if (status === "failed") {
      throw new Error(error || "Job execution failed");
    }

    // Continue polling for pending/processing status
  }

  throw new Error("Job execution timed out");
}

/**
 * Transform Claude Code output to CodeRenderer-compatible format
 * - Strips import statements (React is provided globally by CodeRenderer)
 * - Converts "export default function X()" to "function Component()"
 * - Handles various export patterns
 */
function transformToCodeRendererFormat(code: string): string {
  let transformed = code;

  // Remove all import statements (React is provided globally)
  transformed = transformed.replace(/^import\s+.*?from\s+['"].*?['"];?\s*$/gm, "");
  transformed = transformed.replace(/^import\s+['"].*?['"];?\s*$/gm, "");

  // Convert "export default function Name(" to "function Component("
  transformed = transformed.replace(
    /export\s+default\s+function\s+\w+\s*\(/g,
    "function Component("
  );

  // Handle "export default function(" (anonymous)
  transformed = transformed.replace(
    /export\s+default\s+function\s*\(/g,
    "function Component("
  );

  // Handle arrow function exports: "export default () =>" or "export default (props) =>"
  transformed = transformed.replace(
    /export\s+default\s*(\([^)]*\)|[a-zA-Z_$][a-zA-Z0-9_$]*)\s*=>/g,
    "function Component$1"
  );

  // Handle "const Name = () => { ... }; export default Name;"
  // First, find and extract the component name from "export default Name;"
  const exportDefaultMatch = transformed.match(/export\s+default\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*;?/);
  if (exportDefaultMatch) {
    const componentName = exportDefaultMatch[1];
    // Remove the export default statement
    transformed = transformed.replace(/export\s+default\s+[a-zA-Z_$][a-zA-Z0-9_$]*\s*;?/g, "");
    // Rename the component to "Component"
    const constPattern = new RegExp(`const\\s+${componentName}\\s*=`, "g");
    transformed = transformed.replace(constPattern, "function Component");
    // Also handle function declarations
    const funcPattern = new RegExp(`function\\s+${componentName}\\s*\\(`, "g");
    transformed = transformed.replace(funcPattern, "function Component(");
  }

  // Convert React.useState to just useState etc. (CodeRenderer provides React globally)
  // Actually, CodeRenderer wraps the code with React in scope, so React.useState works
  // But let's also support direct useState calls by keeping them as-is

  // Clean up extra whitespace from removed lines
  transformed = transformed.replace(/^\s*[\r\n]/gm, "");
  transformed = transformed.trim();

  return transformed;
}

function extractTsxFiles(
  tsxFiles: TsxFile[]
): Array<{ name: string; code: string }> {
  const variants: Array<{ name: string; code: string }> = [];

  console.log(`[Claude API] Processing ${tsxFiles.length} TSX files`);

  for (const file of tsxFiles) {
    try {
      // Decode base64 content
      const rawCode = Buffer.from(file.content, "base64").toString("utf-8");
      console.log(`[Claude API] Decoded ${file.path}, length: ${rawCode.length}`);
      // Transform to CodeRenderer-compatible format
      const code = transformToCodeRendererFormat(rawCode);
      const name = file.path.replace(/^.*\//, ""); // Get filename only
      variants.push({ name, code });
    } catch (e) {
      console.error(`[Claude API] Failed to decode file ${file.path}:`, e);
    }
  }

  console.log(`[Claude API] Extracted ${variants.length} TSX variants`);
  return variants;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { prompt } = body;

    if (!prompt || typeof prompt !== "string") {
      return new Response(JSON.stringify({ success: false, error: "Invalid prompt" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Submit the job
    console.log(`[Claude API] Submitting job with prompt: ${prompt.substring(0, 100)}...`);
    const jobId = await submitJob(prompt);
    console.log(`[Claude API] Job submitted: ${jobId}`);

    // Poll for completion
    const result = await pollJobStatus(jobId);
    console.log(`[Claude API] Polling complete. Success: ${result.success}`);

    if (!result.success) {
      return new Response(
        JSON.stringify({
          success: false,
          error: result.error || "Claude Code execution failed",
          session_id: result.session_id,
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Extract TSX files from result
    const variants = extractTsxFiles(result.tsx_files || []);

    const response: ClaudeApiResponse = {
      success: true,
      variants,
      session_id: result.session_id,
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Claude API error:", error);

    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}
