import { getGitHubPAT } from "../auth/github-oauth";

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
  const token = await getGitHubPAT();
  if (!token) {
    throw new Error("GitHub Personal Access Token required. Please run 'Authorize GitHub PAT' command first.");
  }

  console.log(`[GitHub API] Fetching: ${endpoint}`);

  const response = await fetch(`https://api.github.com${endpoint}`, {
    ...init,
    headers: {
      Authorization: `token ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      ...init?.headers,
    },
  });

  console.log(`[GitHub API] Response status: ${response.status} ${response.statusText}`);

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`[GitHub API] Error response: ${errorText}`);
    throw new Error(`GitHub API error: ${response.status} ${response.statusText} - ${errorText}`);
  }

  return await response.json();
}

/**
 * Get the authenticated user's GitHub username and token info
 */
export async function getAuthenticatedUser(): Promise<{ login: string; name: string }> {
  const result = await githubFetch<{ login: string; name: string }>("/user");
  console.log(`[GitHub API] Authenticated as: ${result.login} (name: ${result.name})`);
  console.log(`[GitHub API] Full user object:`, JSON.stringify(result, null, 2));
  return result;
}

/**
 * Check current token scopes (for debugging)
 */
export async function checkTokenScopes(): Promise<string[]> {
  const token = await getGitHubPAT();
  if (!token) {
    return [];
  }

  const response = await fetch("https://api.github.com/user", {
    headers: {
      Authorization: `token ${token}`,
      Accept: "application/vnd.github+json",
    },
  });

  const scopes = response.headers.get("X-OAuth-Scopes");
  console.log(`[GitHub API] Token scopes: ${scopes || "none"}`);

  return scopes ? scopes.split(",").map((s) => s.trim()) : [];
}

/**
 * Get PRs for a user within a date range
 * Includes PRs authored by the user OR merged during the date range
 * @param username - GitHub username
 * @param fromDate - Start date (YYYY-MM-DD)
 * @param toDate - End date (YYYY-MM-DD)
 */
export async function getUserPRs(username: string, fromDate: string, toDate: string): Promise<GitHubPR[]> {
  // DEBUGGING: Try multiple search strategies
  console.log(`[GitHub API] Attempting to find PRs for user: ${username}`);
  console.log(`[GitHub API] Date range: ${fromDate} to ${toDate}`);

  // Strategy 1: Search by author
  const query1 = `author:${username} is:pr`;
  console.log(`[GitHub API] Strategy 1 - Query: ${query1}`);

  try {
    const response1 = await githubFetch<{ items: GitHubPR[]; total_count: number }>(
      `/search/issues?q=${encodeURIComponent(query1)}&sort=updated&order=desc&per_page=100`,
    );
    console.log(`[GitHub API] Strategy 1 result: ${response1.total_count} PRs found`);

    if (response1.total_count > 0) {
      console.log(
        `[GitHub API] Sample PRs:`,
        response1.items.slice(0, 3).map((pr) => ({
          title: pr.title,
          number: pr.number,
          url: pr.html_url,
          updated: pr.updated_at,
        })),
      );

      // Filter by date
      const filtered = response1.items.filter((pr) => {
        const prDate = pr.updated_at.substring(0, 10);
        return prDate >= fromDate && prDate <= toDate;
      });
      console.log(`[GitHub API] After date filter: ${filtered.length} PRs`);
      return filtered;
    }
  } catch (error) {
    console.error(`[GitHub API] Strategy 1 failed:`, error);
  }

  // Strategy 2: Search by involves (more permissive - includes PRs you're involved in)
  const query2 = `involves:${username} is:pr`;
  console.log(`[GitHub API] Strategy 2 - Query: ${query2}`);

  try {
    const response2 = await githubFetch<{ items: GitHubPR[]; total_count: number }>(
      `/search/issues?q=${encodeURIComponent(query2)}&sort=updated&order=desc&per_page=100`,
    );
    console.log(`[GitHub API] Strategy 2 result: ${response2.total_count} PRs found`);

    if (response2.total_count > 0) {
      console.log(
        `[GitHub API] Sample PRs:`,
        response2.items.slice(0, 3).map((pr) => ({
          title: pr.title,
          number: pr.number,
          url: pr.html_url,
          updated: pr.updated_at,
        })),
      );

      // Filter by date
      const filtered = response2.items.filter((pr) => {
        const prDate = pr.updated_at.substring(0, 10);
        return prDate >= fromDate && prDate <= toDate;
      });
      console.log(`[GitHub API] After date filter: ${filtered.length} PRs`);
      return filtered;
    }
  } catch (error) {
    console.error(`[GitHub API] Strategy 2 failed:`, error);
  }

  console.log(`[GitHub API] No PRs found with any strategy`);
  return [];
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

  console.log(`[GitHub API] Searching commits with query: ${query}`);

  const response = await githubFetch<{ items: GitHubCommit[]; total_count: number }>(
    `/search/commits?q=${encodedQuery}&sort=committer-date&per_page=100`,
  );

  console.log(`[GitHub API] Found ${response.total_count} total commits, returning ${response.items.length} items`);

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
