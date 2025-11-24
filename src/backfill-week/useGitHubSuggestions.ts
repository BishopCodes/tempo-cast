import { useState, useEffect } from "react";
import { format, subMonths } from "date-fns";
import { getAuthenticatedUser, getUserPRs, getUserCommits } from "../api/github";
import { extractJiraFromPR, extractJiraFromCommits, groupJiraReferences } from "../utils/github-jira-extractor";
import { hasPAT } from "../auth/github-oauth";
import { showLoading, showSuccess, handleError } from "../utils/error-handling";

enum GitHubTimePeriod {
  CurrentWeek = "currentWeek",
  LastMonth = "lastMonth",
  Last3Months = "last3Months",
}

export type GitHubTimePeriodString = `${GitHubTimePeriod}`;

export interface GitHubSuggestion {
  issueKey: string;
  references: any[];
  prCount: number;
  commitCount: number;
  mostRecentDate: string;
}

interface UseGitHubSuggestionsProps {
  enabled: boolean;
  weekStartDate: string;
}

export function useGitHubSuggestions({ enabled, weekStartDate }: UseGitHubSuggestionsProps) {
  const [suggestions, setSuggestions] = useState<GitHubSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [timePeriod, setTimePeriod] = useState<GitHubTimePeriodString>("lastMonth");

  useEffect(() => {
    (async () => {
      const auth = await hasPAT();
      setIsAuthorized(auth);
    })();
  }, []);

  const getStartDate = (): string => {
    switch (timePeriod) {
      case GitHubTimePeriod.CurrentWeek:
        return weekStartDate;
      case GitHubTimePeriod.LastMonth:
        return format(subMonths(new Date(), 1), "yyyy-MM-dd");
      case GitHubTimePeriod.Last3Months:
        return format(subMonths(new Date(), 3), "yyyy-MM-dd");
      default:
        return weekStartDate;
    }
  };

  const load = async () => {
    if (!enabled || !isAuthorized || !weekStartDate) return;

    try {
      setLoading(true);
      setIsVisible(true);

      await showLoading("Loading GitHub PRs...");

      const today = format(new Date(), "yyyy-MM-dd");
      const startDate = getStartDate();

      console.log(`[GitHub] Date range: ${startDate} to ${today}`);

      const user = await getAuthenticatedUser();
      console.log(`[GitHub] Fetching PRs for ${user.login}`);

      let prs: any[] = [];
      let commits: any[] = [];

      try {
        [prs, commits] = await Promise.all([
          getUserPRs(user.login, startDate, today),
          getUserCommits(user.login, startDate, today),
        ]);
      } catch (apiError) {
        console.error("[GitHub] API Error:", apiError);
        throw apiError;
      }

      console.log(`[GitHub] Found ${prs.length} PRs and ${commits.length} commits`);

      if (prs.length > 0) {
        console.log(
          `[GitHub] Sample PR titles:`,
          prs.slice(0, 3).map((pr: any) => pr.title),
        );
      }
      if (commits.length > 0) {
        console.log(
          `[GitHub] Sample commit messages:`,
          commits.slice(0, 3).map((c: any) => c.commit.message.split("\n")[0]),
        );
      }

      const prReferences = prs.flatMap(extractJiraFromPR);
      const commitReferences = extractJiraFromCommits(commits);
      console.log(
        `[GitHub] Extracted ${prReferences.length} PR references and ${commitReferences.length} commit references`,
      );

      if (prReferences.length > 0) {
        console.log(
          `[GitHub] Sample PR references:`,
          prReferences.slice(0, 3).map((ref: any) => ref.issueKey),
        );
      }
      if (commitReferences.length > 0) {
        console.log(
          `[GitHub] Sample commit references:`,
          commitReferences.slice(0, 3).map((ref: any) => ref.issueKey),
        );
      }

      const allReferences = [...prReferences, ...commitReferences];
      const grouped = groupJiraReferences(allReferences);
      console.log(`[GitHub] Grouped into ${grouped.size} unique Jira issues`);

      const suggestionsList: GitHubSuggestion[] = [];

      grouped.forEach((refs, issueKey) => {
        const prRefs = refs.filter((r: any) => r.prNumber !== undefined);
        const commitRefs = refs.filter((r: any) => r.commitSha !== undefined);

        const dates = refs.map((r: any) => r.date).filter((d: any): d is string => d !== undefined);
        const mostRecentDate = dates.sort().reverse()[0] || "";

        suggestionsList.push({
          issueKey,
          references: refs,
          prCount: new Set(prRefs.map((r: any) => r.prNumber)).size,
          commitCount: commitRefs.length,
          mostRecentDate,
        });
      });

      suggestionsList.sort((a, b) => b.mostRecentDate.localeCompare(a.mostRecentDate));

      setSuggestions(suggestionsList);

      const periodLabel = getTimePeriodLabel(timePeriod);

      await showSuccess("GitHub Suggestions Ready", `Found ${suggestionsList.length} issues from ${periodLabel}`);

      if (suggestionsList.length === 0) {
        const debugInfo = `Searched ${prs.length} PRs and ${commits.length} commits. Found ${prReferences.length + commitReferences.length} Jira references total.`;
        console.log(`[GitHub] Debug: ${debugInfo}`);
        await showSuccess("No Issues Found", debugInfo);
      }
    } catch (e) {
      console.error("[GitHub Suggestions] Error:", e);
      await handleError(e, "Failed to load GitHub suggestions");
      setIsVisible(false);
    } finally {
      setLoading(false);
    }
  };

  return {
    suggestions,
    loading,
    isVisible,
    isAuthorized,
    timePeriod,
    setTimePeriod,
    setIsVisible,
    load,
  };
}

function getTimePeriodLabel(period: GitHubTimePeriodString): string {
  switch (period) {
    case "currentWeek":
      return "current week";
    case "lastMonth":
      return "last month";
    case "last3Months":
      return "last 3 months";
    default:
      return "unknown period";
  }
}

export { GitHubTimePeriod };
