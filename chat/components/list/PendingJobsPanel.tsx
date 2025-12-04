import React, { useEffect, useState } from 'react';
import { contentRepository } from '@/lib/list/ContentRepository';
import type { RealtimeChannel } from '@supabase/supabase-js';

interface Job {
	id: string;
	action: string;
	status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
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

interface PendingJobsPanelProps {
	userId: string;
	onClose?: () => void;
}

export const PendingJobsPanel: React.FC<PendingJobsPanelProps> = ({ userId, onClose }) => {
	const [jobs, setJobs] = useState<Job[]>([]);
	const [loading, setLoading] = useState(true);
	const [filter, setFilter] = useState<'all' | 'active' | 'completed'>('active');

	useEffect(() => {
		loadJobs();

		// Subscribe to real-time updates
		const subscription = contentRepository.subscribeToJobs(userId, (payload) => {
			console.log('Job update received:', payload);

			// Reload jobs on any change
			loadJobs();
		});

		return () => {
			subscription.unsubscribe();
		};
	}, [userId, filter]);

	const loadJobs = async () => {
		try {
			setLoading(true);

			let statusFilter: string | string[] | undefined;
			if (filter === 'active') {
				statusFilter = ['pending', 'processing'];
			} else if (filter === 'completed') {
				statusFilter = ['completed', 'failed', 'cancelled'];
			}

			const fetchedJobs = await contentRepository.listJobs({
				status: statusFilter,
				limit: 50
			});

			setJobs(fetchedJobs);
		} catch (error) {
			console.error('Error loading jobs:', error);
		} finally {
			setLoading(false);
		}
	};

	const handleCancelJob = async (jobId: string) => {
		try {
			await contentRepository.cancelJob(jobId);
			await loadJobs();
		} catch (error) {
			console.error('Error cancelling job:', error);
			alert(`Failed to cancel job: ${error instanceof Error ? error.message : 'Unknown error'}`);
		}
	};

	const getStatusBadgeColor = (status: Job['status']) => {
		switch (status) {
			case 'pending':
				return 'bg-gray-200 text-gray-800';
			case 'processing':
				return 'bg-blue-200 text-blue-800';
			case 'completed':
				return 'bg-green-200 text-green-800';
			case 'failed':
				return 'bg-red-200 text-red-800';
			case 'cancelled':
				return 'bg-orange-200 text-orange-800';
			default:
				return 'bg-gray-200 text-gray-800';
		}
	};

	const getActionLabel = (action: string) => {
		const labels: Record<string, string> = {
			'seo-extract': 'SEO Extract',
			'llm-generate': 'LLM Generate',
			'markdown-extract': 'Markdown Extract',
			'youtube-playlist-extract': 'YouTube Playlist',
			'tmdb-search': 'TMDb Search',
			'libgen-search': 'Libgen Search'
		};
		return labels[action] || action;
	};

	const formatTimestamp = (timestamp: string) => {
		const date = new Date(timestamp);
		const now = new Date();
		const diffMs = now.getTime() - date.getTime();
		const diffMins = Math.floor(diffMs / 60000);
		const diffHours = Math.floor(diffMs / 3600000);

		if (diffMins < 1) return 'just now';
		if (diffMins < 60) return `${diffMins}m ago`;
		if (diffHours < 24) return `${diffHours}h ago`;
		return date.toLocaleDateString();
	};

	const renderProgressBar = (job: Job) => {
		if (job.status !== 'processing' || !job.progress) return null;

		const { current, total, message } = job.progress;
		const percentage = current && total ? Math.round((current / total) * 100) : 0;

		return (
			<div className="mt-2">
				<div className="flex justify-between text-xs text-gray-600 mb-1">
					<span>{message || 'Processing...'}</span>
					{current && total && <span>{current}/{total}</span>}
				</div>
				<div className="w-full bg-gray-200 rounded-full h-2">
					<div
						className="bg-blue-600 h-2 rounded-full transition-all duration-300"
						style={{ width: `${percentage}%` }}
					/>
				</div>
			</div>
		);
	};

	return (
		<div className="fixed inset-y-0 right-0 w-96 bg-white shadow-2xl border-l border-gray-200 flex flex-col z-50">
			{/* Header */}
			<div className="flex items-center justify-between p-4 border-b border-gray-200">
				<h2 className="text-lg font-semibold text-gray-900">Processing Jobs</h2>
				{onClose && (
					<button
						onClick={onClose}
						className="text-gray-400 hover:text-gray-600 transition"
					>
						<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
						</svg>
					</button>
				)}
			</div>

			{/* Filter Tabs */}
			<div className="flex border-b border-gray-200">
				<button
					onClick={() => setFilter('all')}
					className={`flex-1 px-4 py-2 text-sm font-medium ${
						filter === 'all'
							? 'text-blue-600 border-b-2 border-blue-600'
							: 'text-gray-500 hover:text-gray-700'
					}`}
				>
					All
				</button>
				<button
					onClick={() => setFilter('active')}
					className={`flex-1 px-4 py-2 text-sm font-medium ${
						filter === 'active'
							? 'text-blue-600 border-b-2 border-blue-600'
							: 'text-gray-500 hover:text-gray-700'
					}`}
				>
					Active
				</button>
				<button
					onClick={() => setFilter('completed')}
					className={`flex-1 px-4 py-2 text-sm font-medium ${
						filter === 'completed'
							? 'text-blue-600 border-b-2 border-blue-600'
							: 'text-gray-500 hover:text-gray-700'
					}`}
				>
					Completed
				</button>
			</div>

			{/* Job List */}
			<div className="flex-1 overflow-y-auto">
				{loading ? (
					<div className="flex items-center justify-center h-32">
						<div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
					</div>
				) : jobs.length === 0 ? (
					<div className="flex flex-col items-center justify-center h-32 text-gray-500">
						<svg className="w-12 h-12 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
						</svg>
						<p className="text-sm">No jobs found</p>
					</div>
				) : (
					<div className="divide-y divide-gray-100">
						{jobs.map((job) => (
							<div key={job.id} className="p-4 hover:bg-gray-50 transition">
								{/* Job Header */}
								<div className="flex items-start justify-between mb-2">
									<div className="flex-1">
										<div className="flex items-center gap-2 mb-1">
											<span className="font-medium text-gray-900 text-sm">
												{getActionLabel(job.action)}
											</span>
											<span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getStatusBadgeColor(job.status)}`}>
												{job.status}
											</span>
										</div>
										<p className="text-xs text-gray-500">
											{formatTimestamp(job.created_at)}
										</p>
									</div>

									{/* Action Buttons */}
									<div className="flex gap-2 ml-2">
										{job.status === 'pending' && (
											<button
												onClick={() => handleCancelJob(job.id)}
												className="text-xs text-red-600 hover:text-red-800 font-medium"
											>
												Cancel
											</button>
										)}
										{job.status === 'completed' && job.content_ids && job.content_ids.length > 0 && (
											<span className="text-xs text-green-600 font-medium">
												{job.content_ids.length} items
											</span>
										)}
									</div>
								</div>

								{/* Progress Bar */}
								{renderProgressBar(job)}

								{/* Error Message */}
								{job.status === 'failed' && job.error && (
									<div className="mt-2 p-2 bg-red-50 rounded text-xs text-red-700">
										{job.error}
									</div>
								)}

								{/* Duration */}
								{job.completed_at && (
									<div className="mt-2 text-xs text-gray-500">
										Completed in {Math.round((new Date(job.completed_at).getTime() - new Date(job.created_at).getTime()) / 1000)}s
									</div>
								)}
							</div>
						))}
					</div>
				)}
			</div>

			{/* Footer */}
			<div className="p-4 border-t border-gray-200 bg-gray-50">
				<button
					onClick={loadJobs}
					className="w-full px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition"
				>
					Refresh
				</button>
			</div>
		</div>
	);
};
