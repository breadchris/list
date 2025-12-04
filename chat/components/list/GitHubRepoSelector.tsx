import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/list/SupabaseClient';
import { useToast } from './ToastProvider';

export interface GitHubRepo {
  id: number;
  name: string;
  full_name: string;
  owner: {
    login: string;
  };
  default_branch: string;
  clone_url: string;
  html_url: string;
  description?: string;
  private: boolean;
}

export interface GitHubRepoSelection {
  owner: string;
  name: string;
  branch: string;
  clone_url: string;
}

interface GitHubRepoSelectorProps {
  onSelect: (selection: GitHubRepoSelection | null) => void;
  initialSelection?: GitHubRepoSelection;
}

export const GitHubRepoSelector: React.FC<GitHubRepoSelectorProps> = ({
  onSelect,
  initialSelection
}) => {
  const [repos, setRepos] = useState<GitHubRepo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRepo, setSelectedRepo] = useState<GitHubRepo | null>(null);
  const [selectedBranch, setSelectedBranch] = useState<string>('');
  const [branches, setBranches] = useState<string[]>([]);
  const [loadingBranches, setLoadingBranches] = useState(false);
  const [githubToken, setGitHubToken] = useState<string | null>(null);
  const toast = useToast();

  // Get GitHub token from user identities
  useEffect(() => {
    const fetchGitHubToken = async () => {
      try {
        const { data: { user }, error: userError } = await supabase.auth.getUser();

        if (userError || !user) {
          setError('You must be logged in');
          return;
        }

        const githubIdentity = user.identities?.find(identity => identity.provider === 'github');

        if (!githubIdentity) {
          setError('No GitHub account linked. Please link your GitHub account first.');
          return;
        }

        // Access token is stored in identity_data
        const token = (githubIdentity.identity_data as any)?.provider_token;

        if (!token) {
          setError('GitHub token not found. Please re-link your GitHub account.');
          return;
        }

        setGitHubToken(token);
      } catch (err) {
        console.error('Error fetching GitHub token:', err);
        setError('Failed to retrieve GitHub credentials');
      }
    };

    fetchGitHubToken();
  }, []);

  // Fetch user's repositories from GitHub API
  useEffect(() => {
    if (!githubToken) return;

    const fetchRepos = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch('https://api.github.com/user/repos?sort=updated&per_page=100', {
          headers: {
            'Authorization': `Bearer ${githubToken}`,
            'Accept': 'application/vnd.github.v3+json'
          }
        });

        if (!response.ok) {
          throw new Error(`GitHub API error: ${response.status}`);
        }

        const data: GitHubRepo[] = await response.json();
        setRepos(data);

        // If there's an initial selection, find and select that repo
        if (initialSelection) {
          const initialRepo = data.find(r =>
            r.owner.login === initialSelection.owner &&
            r.name === initialSelection.name
          );
          if (initialRepo) {
            setSelectedRepo(initialRepo);
            setSelectedBranch(initialSelection.branch);
          }
        }
      } catch (err) {
        console.error('Error fetching repos:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch repositories');
        toast.error('Failed to fetch repositories', 'Please try again');
      } finally {
        setLoading(false);
      }
    };

    fetchRepos();
  }, [githubToken, initialSelection, toast]);

  // Fetch branches when repo is selected
  useEffect(() => {
    if (!selectedRepo || !githubToken) return;

    const fetchBranches = async () => {
      setLoadingBranches(true);

      try {
        const response = await fetch(
          `https://api.github.com/repos/${selectedRepo.full_name}/branches`,
          {
            headers: {
              'Authorization': `Bearer ${githubToken}`,
              'Accept': 'application/vnd.github.v3+json'
            }
          }
        );

        if (!response.ok) {
          throw new Error(`Failed to fetch branches: ${response.status}`);
        }

        const data = await response.json();
        const branchNames = data.map((b: any) => b.name);
        setBranches(branchNames);

        // Auto-select default branch if not already selected
        if (!selectedBranch && selectedRepo.default_branch) {
          setSelectedBranch(selectedRepo.default_branch);
        }
      } catch (err) {
        console.error('Error fetching branches:', err);
        toast.error('Failed to fetch branches', 'Using default branch');
        // Fallback to default branch
        setBranches([selectedRepo.default_branch]);
        setSelectedBranch(selectedRepo.default_branch);
      } finally {
        setLoadingBranches(false);
      }
    };

    fetchBranches();
  }, [selectedRepo, githubToken, toast]);

  // Notify parent when selection changes
  useEffect(() => {
    if (selectedRepo && selectedBranch) {
      onSelect({
        owner: selectedRepo.owner.login,
        name: selectedRepo.name,
        branch: selectedBranch,
        clone_url: selectedRepo.clone_url
      });
    } else {
      onSelect(null);
    }
  }, [selectedRepo, selectedBranch, onSelect]);

  const filteredRepos = repos.filter(repo =>
    repo.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    repo.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-red-800 text-sm">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Select GitHub Repository
        </label>

        {/* Search */}
        <input
          type="text"
          placeholder="Search repositories..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md mb-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />

        {/* Repository list */}
        {loading ? (
          <div className="text-center py-4 text-gray-600">
            Loading repositories...
          </div>
        ) : (
          <div className="border border-gray-300 rounded-md max-h-60 overflow-y-auto">
            {filteredRepos.length === 0 ? (
              <div className="text-center py-4 text-gray-500">
                No repositories found
              </div>
            ) : (
              filteredRepos.map((repo) => (
                <button
                  key={repo.id}
                  onClick={() => setSelectedRepo(repo)}
                  className={`w-full text-left px-4 py-3 border-b border-gray-200 hover:bg-gray-50 transition-colors ${
                    selectedRepo?.id === repo.id ? 'bg-blue-50 border-blue-300' : ''
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {repo.full_name}
                      </p>
                      {repo.description && (
                        <p className="text-xs text-gray-500 truncate">
                          {repo.description}
                        </p>
                      )}
                    </div>
                    {repo.private && (
                      <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-200 text-gray-800">
                        Private
                      </span>
                    )}
                  </div>
                </button>
              ))
            )}
          </div>
        )}
      </div>

      {/* Branch selector */}
      {selectedRepo && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Select Branch
          </label>
          {loadingBranches ? (
            <div className="text-center py-2 text-gray-600 text-sm">
              Loading branches...
            </div>
          ) : (
            <select
              value={selectedBranch}
              onChange={(e) => setSelectedBranch(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select a branch...</option>
              {branches.map((branch) => (
                <option key={branch} value={branch}>
                  {branch}
                  {branch === selectedRepo.default_branch && ' (default)'}
                </option>
              ))}
            </select>
          )}
        </div>
      )}

      {/* Selection summary */}
      {selectedRepo && selectedBranch && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-3">
          <p className="text-sm text-green-800">
            <strong>Selected:</strong> {selectedRepo.full_name} ({selectedBranch})
          </p>
          <p className="text-xs text-green-700 mt-1">
            Claude Code will clone this repository, make changes, and push commits
          </p>
        </div>
      )}
    </div>
  );
};

export default GitHubRepoSelector;
