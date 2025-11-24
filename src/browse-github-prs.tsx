import { List, Action, ActionPanel, Icon, Color, getPreferenceValues, Form } from "@raycast/api";
import { useState, useEffect } from "react";
import { format, subMonths, parseISO } from "date-fns";
import { getAuthenticatedUser, getUserPRs, getUserCommits, checkTokenScopes } from "./api/github";
import { extractJiraFromPR, extractJiraFromCommits, groupJiraReferences } from "./utils/github-jira-extractor";
import { hasPAT } from "./auth/github-oauth";
import { handleError, showSuccess } from "./utils/error-handling";
import { createWorklog } from "./api/tempo";
import { getIssueIdFromKey } from "./api/jira";
import { useWorkTypes } from "./hooks/useWorkTypes";
import {
  TimeEntryFields,
  parseDurationFromValues,
  parseStartTimeFromValues,
  type DurationValues,
  type StartTimeValues,
} from "./components/TimeEntryFields";

enum TimePeriod {
  LastWeek = "lastWeek",
  LastMonth = "lastMonth",
  Last3Months = "last3Months",
  Last6Months = "last6Months",
}

type TimePeriodString = `${TimePeriod}`;

interface GitHubJiraSuggestion {
  issueKey: string;
  references: {
    prTitle?: string;
    prUrl?: string;
    prNumber?: number;
    commitMessage?: string;
    commitSha?: string;
    date?: string;
  }[];
  prCount: number;
  commitCount: number;
  mostRecentDate: string;
}

export default function BrowseGitHubPRs() {
  const prefs = getPreferenceValues<{ enableGitHubPRs?: boolean }>();
  const [timePeriod, setTimePeriod] = useState<TimePeriodString>(TimePeriod.LastMonth);
  const [suggestions, setSuggestions] = useState<GitHubJiraSuggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [debugInfo, setDebugInfo] = useState<string>("");

  useEffect(() => {
    (async () => {
      const auth = await hasPAT();
      setAuthorized(auth);
    })();
  }, []);

  useEffect(() => {
    if (!authorized) {
      setLoading(false);
      return;
    }

    (async () => {
      try {
        setLoading(true);

        const toDate = format(new Date(), "yyyy-MM-dd");
        let fromDate: string = format(subMonths(new Date(), 1), "yyyy-MM-dd");

        switch (timePeriod) {
          case TimePeriod.LastWeek:
            fromDate = format(subMonths(new Date(), 0.25), "yyyy-MM-dd");
            break;
          case TimePeriod.LastMonth:
            fromDate = format(subMonths(new Date(), 1), "yyyy-MM-dd");
            break;
          case TimePeriod.Last3Months:
            fromDate = format(subMonths(new Date(), 3), "yyyy-MM-dd");
            break;
          case TimePeriod.Last6Months:
            fromDate = format(subMonths(new Date(), 6), "yyyy-MM-dd");
            break;
        }

        const user = await getAuthenticatedUser();
        const scopes = await checkTokenScopes();
        console.log(`[Browse PRs] Fetching for user: ${user.login}, date range: ${fromDate} to ${toDate}`);
        console.log(`[Browse PRs] Token has scopes: ${scopes.join(", ") || "none"}`);

        // Set initial debug info
        setDebugInfo(`User: ${user.login} | Scopes: ${scopes.join(", ") || "none"} | Date: ${fromDate} to ${toDate}`);

        if (!scopes.includes("repo")) {
          console.warn(`[Browse PRs] WARNING: Token missing 'repo' scope! Please re-authorize.`);
          setDebugInfo(`⚠️ WARNING: Token missing 'repo' scope! User: ${user.login}`);
        }

        const [prs, commits] = await Promise.all([
          getUserPRs(user.login, fromDate, toDate),
          getUserCommits(user.login, fromDate, toDate),
        ]);

        console.log(`[Browse PRs] API returned ${prs.length} PRs and ${commits.length} commits`);

        // Update debug info with API results
        setDebugInfo(
          `User: ${user.login} | Scopes: ${scopes.join(", ") || "none"} | Found ${prs.length} PRs, ${commits.length} commits | Date: ${fromDate} to ${toDate}`,
        );

        if (prs.length === 0 && commits.length === 0) {
          console.log(`[Browse PRs] No data found, stopping here`);
          setSuggestions([]);
          setLoading(false);
          return;
        }

        const prReferences = prs.flatMap(extractJiraFromPR);
        const commitReferences = extractJiraFromCommits(commits);
        const allReferences = [...prReferences, ...commitReferences];

        console.log(`[Browse PRs] Extracted ${prReferences.length} PR refs and ${commitReferences.length} commit refs`);

        const grouped = groupJiraReferences(allReferences);

        console.log(`[Browse PRs] Grouped into ${grouped.size} unique issues`);

        const suggestionsList: GitHubJiraSuggestion[] = [];

        grouped.forEach((refs, issueKey) => {
          const prRefs = refs.filter((r) => r.prNumber !== undefined);
          const commitRefs = refs.filter((r) => r.commitSha !== undefined);

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

        suggestionsList.sort((a, b) => b.mostRecentDate.localeCompare(a.mostRecentDate));

        setSuggestions(suggestionsList);

        // Store final debug info
        setDebugInfo(
          `User: ${user.login} | Scopes: ${scopes.join(", ") || "none"} | Found ${prs.length} PRs, ${commits.length} commits → ${suggestionsList.length} Jira issues | Date: ${fromDate} to ${toDate}`,
        );
      } catch (e) {
        await handleError(e, "Failed to load GitHub PRs");
        setDebugInfo(`❌ Error: ${e instanceof Error ? e.message : String(e)}`);
      } finally {
        setLoading(false);
      }
    })();
  }, [timePeriod, authorized]);

  if (!prefs.enableGitHubPRs) {
    return (
      <List>
        <List.EmptyView
          title="GitHub PR Suggestions Disabled"
          description="Enable 'GitHub PR Suggestions' in extension preferences to use this feature."
          icon={Icon.CodeBlock}
        />
      </List>
    );
  }

  if (!authorized) {
    return (
      <List>
        <List.EmptyView
          title="GitHub Personal Access Token Required"
          description="Run 'Tempo: Authorize GitHub PAT' command to set your Personal Access Token with 'repo' scope."
          icon={Icon.Lock}
          actions={
            <ActionPanel>
              <Action
                title="Authorize GitHub PAT"
                icon={Icon.Lock}
                onAction={async () => {
                  const { launchCommand, LaunchType } = await import("@raycast/api");
                  await launchCommand({ name: "authorize-github-pat", type: LaunchType.UserInitiated });
                }}
              />
            </ActionPanel>
          }
        />
      </List>
    );
  }

  return (
    <List isLoading={loading} searchBarPlaceholder="Search Jira issues from your GitHub activity">
      <List.Dropdown tooltip="Time Period" value={timePeriod} onChange={(v) => setTimePeriod(v as TimePeriodString)}>
        <List.Dropdown.Item title="Last Week" value={TimePeriod.LastWeek} />
        <List.Dropdown.Item title="Last Month" value={TimePeriod.LastMonth} />
        <List.Dropdown.Item title="Last 3 Months" value={TimePeriod.Last3Months} />
        <List.Dropdown.Item title="Last 6 Months" value={TimePeriod.Last6Months} />
      </List.Dropdown>

      {suggestions.length === 0 && !loading && (
        <List.EmptyView
          title="No Jira Issues Found"
          description={
            `${debugInfo || "No Jira issue keys found in your GitHub PRs or commits for this time period."}\n\n` +
            `If you have PRs in organization repositories:\n` +
            `1. Visit GitHub Settings > Personal Access Tokens\n` +
            `2. Click "Configure SSO" next to your token\n` +
            `3. Authorize your organization(s)`
          }
          icon={Icon.CodeBlock}
          actions={
            <ActionPanel>
              <Action.OpenInBrowser
                title="Configure Token SSO Access"
                url="https://github.com/settings/tokens"
                icon={Icon.Lock}
              />
            </ActionPanel>
          }
        />
      )}

      {suggestions.map((suggestion) => {
        const mostRelevantRef = suggestion.references[0];
        const dateStr = suggestion.mostRecentDate ? format(parseISO(suggestion.mostRecentDate), "MMM d, yyyy") : "";

        return (
          <List.Item
            key={suggestion.issueKey}
            icon={Icon.CodeBlock}
            title={suggestion.issueKey}
            subtitle={mostRelevantRef.prTitle || mostRelevantRef.commitMessage?.split("\n")[0] || ""}
            accessories={[
              { text: dateStr },
              {
                tag: { value: `${suggestion.prCount} PR${suggestion.prCount !== 1 ? "s" : ""}`, color: Color.Blue },
              },
              {
                tag: {
                  value: `${suggestion.commitCount} commit${suggestion.commitCount !== 1 ? "s" : ""}`,
                  color: Color.Purple,
                },
              },
            ]}
            actions={
              <ActionPanel>
                <Action.Push
                  title="Log Time for This Issue"
                  icon={Icon.Plus}
                  target={<LogTimeForm issueKey={suggestion.issueKey} />}
                />
                {mostRelevantRef.prUrl && (
                  <Action.OpenInBrowser title="Open PR in Browser" url={mostRelevantRef.prUrl} icon={Icon.Globe} />
                )}
                <Action.CopyToClipboard
                  title="Copy Issue Key"
                  content={suggestion.issueKey}
                  icon={Icon.Clipboard}
                  shortcut={{ modifiers: ["cmd"], key: "c" }}
                />
                <Action.Push
                  title="View All References"
                  icon={Icon.List}
                  target={<ViewReferences issueKey={suggestion.issueKey} references={suggestion.references} />}
                  shortcut={{ modifiers: ["cmd"], key: "r" }}
                />
              </ActionPanel>
            }
          />
        );
      })}
    </List>
  );
}

function ViewReferences({
  issueKey,
  references,
}: {
  issueKey: string;
  references: GitHubJiraSuggestion["references"];
}) {
  return (
    <List navigationTitle={`${issueKey} - All References`} searchBarPlaceholder="Search PRs and commits">
      <List.Section title={`All PRs and Commits for ${issueKey}`}>
        {references.map((ref, idx) => {
          const isPR = ref.prNumber !== undefined;
          const title = isPR ? `PR #${ref.prNumber}: ${ref.prTitle}` : `Commit: ${ref.commitMessage?.split("\n")[0]}`;
          const subtitle = ref.date ? format(parseISO(ref.date), "MMM d, yyyy") : "";
          const tagValue = isPR ? "PR" : "Commit";
          const tagColor = isPR ? Color.Blue : Color.Purple;

          return (
            <List.Item
              key={idx}
              icon={isPR ? Icon.ArrowRightCircle : Icon.Dot}
              title={title}
              subtitle={subtitle}
              accessories={[{ tag: { value: tagValue, color: tagColor } }]}
              actions={
                <ActionPanel>
                  {ref.prUrl && <Action.OpenInBrowser title="Open in Browser" url={ref.prUrl} icon={Icon.Globe} />}
                  <Action.CopyToClipboard
                    title="Copy Issue Key"
                    content={issueKey}
                    icon={Icon.Clipboard}
                    shortcut={{ modifiers: ["cmd"], key: "c" }}
                  />
                </ActionPanel>
              }
            />
          );
        })}
      </List.Section>
    </List>
  );
}

function LogTimeForm({ issueKey }: { issueKey: string }) {
  const { workTypes, loading: loadingWorkTypes } = useWorkTypes();
  const [date, setDate] = useState(new Date());

  async function onSubmit(
    values: {
      description?: string;
      workType?: string;
    } & DurationValues &
      StartTimeValues,
  ) {
    try {
      if (!values.workType) {
        throw new Error("Work Type is required.");
      }

      const issueId = await getIssueIdFromKey(issueKey);
      if (!issueId) throw new Error("Issue not found.");

      const seconds = parseDurationFromValues(values);
      if (seconds === 0) {
        throw new Error("Duration must be greater than 0");
      }

      const startTime = parseStartTimeFromValues(values);
      const startDate = format(date, "yyyy-MM-dd");

      await createWorklog({
        issueId,
        timeSpentSeconds: seconds,
        startDate,
        startTime,
        description: values.description,
        workTypeValue: values.workType,
      });

      await showSuccess(`Logged time to ${issueKey}`);
    } catch (e) {
      await handleError(e, "Failed to log time");
    }
  }

  return (
    <Form
      isLoading={loadingWorkTypes}
      actions={
        <ActionPanel>
          <Action.SubmitForm title="Log Time" onSubmit={onSubmit} />
        </ActionPanel>
      }
    >
      <Form.Description
        title="Log Time from GitHub PR"
        text={`Logging time for ${issueKey} (found in your GitHub activity)`}
      />
      <Form.Separator />

      <Form.DatePicker id="date" title="Date" value={date} onChange={(newDate) => newDate && setDate(newDate)} />

      <Form.Dropdown id="workType" title="Work Type" storeValue>
        {workTypes.map((t) => (
          <Form.Dropdown.Item key={t.value} value={t.value} title={t.label} />
        ))}
      </Form.Dropdown>

      <TimeEntryFields showDuration showStartTime />

      <Form.Separator />
      <Form.TextArea id="description" title="Description" placeholder="What did you work on?" />
    </Form>
  );
}
