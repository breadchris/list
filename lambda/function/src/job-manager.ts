/**
 * Job Manager
 * Handles all database operations for content processing jobs
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { SendMessageCommand, SQSClient } from '@aws-sdk/client-sqs';

export type JobStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';

export interface ContentProcessingJob {
	id: string;
	created_at: string;
	updated_at: string;
	user_id: string;
	group_id: string;
	action: string;
	payload: any;
	status: JobStatus;
	progress?: {
		current?: number;
		total?: number;
		message?: string;
	};
	result?: any;
	error?: string;
	started_at?: string;
	completed_at?: string;
	content_ids?: string[];
}

export interface CreateJobParams {
	user_id: string;
	group_id: string;
	action: string;
	payload: any;
	target_content_ids?: string[];
}

export interface UpdateJobStatusParams {
	job_id: string;
	status: JobStatus;
	progress?: any;
	error?: string;
	started_at?: string;
	completed_at?: string;
}

export interface CompleteJobParams {
	job_id: string;
	result: any;
	content_ids?: string[];
}

export interface FailJobParams {
	job_id: string;
	error: string;
}

export interface ListJobsParams {
	user_id: string;
	status?: JobStatus | JobStatus[];
	limit?: number;
	offset?: number;
}

export class JobManager {
	private supabase: SupabaseClient;
	private sqsClient?: SQSClient;
	private queueUrl?: string;

	constructor(supabase: SupabaseClient, queueUrl?: string) {
		this.supabase = supabase;
		this.queueUrl = queueUrl;

		// Initialize SQS client if queue URL is provided
		if (queueUrl) {
			this.sqsClient = new SQSClient({ region: process.env.AWS_REGION || 'us-east-1' });
		}
	}

	/**
	 * Create a new job record in the database
	 */
	async createJob(params: CreateJobParams): Promise<ContentProcessingJob> {
		const { user_id, group_id, action, payload, target_content_ids } = params;

		const insertData: any = {
			user_id,
			group_id,
			action,
			payload,
			status: 'pending' as JobStatus
		};

		// Add content_ids if target content IDs were provided
		if (target_content_ids && target_content_ids.length > 0) {
			insertData.content_ids = target_content_ids;
		}

		const { data, error } = await this.supabase
			.from('content_processing_jobs')
			.insert(insertData)
			.select()
			.single();

		if (error) {
			console.error('Error creating job:', error);
			throw new Error(`Failed to create job: ${error.message}`);
		}

		return data as ContentProcessingJob;
	}

	/**
	 * Enqueue a job to SQS for processing
	 */
	async enqueueJob(job: ContentProcessingJob): Promise<void> {
		if (!this.sqsClient || !this.queueUrl) {
			throw new Error('SQS client not initialized. Queue URL required.');
		}

		const message = {
			job_id: job.id,
			user_id: job.user_id,
			group_id: job.group_id,
			action: job.action,
			payload: job.payload,
			created_at: job.created_at
		};

		const command = new SendMessageCommand({
			QueueUrl: this.queueUrl,
			MessageBody: JSON.stringify(message),
			MessageAttributes: {
				'job_id': {
					DataType: 'String',
					StringValue: job.id
				},
				'action': {
					DataType: 'String',
					StringValue: job.action
				},
				'user_id': {
					DataType: 'String',
					StringValue: job.user_id
				}
			}
		});

		await this.sqsClient.send(command);
		console.log(`Job ${job.id} enqueued to SQS`);
	}

	/**
	 * Update job status and optional fields
	 */
	async updateJobStatus(params: UpdateJobStatusParams): Promise<void> {
		const { job_id, status, progress, error, started_at, completed_at } = params;

		const updateData: any = { status };

		if (progress !== undefined) {
			updateData.progress = progress;
		}
		if (error !== undefined) {
			updateData.error = error;
		}
		if (started_at) {
			updateData.started_at = started_at;
		}
		if (completed_at) {
			updateData.completed_at = completed_at;
		}

		const { error: updateError } = await this.supabase
			.from('content_processing_jobs')
			.update(updateData)
			.eq('id', job_id);

		if (updateError) {
			console.error('Error updating job status:', updateError);
			throw new Error(`Failed to update job status: ${updateError.message}`);
		}

		console.log(`Job ${job_id} status updated to: ${status}`);
	}

	/**
	 * Mark job as processing (when Lambda starts processing)
	 */
	async startJob(job_id: string): Promise<void> {
		await this.updateJobStatus({
			job_id,
			status: 'processing',
			started_at: new Date().toISOString()
		});
	}

	/**
	 * Mark job as completed with results
	 */
	async completeJob(params: CompleteJobParams): Promise<void> {
		const { job_id, result, content_ids } = params;

		const updateData: any = {
			status: 'completed' as JobStatus,
			result,
			completed_at: new Date().toISOString()
		};

		if (content_ids) {
			updateData.content_ids = content_ids;
		}

		const { error } = await this.supabase
			.from('content_processing_jobs')
			.update(updateData)
			.eq('id', job_id);

		if (error) {
			console.error('Error completing job:', error);
			throw new Error(`Failed to complete job: ${error.message}`);
		}

		console.log(`Job ${job_id} completed successfully`);
	}

	/**
	 * Mark job as failed with error message
	 */
	async failJob(params: FailJobParams): Promise<void> {
		const { job_id, error: errorMessage } = params;

		await this.updateJobStatus({
			job_id,
			status: 'failed',
			error: errorMessage,
			completed_at: new Date().toISOString()
		});

		console.log(`Job ${job_id} failed: ${errorMessage}`);
	}

	/**
	 * Update job progress
	 */
	async updateProgress(job_id: string, progress: any): Promise<void> {
		await this.updateJobStatus({
			job_id,
			status: 'processing', // Keep status as processing
			progress
		});
	}

	/**
	 * Get a specific job by ID
	 */
	async getJob(job_id: string): Promise<ContentProcessingJob | null> {
		const { data, error } = await this.supabase
			.from('content_processing_jobs')
			.select('*')
			.eq('id', job_id)
			.single();

		if (error) {
			if (error.code === 'PGRST116') {
				return null; // Job not found
			}
			console.error('Error fetching job:', error);
			throw new Error(`Failed to fetch job: ${error.message}`);
		}

		return data as ContentProcessingJob;
	}

	/**
	 * List jobs for a user with optional filtering
	 */
	async listUserJobs(params: ListJobsParams): Promise<ContentProcessingJob[]> {
		const { user_id, status, limit = 50, offset = 0 } = params;

		let query = this.supabase
			.from('content_processing_jobs')
			.select('*')
			.eq('user_id', user_id)
			.order('created_at', { ascending: false })
			.range(offset, offset + limit - 1);

		if (status) {
			if (Array.isArray(status)) {
				query = query.in('status', status);
			} else {
				query = query.eq('status', status);
			}
		}

		const { data, error } = await query;

		if (error) {
			console.error('Error listing jobs:', error);
			throw new Error(`Failed to list jobs: ${error.message}`);
		}

		return (data as ContentProcessingJob[]) || [];
	}

	/**
	 * Cancel a pending job
	 * Only jobs in 'pending' status can be cancelled
	 */
	async cancelJob(job_id: string, user_id: string): Promise<boolean> {
		// First verify the job exists, is pending, and belongs to the user
		const job = await this.getJob(job_id);

		if (!job) {
			throw new Error('Job not found');
		}

		if (job.user_id !== user_id) {
			throw new Error('Unauthorized: Job belongs to another user');
		}

		if (job.status !== 'pending') {
			throw new Error(`Cannot cancel job with status: ${job.status}`);
		}

		// Update status to cancelled
		await this.updateJobStatus({
			job_id,
			status: 'cancelled',
			completed_at: new Date().toISOString()
		});

		return true;
	}

	/**
	 * Get count of jobs by status for a user
	 */
	async getJobStatusCounts(user_id: string): Promise<Record<JobStatus, number>> {
		const { data, error } = await this.supabase
			.from('content_processing_jobs')
			.select('status')
			.eq('user_id', user_id);

		if (error) {
			console.error('Error getting job counts:', error);
			throw new Error(`Failed to get job counts: ${error.message}`);
		}

		const counts: Record<string, number> = {
			pending: 0,
			processing: 0,
			completed: 0,
			failed: 0,
			cancelled: 0
		};

		data?.forEach(job => {
			counts[job.status] = (counts[job.status] || 0) + 1;
		});

		return counts as Record<JobStatus, number>;
	}
}
