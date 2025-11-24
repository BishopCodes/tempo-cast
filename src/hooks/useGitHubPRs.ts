import { useEffect, useState } from "react";
import { getAuthenticatedUser, getUserPRs, getUserCommits } from "../api/github";
import { extractJiraFromPR, extractJiraFromCommits, groupJiraReferences, JiraIssueReference } from "../utils/github-jira-extractor";
import { isAuthorized } from "../auth/github-oauth";

export interface GitHubJiraSuggestion {
  issueKey: string;
  references: JiraIssueReference[];
  prCount: number;
  commitCount: number;
  mostRecentDate: string;
}

export function useGitHubPRs(fromDate: string, toDate: string, enabled: boolean = true) {
  const [suggestions, setSuggestions] = useState<GitHubJiraSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [authorized, setAuthorized] = useState(false);

  useEffect(() => {
    (async () => {
      const auth = await isAuthorized();
      setAuthorized(auth);
    })();
  }, []);

  useEffect(() => {
    if (!enabled || !authorized) {
      setSuggestions([]);
      return;
    }

    (async () => {
      try {
        setLoading(true);
        setError(null);

        // Get authenticated user
        const user = await getAuthenticatedUser();
        
        // Fetch PRs and commits in parallel
        const [prs, commits] = await Promise.all([
          getUserPRs(user.login, fromDate, toDate),
          getUserCommits(user.login, fromDate, toDate),
        ]);

        // Extract Jira references
        const prReferences = prs.flatMap(extractJiraFromPR);
        const commitReferences = extractJiraFromCommits(commits);
        
        const allReferences = [...prReferences, ...commitReferences];
        const grouped = groupJiraReferences(allReferences);

        // Convert to suggestions
        const suggestionsList: GitHubJiraSuggestion[] = [];
        
        grouped.forEach((refs, issueKey) => {
          const prRefs = refs.filter((r) => r.prNumber !== undefined);
          const commitRefs = refs.filter((r) => r.commitSha !== undefined);
          
          // Get most recent date
          const dates = refs.map((r) => r.date).filter((d): d is string => d !== undefined);
          const mostRecentDate = dates.sort().reverse()[0] || "";

          suggestionsList.push({
            issueKey,
            references: refs,
            prCount: new Set(prRefs.map((r) => r.prNumber)).size,
            commitCount: commitRefs.length,
            mostRecentDate,
          });
        });

        // Sort by most recent first
        suggestionsList.sort((a, b) => b.mostRecentDate.localeCompare(a.mostRecentDate));

        setSuggestions(suggestionsList);
      } catch (e) {
        const message = e instanceof Error ? e.message : "Unknown error";
        setError(message);
        setSuggestions([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [fromDate, toDate, enabled, authorized]);

  return { suggestions, loading, error, authorized };
}
