import React, { useState } from 'react';
import { config } from '@/lib/config';
import { supabase } from '@/components/SupabaseClient';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

interface TokenInfo {
	id: string;
	display_name: string;
	created_at: string;
	redeemed_at: string | null;
	last_used_at: string | null;
	is_revoked: boolean;
	user_id: string | null;
}

interface AccessLinksManagerProps {
	groupId: string;
}

export const AccessLinksManager: React.FC<AccessLinksManagerProps> = ({ groupId }) => {
	const [showGenerateModal, setShowGenerateModal] = useState(false);
	const [displayName, setDisplayName] = useState('');
	const [generatedLink, setGeneratedLink] = useState<string | null>(null);
	const [copySuccess, setCopySuccess] = useState(false);
	const queryClient = useQueryClient();

	// Fetch tokens for this group
	const { data: tokens = [], isLoading } = useQuery<TokenInfo[]>({
		queryKey: ['access-links', groupId],
		queryFn: async () => {
			const { data: { user } } = await supabase.auth.getUser();
			if (!user) throw new Error('Not authenticated');

			const response = await fetch(`${config.lambdaEndpoint}/content`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					action: 'auth-list-tokens',
					payload: {
						group_id: groupId,
						user_id: user.id
					}
				})
			});

			const result = await response.json();
			if (!result.success) {
				throw new Error(result.error || 'Failed to fetch access links');
			}
			return result.tokens || [];
		}
	});

	// Generate token mutation
	const generateMutation = useMutation({
		mutationFn: async (name: string) => {
			const { data: { user } } = await supabase.auth.getUser();
			if (!user) throw new Error('Not authenticated');

			const response = await fetch(`${config.lambdaEndpoint}/content`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					action: 'auth-generate-token',
					payload: {
						group_id: groupId,
						display_name: name,
						user_id: user.id
					}
				})
			});

			const result = await response.json();
			if (!result.success) {
				throw new Error(result.error || 'Failed to generate access link');
			}
			return result;
		},
		onSuccess: (data) => {
			setGeneratedLink(data.link);
			queryClient.invalidateQueries({ queryKey: ['access-links', groupId] });
		}
	});

	// Revoke token mutation
	const revokeMutation = useMutation({
		mutationFn: async (tokenId: string) => {
			const { data: { user } } = await supabase.auth.getUser();
			if (!user) throw new Error('Not authenticated');

			const response = await fetch(`${config.lambdaEndpoint}/content`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					action: 'auth-revoke-token',
					payload: {
						token_id: tokenId,
						user_id: user.id
					}
				})
			});

			const result = await response.json();
			if (!result.success) {
				throw new Error(result.error || 'Failed to revoke access');
			}
			return result;
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['access-links', groupId] });
		}
	});

	const handleGenerate = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!displayName.trim()) return;
		await generateMutation.mutateAsync(displayName.trim());
	};

	const handleCopyLink = async () => {
		if (!generatedLink) return;
		await navigator.clipboard.writeText(generatedLink);
		setCopySuccess(true);
		setTimeout(() => setCopySuccess(false), 2000);
	};

	const handleRevoke = async (tokenId: string, name: string) => {
		const confirmed = window.confirm(
			`Are you sure you want to revoke access for "${name}"? They will be logged out immediately.`
		);
		if (!confirmed) return;
		await revokeMutation.mutateAsync(tokenId);
	};

	const formatDate = (dateStr: string | null) => {
		if (!dateStr) return 'Never';
		return new Date(dateStr).toLocaleDateString(undefined, {
			year: 'numeric',
			month: 'short',
			day: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		});
	};

	const getStatusBadge = (token: TokenInfo) => {
		if (token.is_revoked) {
			return (
				<span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">
					Revoked
				</span>
			);
		}
		if (token.redeemed_at) {
			return (
				<span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
					Active
				</span>
			);
		}
		return (
			<span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800">
				Pending
			</span>
		);
	};

	const activeTokens = tokens.filter(t => !t.is_revoked);
	const revokedTokens = tokens.filter(t => t.is_revoked);

	return (
		<div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
			<div className="flex items-center justify-between mb-4">
				<div>
					<h2 className="text-lg font-semibold text-gray-900">Access Links</h2>
					<p className="text-sm text-gray-600 mt-1">
						Generate shareable links to invite family members
					</p>
				</div>
				<button
					onClick={() => {
						setShowGenerateModal(true);
						setGeneratedLink(null);
						setDisplayName('');
					}}
					className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
				>
					Generate Link
				</button>
			</div>

			{isLoading ? (
				<div className="py-8 text-center">
					<div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto"></div>
				</div>
			) : activeTokens.length === 0 ? (
				<div className="py-8 text-center text-gray-500">
					<p>No active access links yet.</p>
					<p className="text-sm mt-1">Generate a link to invite someone to this group.</p>
				</div>
			) : (
				<div className="space-y-3">
					{activeTokens.map((token) => (
						<div
							key={token.id}
							className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
						>
							<div className="flex-1">
								<div className="flex items-center gap-2">
									<span className="font-medium text-gray-900">{token.display_name}</span>
									{getStatusBadge(token)}
								</div>
								<div className="text-sm text-gray-500 mt-1">
									Created {formatDate(token.created_at)}
									{token.redeemed_at && (
										<> &bull; Joined {formatDate(token.redeemed_at)}</>
									)}
									{token.last_used_at && token.last_used_at !== token.redeemed_at && (
										<> &bull; Last active {formatDate(token.last_used_at)}</>
									)}
								</div>
							</div>
							{!token.is_revoked && (
								<button
									onClick={() => handleRevoke(token.id, token.display_name)}
									disabled={revokeMutation.isPending}
									className="px-3 py-1.5 text-red-600 hover:bg-red-50 rounded-lg text-sm font-medium transition-colors"
								>
									Revoke
								</button>
							)}
						</div>
					))}
				</div>
			)}

			{revokedTokens.length > 0 && (
				<div className="mt-6 pt-6 border-t border-gray-200">
					<h3 className="text-sm font-medium text-gray-700 mb-3">Revoked Access</h3>
					<div className="space-y-2">
						{revokedTokens.map((token) => (
							<div
								key={token.id}
								className="flex items-center justify-between p-3 bg-gray-100 rounded-lg opacity-60"
							>
								<div>
									<div className="flex items-center gap-2">
										<span className="font-medium text-gray-700">{token.display_name}</span>
										{getStatusBadge(token)}
									</div>
									<div className="text-sm text-gray-500">
										Created {formatDate(token.created_at)}
									</div>
								</div>
							</div>
						))}
					</div>
				</div>
			)}

			{/* Generate Link Modal */}
			{showGenerateModal && (
				<div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
					<div className="bg-white rounded-lg max-w-md w-full p-6">
						{!generatedLink ? (
							<>
								<h3 className="text-lg font-semibold text-gray-900 mb-4">
									Generate Access Link
								</h3>
								<form onSubmit={handleGenerate}>
									<div className="mb-4">
										<label className="block text-sm font-medium text-gray-700 mb-2">
											Who is this link for?
										</label>
										<input
											type="text"
											value={displayName}
											onChange={(e) => setDisplayName(e.target.value)}
											placeholder="e.g., Mom, Dad, Grandma..."
											className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
											maxLength={50}
											required
											autoFocus
										/>
										<p className="mt-1 text-sm text-gray-500">
											This name will be shown to other group members.
										</p>
									</div>
									<div className="flex justify-end space-x-3">
										<button
											type="button"
											onClick={() => setShowGenerateModal(false)}
											className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
											disabled={generateMutation.isPending}
										>
											Cancel
										</button>
										<button
											type="submit"
											disabled={!displayName.trim() || generateMutation.isPending}
											className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
										>
											{generateMutation.isPending ? 'Generating...' : 'Generate Link'}
										</button>
									</div>
								</form>
							</>
						) : (
							<>
								<div className="text-center mb-4">
									<div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
										<svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
											<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
										</svg>
									</div>
									<h3 className="text-lg font-semibold text-gray-900">
										Link Generated!
									</h3>
									<p className="text-sm text-gray-600 mt-1">
										Share this link with {displayName}
									</p>
								</div>

								<div className="bg-gray-50 rounded-lg p-3 mb-4">
									<p className="text-sm text-gray-700 font-mono break-all">{generatedLink}</p>
								</div>

								<div className="flex flex-col space-y-2">
									<button
										onClick={handleCopyLink}
										className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
									>
										{copySuccess ? 'Copied!' : 'Copy Link'}
									</button>
									<button
										onClick={() => setShowGenerateModal(false)}
										className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
									>
										Done
									</button>
								</div>

								<p className="mt-4 text-xs text-gray-500 text-center">
									This link can only be used once. You can revoke access at any time.
								</p>
							</>
						)}
					</div>
				</div>
			)}
		</div>
	);
};
