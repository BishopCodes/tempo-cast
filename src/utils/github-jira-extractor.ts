import { GitHubPR, GitHubCommit } from "../api/github";

export interface JiraIssueReference {
  issueKey: string;
  source: "pr-title" | "pr-body" | "pr-branch" | "commit-message";
  prNumber?: number;
  prTitle?: string;
  prUrl?: string;
  commitSha?: string;
  commitMessage?: string;
  date?: string;
}

/**
 * Extract Jira issue keys from text
 * Matches patterns like ABC-123, PROJECT-456, etc.
 */
export function extractJiraKeys(text: string): string[] {
  if (!text) return [];
  
  // Match Jira issue keys: 2+ uppercase letters, hyphen, 1+ digits
  const regex = /\b([A-Z]{2,})-(\d+)\b/g;
  const matches = text.matchAll(regex);
  
  const keys = new Set<string>();
  for (const match of matches) {
    keys.add(match[0]);
  }
  
  return Array.from(keys);
}

/**
 * Extract Jira issue references from a GitHub PR
 */
export function extractJiraFromPR(pr: GitHubPR): JiraIssueReference[] {
  const references: JiraIssueReference[] = [];

  // Extract from PR title
  const titleKeys = extractJiraKeys(pr.title);
  titleKeys.forEach((key) => {
    references.push({
      issueKey: key,
      source: "pr-title",
      prNumber: pr.number,
      prTitle: pr.title,
      prUrl: pr.html_url,
      date: pr.merged_at || pr.created_at,
    });
  });

  // Extract from PR body
  if (pr.body) {
    const bodyKeys = extractJiraKeys(pr.body);
    bodyKeys.forEach((key) => {
      // Avoid duplicates from title
      if (!titleKeys.includes(key)) {
        references.push({
          issueKey: key,
          source: "pr-body",
          prNumber: pr.number,
          prTitle: pr.title,
          prUrl: pr.html_url,
          date: pr.merged_at || pr.created_at,
        });
      }
    });
  }

  // Extract from branch name
  const branchKeys = extractJiraKeys(pr.head.ref);
  branchKeys.forEach((key) => {
    // Avoid duplicates from title/body
    if (!titleKeys.includes(key) && !references.some((r) => r.issueKey === key)) {
      references.push({
        issueKey: key,
        source: "pr-branch",
        prNumber: pr.number,
        prTitle: pr.title,
        prUrl: pr.html_url,
        date: pr.merged_at || pr.created_at,
      });
    }
  });

  return references;
}

/**
 * Extract Jira issue references from GitHub commits
 */
export function extractJiraFromCommits(commits: GitHubCommit[]): JiraIssueReference[] {
  const references: JiraIssueReference[] = [];

  commits.forEach((commit) => {
    const keys = extractJiraKeys(commit.commit.message);
    keys.forEach((key) => {
      references.push({
        issueKey: key,
        source: "commit-message",
        commitSha: commit.sha,
        commitMessage: commit.commit.message,
        date: commit.commit.author.date,
      });
    });
  });

  return references;
}

/**
 * Deduplicate and group Jira references by issue key
 */
export function groupJiraReferences(references: JiraIssueReference[]): Map<string, JiraIssueReference[]> {
  const grouped = new Map<string, JiraIssueReference[]>();

  references.forEach((ref) => {
    const existing = grouped.get(ref.issueKey) || [];
    existing.push(ref);
    grouped.set(ref.issueKey, existing);
  });

  return grouped;
}

/**
 * Get the most relevant reference for an issue key
 * Priority: pr-title > pr-branch > pr-body > commit-message
 */
export function getMostRelevantReference(references: JiraIssueReference[]): JiraIssueReference {
  const priorityOrder = ["pr-title", "pr-branch", "pr-body", "commit-message"];

  for (const source of priorityOrder) {
    const found = references.find((ref) => ref.source === source);
    if (found) return found;
  }

  return references[0];
}

/**
 * Format a Jira reference for display
 */
export function formatJiraReference(ref: JiraIssueReference): string {
  switch (ref.source) {
    case "pr-title":
      return `${ref.issueKey} from PR #${ref.prNumber}: ${ref.prTitle}`;
    case "pr-branch":
      return `${ref.issueKey} from PR #${ref.prNumber} branch`;
    case "pr-body":
      return `${ref.issueKey} mentioned in PR #${ref.prNumber}`;
    case "commit-message":
      return `${ref.issueKey} from commit ${ref.commitSha?.substring(0, 7)}`;
    default:
      return ref.issueKey;
  }
}
