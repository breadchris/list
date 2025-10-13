import React from 'react';

interface Job {
	id: string;
	action: string;
	status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
	created_at: string;
	updated_at: string;
	progress?: {
		current?: number;
		total?: number;
		message?: string;
	};
	error?: string;
}

interface ContentJobsIndicatorProps {
	jobs: Job[];
	className?: string;
}

/**
 * Displays pending/processing jobs for a content item
 * Pure display component - receives jobs as props from parent
 */
export const ContentJobsIndicator: React.FC<ContentJobsIndicatorProps> = ({
	jobs,
	className = ''
}) => {

	const getStatusColor = (status: Job['status']) => {
		switch (status) {
			case 'pending':
				return 'bg-gray-100 text-gray-700 border-gray-300';
			case 'processing':
				return 'bg-blue-100 text-blue-700 border-blue-300';
			default:
				return 'bg-gray-100 text-gray-700 border-gray-300';
		}
	};

	const getActionLabel = (action: string) => {
		const labels: Record<string, string> = {
			'seo-extract': 'SEO',
			'llm-generate': 'LLM',
			'markdown-extract': 'Markdown',
			'youtube-playlist-extract': 'YouTube',
			'tmdb-search': 'TMDb',
			'libgen-search': 'Libgen',
			'screenshot-queue': 'Screenshot',
			'claude-code': 'Claude Code'
		};
		return labels[action] || action;
	};

	const renderProgressIndicator = (job: Job) => {
		if (job.status !== 'processing' || !job.progress) return null;

		const { current, total } = job.progress;
		const percentage = current && total ? Math.round((current / total) * 100) : 0;

		return (
			<div className="ml-1 text-xs">
				({percentage}%)
			</div>
		);
	};

	// Don't render anything if there are no jobs
	if (!jobs || jobs.length === 0) {
		return null;
	}

	return (
		<div className={`flex flex-wrap gap-1 items-center ${className}`}>
			{jobs.map((job) => (
				<div
					key={job.id}
					className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium border ${getStatusColor(job.status)}`}
					title={`${job.status === 'processing' ? 'Processing' : 'Queued'}: ${getActionLabel(job.action)}`}
				>
					{job.status === 'processing' && (
						<svg
							className="animate-spin h-3 w-3 mr-1"
							fill="none"
							viewBox="0 0 24 24"
						>
							<circle
								className="opacity-25"
								cx="12"
								cy="12"
								r="10"
								stroke="currentColor"
								strokeWidth="4"
							/>
							<path
								className="opacity-75"
								fill="currentColor"
								d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
							/>
						</svg>
					)}
					{job.status === 'pending' && (
						<svg
							className="h-3 w-3 mr-1"
							fill="none"
							stroke="currentColor"
							viewBox="0 0 24 24"
						>
							<path
								strokeLinecap="round"
								strokeLinejoin="round"
								strokeWidth={2}
								d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
							/>
						</svg>
					)}
					<span>{getActionLabel(job.action)}</span>
					{renderProgressIndicator(job)}
				</div>
			))}
		</div>
	);
};
