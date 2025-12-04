/**
 * Type definitions for content processing
 * Ported from Supabase Edge Function
 */

export interface ContentQueueJob {
	action: 'seo-extract' | 'llm-generate' | 'screenshot-process';
	payload: any;
	userId: string;
	priority?: number;
	retries?: number;
	createdAt: string;
}

export interface ContentRequest {
	action: 'seo-extract' | 'llm-generate' | 'screenshot-queue' | 'queue-process' | 'markdown-extract' | 'chat-message' | 'claude-code-execute' | 'claude-code' | 'youtube-playlist-extract' | 'youtube-subtitle-extract' | 'tmdb-search' | 'libgen-search' | 'get-job' | 'list-jobs' | 'cancel-job' | 'tsx-transpile' | 'transcribe-audio' | 'teller-accounts' | 'teller-balances' | 'teller-transactions';
	payload: any;
	sync?: boolean; // When true, execute immediately and return results. When false/omitted, queue job (default)
}

export interface ContentResponse {
	success: boolean;
	data?: any;
	error?: string;
	queued?: boolean;
}

// SEO Types
export interface SEOMetadata {
	title?: string;
	description?: string;
	image?: string;
	favicon?: string;
	domain?: string;
	siteName?: string;
	type?: string;
	url?: string;
}

export interface SEOExtractPayload {
	selectedContent: ContentItem[];
	onProgress?: (item: any) => void;
}

// LLM Types
export interface ContentItem {
	id: string;
	type: string;
	data: string;
	group_id: string;
	user_id: string;
	parent_content_id: string | null;
	metadata?: any;
	created_at: string;
	updated_at: string;
}

export interface LLMGeneratePayload {
	system_prompt: string;
	selected_content: ContentItem[];
	group_id: string;
	parent_content_id?: string | null;
}

export interface GeneratedContent {
	type: string;
	data: string;
}

// Screenshot Types
export interface ScreenshotQueuePayload {
	jobs: Array<{
		contentId: string;
		url: string;
	}>;
}

export interface ScreenshotProcessPayload {
	contentId: string;
	url: string;
}

// Markdown Types
export interface MarkdownExtractPayload {
	selectedContent: ContentItem[];
}

export interface MarkdownMetadata {
	source_url: string;
	extracted_at: string;
	cloudflare_markdown: boolean;
}

// Chat Types
export interface ChatMessagePayload {
	chat_content_id: string;
	message: string;
	group_id: string;
}

// Claude Code Types
export interface ClaudeCodeExecutePayload {
	prompt: string;
	user_id: string;
	group_id: string;
	parent_content_id: string;
	session_id?: string;
	github_repo?: {
		owner: string;
		name: string;
		branch: string;
		token: string; // GitHub OAuth access token
	};
}

// Claude Code Job Status Types
export interface ClaudeCodeStatusPayload {
	job_id: string;
}

export interface ClaudeCodeJobResponse {
	job_id: string;
	status: 'pending' | 'running' | 'completed' | 'error';
	created_at: string;
	result?: {
		success: boolean;
		session_id?: string;
		messages?: any[];
		s3_url?: string;
		error?: string;
		stdout?: string;
		stderr?: string;
		exitCode?: number;
	};
	error?: string;
}

// YouTube Playlist Types
export interface YouTubePlaylistPayload {
	selectedContent: ContentItem[];
}

// YouTube Subtitle Types
export interface YouTubeSubtitlePayload {
	selectedContent: ContentItem[];
}

export interface YouTubeSubtitleTrack {
	language_code: string;
	name: string;
	base_url: string;
	content: string;
	is_automatic: boolean;
}

export interface YouTubeSubtitleResult {
	content_id: string;
	success: boolean;
	video_id?: string;
	tracks_found?: number;
	transcript_content_ids?: string[];
	error?: string;
}

export interface YouTubeThumbnail {
	url: string;
	width: number;
	height: number;
}

export interface YouTubeVideo {
	id: string;
	title: string;
	url: string;
	duration: number;
	author: string;
	channel_id: string;
	channel_handle: string;
	description: string;
	views: number;
	publish_date: string;
	thumbnails: YouTubeThumbnail[];
}

// TMDb Types
export interface TMDbSearchPayload {
	selectedContent: ContentItem[];
	searchType?: 'movie' | 'tv' | 'multi';  // defaults to 'multi'
	mode: 'search-only' | 'add-selected';  // search-only: return results, add-selected: create content
	selectedResults?: number[];  // TMDb IDs to add (for add-selected mode)
}

export interface TMDbMovie {
	id: number;
	title: string;
	original_title: string;
	overview: string;
	poster_path: string | null;
	backdrop_path: string | null;
	release_date: string;
	vote_average: number;
	vote_count: number;
	popularity: number;
	genre_ids: number[];
	original_language: string;
	adult: boolean;
	media_type?: string;
}

export interface TMDbTVShow {
	id: number;
	name: string;
	original_name: string;
	overview: string;
	poster_path: string | null;
	backdrop_path: string | null;
	first_air_date: string;
	vote_average: number;
	vote_count: number;
	popularity: number;
	genre_ids: number[];
	original_language: string;
	media_type?: string;
}

export interface TMDbSearchResponse {
	page: number;
	results: (TMDbMovie | TMDbTVShow)[];
	total_pages: number;
	total_results: number;
}

// OpenAI Types
export interface OpenAIMessage {
	role: 'system' | 'user' | 'assistant' | 'tool';
	content: string;
	tool_calls?: any[];
	tool_call_id?: string;
}

// Libgen Types
export interface LibgenSearchPayload {
	selectedContent: ContentItem[];
	searchType?: 'default' | 'title' | 'author';
	topics?: string[];
	filters?: Record<string, string>;
	maxResults?: number; // Max results per content item
	autoCreate?: boolean; // If false, return book metadata without creating Content items (default: true)
}

// Job Queue Types
export type JobStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';

export interface ContentJob {
	job_id: string;
	user_id: string;
	group_id: string;
	action: string;
	payload: any;
	created_at: string;
}

export interface JobStatusResponse {
	job_id: string;
	status: JobStatus;
	action: string;
	created_at: string;
	updated_at: string;
	started_at?: string;
	completed_at?: string;
	progress?: {
		current?: number;
		total?: number;
		message?: string;
	};
	result?: any;
	error?: string;
	content_ids?: string[];
}

export interface CreateJobResponse {
	success: boolean;
	job_id?: string;
	status?: JobStatus;
	error?: string;
}

export interface ListJobsRequest {
	status?: JobStatus | JobStatus[];
	limit?: number;
	offset?: number;
}

export interface ListJobsResponse {
	success: boolean;
	jobs?: JobStatusResponse[];
	total?: number;
	error?: string;
}

export interface CancelJobRequest {
	job_id: string;
}

export interface CancelJobResponse {
	success: boolean;
	error?: string;
}

// SQS Event Types
export interface SQSMessageBody {
	job_id: string;
	user_id: string;
	group_id: string;
	action: string;
	payload: any;
	created_at: string;
}

// TSX Transpilation Types
export interface TSXTranspilePayload {
	tsx_code: string;
	filename?: string;
}

export interface TSXTranspileResponse {
	success: boolean;
	compiled_js?: string;
	error?: string;
	errors?: Array<{
		message: string;
		location?: {
			file: string;
			line: number;
			column: number;
			lineText?: string;
		};
	}>;
	warnings?: Array<{
		message: string;
		location?: {
			file: string;
			line: number;
			column: number;
			lineText?: string;
		};
	}>;
}

// Deepgram Transcription Types
export interface TranscribeAudioPayload {
	selectedContent: ContentItem[];
	onProgress?: (item: any) => void;
}

export interface DeepgramWord {
	word: string;
	start: number;
	end: number;
	confidence: number;
	speaker?: number;
	punctuated_word?: string;
}

export interface DeepgramUtterance {
	start: number;
	end: number;
	transcript: string;
	words: DeepgramWord[];
	speaker: number;
	confidence: number;
	channel: number;
	id: string;
}

export interface DeepgramChannel {
	alternatives: Array<{
		transcript: string;
		confidence: number;
		words: DeepgramWord[];
	}>;
}

export interface DeepgramResults {
	channels: DeepgramChannel[];
	utterances?: DeepgramUtterance[];
}

export interface DeepgramMetadata {
	transaction_key: string;
	request_id: string;
	sha256: string;
	created: string;
	duration: number;
	channels: number;
	models: string[];
	model_info: Record<string, any>;
}

export interface DeepgramResponse {
	metadata: DeepgramMetadata;
	results: DeepgramResults;
}

export interface TranscribeAudioResult {
	content_id: string;
	success: boolean;
	transcript_content_id?: string;
	error?: string;
}

// Teller Banking Types
export interface TellerAccountsPayload {
	selectedContent: ContentItem[]; // Parent enrollment content items
}

export interface TellerBalancesPayload {
	selectedContent: ContentItem[]; // Account content items
}

export interface TellerTransactionsPayload {
	selectedContent: ContentItem[]; // Account content items
	count?: number; // Number of transactions to fetch (default 100)
}

export interface TellerEnrollmentMetadata {
	enrollment_id: string;
	access_token: string;
	institution_id: string;
	institution_name: string;
	status: 'connected' | 'disconnected' | 'error';
	last_synced?: string;
}

export interface TellerAccountMetadata {
	account_id: string;
	enrollment_id: string;
	institution_name: string;
	account_type: string;
	subtype: string;
	currency: string;
	last_four: string;
	balance_available?: number;
	balance_current?: number;
	last_synced?: string;
}

export interface TellerTransactionMetadata {
	transaction_id: string;
	account_id: string;
	amount: number;
	date: string;
	category: string;
	status: string;
	merchant_name?: string;
	running_balance?: number;
}
