import { getGitHubToken } from "../auth/github-oauth";

export interface GitHubPR {
  number: number;
  title: string;
  body: string | null;
  html_url: string;
  state: string;
  created_at: string;
  updated_at: string;
  merged_at: string | null;
  user: {
    login: string;
  };
  base: {
    ref: string;
  };
  head: {
    ref: string;
  };
}

export interface GitHubCommit {
  sha: string;
  commit: {
    message: string;
    author: {
      name: string;
      email: string;
      date: string;
    };
  };
  html_url: string;
}

async function githubFetch<T>(endpoint: string, init?: RequestInit): Promise<T> {
  const token = await getGitHubToken();
  if (!token) {
    throw new Error("GitHub authorization required. Please run 'Authorize GitHub' command first.");
  }

  const response = await fetch(`https://api.github.com${endpoint}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      ...init?.headers,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`GitHub API error: ${response.status} ${response.statusText} - ${errorText}`);
  }

  return await response.json();
}

/**
 * Get the authenticated user's GitHub username
 */
export async function getAuthenticatedUser(): Promise<{ login: string; name: string }> {
  return await githubFetch<{ login: string; name: string }>("/user");
}

/**
 * Get PRs for a user within a date range
 * @param username - GitHub username
 * @param fromDate - Start date (YYYY-MM-DD)
 * @param toDate - End date (YYYY-MM-DD)
 */
export async function getUserPRs(username: string, fromDate: string, toDate: string): Promise<GitHubPR[]> {
  // GitHub search API query
  const query = `author:${username} is:pr created:${fromDate}..${toDate}`;
  const encodedQuery = encodeURIComponent(query);

  const response = await githubFetch<{ items: GitHubPR[] }>(`/search/issues?q=${encodedQuery}&sort=created&per_page=100`);
  return response.items;
}

/**
 * Get commits for a user within a date range across all repositories
 * @param username - GitHub username
 * @param fromDate - Start date (YYYY-MM-DD)
 * @param toDate - End date (YYYY-MM-DD)
 */
export async function getUserCommits(username: string, fromDate: string, toDate: string): Promise<GitHubCommit[]> {
  // GitHub search API for commits
  const query = `author:${username} committer-date:${fromDate}..${toDate}`;
  const encodedQuery = encodeURIComponent(query);

  const response = await githubFetch<{ items: GitHubCommit[] }>(`/search/commits?q=${encodedQuery}&sort=committer-date&per_page=100`);
  return response.items;
}

/**
 * Get PR details including commits
 */
export async function getPRDetails(owner: string, repo: string, prNumber: number): Promise<GitHubPR> {
  return await githubFetch<GitHubPR>(`/repos/${owner}/${repo}/pulls/${prNumber}`);
}

/**
 * Get commits for a specific PR
 */
export async function getPRCommits(owner: string, repo: string, prNumber: number): Promise<GitHubCommit[]> {
  return await githubFetch<GitHubCommit[]>(`/repos/${owner}/${repo}/pulls/${prNumber}/commits`);
}
