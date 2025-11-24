import { List, Action, ActionPanel, Icon, getPreferenceValues, Form, Color } from "@raycast/api";
import { useEffect, useMemo, useState } from "react";
import { addDays, startOfWeek, format, parseISO, subWeeks } from "date-fns";
import { createWorklog, getMyWorklogs } from "./api/tempo";
import { getIssueIdFromKey } from "./api/jira";
import { TempoWorklog } from "./types";
import { formatDuration, formatDurationDetailed, formatTimeOfDay } from "./utils/time-formatting";
import { handleError, showSuccess, showLoading } from "./utils/error-handling";
import { getIssueKeyError } from "./utils/validation";
import { useWorkTypes } from "./hooks/useWorkTypes";
import { useTimeline } from "./hooks/useTimeline";
import { useGitHubPRs } from "./hooks/useGitHubPRs";
import {
  TimeEntryFields,
  parseDurationFromValues,
  parseStartTimeFromValues,
  type DurationValues,
  type StartTimeValues,
} from "./components/TimeEntryFields";
import { useJqlIssuePicker } from "./hooks/useJqlIssuePicker";
import { analyzeWorklogPatterns, WorklogPattern } from "./ai/pattern-analyzer";

enum TimePeriod {
  Last = "last",
  This = "this",
  TwoWeeksAgo = "twoWeeksAgo",
}

type TimePeriodString = `${TimePeriod}`;

export default function BackfillWeek() {
  const prefs = getPreferenceValues<{
    backfillDefaultWeek?: TimePeriodString;
    aiProvider?: string;
    aiLookbackWeeks?: string;
    enableGitHubPRs?: boolean;
  }>();
  const [weekOffset, setWeekOffset] = useState<TimePeriodString>(prefs.backfillDefaultWeek || "twoWeeksAgo");
  const [days, setDays] = useState<{ date: string }[]>([]);
  const [weekLogs, setWeekLogs] = useState<Map<string, TempoWorklog[]>>(new Map());
  const [loading, setLoading] = useState(true);
  const [aiSuggestions, setAiSuggestions] = useState<WorklogPattern[]>([]);
  const [, setLoadingSuggestions] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [showGitHubSuggestions, setShowGitHubSuggestions] = useState(true);
  const aiEnabled = prefs.aiProvider === "github" || prefs.aiProvider === "ollama";
  const githubEnabled = prefs.enableGitHubPRs !== false;

  const fromDate = days.length > 0 ? days[0].date : "";
  const toDate = days.length > 0 ? days[days.length - 1].date : "";

  const {
    suggestions: githubSuggestions,
    loading: loadingGitHub,
    authorized: githubAuthorized,
  } = useGitHubPRs(fromDate, toDate, githubEnabled && showGitHubSuggestions && days.length > 0);

  useEffect(() => {
    const base = new Date();
    if (weekOffset === TimePeriod.Last) {
      base.setDate(base.getDate() - 7);
    } else if (weekOffset === TimePeriod.TwoWeeksAgo) {
      base.setDate(base.getDate() - 14);
    }
    const from = startOfWeek(base, { weekStartsOn: 1 });
    const arr: { date: string }[] = [];
    for (let i = 0; i < 7; i++) {
      const d = addDays(from, i);
      arr.push({ date: d.toISOString().substring(0, 10) });
    }
    setDays(arr);
  }, [weekOffset]);

  useEffect(() => {
    if (days.length === 0) return;
    (async () => {
      try {
        setLoading(true);
        const fromDate = days[0].date;
        const toDate = days[days.length - 1].date;
        const allLogs = await getMyWorklogs(fromDate, toDate);

        const logsByDate = new Map<string, TempoWorklog[]>();
        allLogs.forEach((log) => {
          const existing = logsByDate.get(log.startDate) || [];
          existing.push(log);
          logsByDate.set(log.startDate, existing);
        });

        setWeekLogs(logsByDate);
      } catch (e) {
        await handleError(e, "Failed to load logs");
      } finally {
        setLoading(false);
      }
    })();
  }, [days]);

  const header = useMemo(() => (weekOffset === "last" ? "Last Week" : "This Week"), [weekOffset]);

  const totalWeekSeconds = useMemo(() => {
    let total = 0;
    weekLogs.forEach((logs) => {
      logs.forEach((log) => {
        total += log.timeSpentSeconds || 0;
      });
    });
    return total;
  }, [weekLogs]);

  const totalWeekFormatted = formatDurationDetailed(totalWeekSeconds);

  const refreshLogs = async () => {
    if (days.length === 0) return;
    try {
      setLoading(true);
      const fromDate = days[0].date;
      const toDate = days[days.length - 1].date;
      const allLogs = await getMyWorklogs(fromDate, toDate);

      const logsByDate = new Map<string, TempoWorklog[]>();
      allLogs.forEach((log) => {
        const existing = logsByDate.get(log.startDate) || [];
        existing.push(log);
        logsByDate.set(log.startDate, existing);
      });

      setWeekLogs(logsByDate);
      await showSuccess("Logs refreshed");
    } catch (e) {
      await handleError(e, "Failed to refresh logs");
    } finally {
      setLoading(false);
    }
  };

  const loadAiSuggestions = async () => {
    if (!aiEnabled || days.length === 0) return;

    try {
      setLoadingSuggestions(true);
      setShowSuggestions(true);

      await showLoading("Analyzing patterns...");

      const targetWeekStart = days[0].date;
      const lookbackWeeks = parseInt(prefs.aiLookbackWeeks || "4", 10);

      let lastLoggedWeekStart = "";
      let weeksChecked = 0;

      for (let i = 1; i <= lookbackWeeks * 2; i++) {
        const weekStart = format(subWeeks(new Date(targetWeekStart), i), "yyyy-MM-dd");
        const weekEnd = format(addDays(new Date(weekStart), 6), "yyyy-MM-dd");
        const logs = await getMyWorklogs(weekStart, weekEnd);

        if (logs.length > 0) {
          lastLoggedWeekStart = weekStart;
          weeksChecked = i;
          break;
        }
      }

      if (!lastLoggedWeekStart) {
        await handleError(
          new Error(`No worklogs found in the past ${lookbackWeeks * 2} weeks`),
          "No Recent Work Found",
        );
        setShowSuggestions(false);
        setLoadingSuggestions(false);
        return;
      }

      const pastWeeks: TempoWorklog[][] = [];

      for (let i = 0; i < lookbackWeeks; i++) {
        const weekStart = format(subWeeks(new Date(lastLoggedWeekStart), i), "yyyy-MM-dd");
        const weekEnd = format(addDays(new Date(weekStart), 6), "yyyy-MM-dd");
        const logs = await getMyWorklogs(weekStart, weekEnd);
        if (logs.length > 0) {
          pastWeeks.push(logs);
        }
      }

      const totalLogs = pastWeeks.reduce((sum, week) => sum + week.length, 0);

      if (pastWeeks.length === 0) {
        await handleError(new Error("Need at least some past work to analyze patterns"), "No Historical Data");
        setShowSuggestions(false);
        setLoadingSuggestions(false);
        return;
      }

      await showLoading("Running AI Analysis...", `Analyzing ${totalLogs} logs from ${pastWeeks.length} weeks`);

      const patterns = await analyzeWorklogPatterns(pastWeeks, targetWeekStart);

      if (patterns.length === 0) {
        await handleError(
          new Error(`Analyzed ${totalLogs} logs but found no patterns. Check console for details.`),
          "No Patterns Found",
        );
        setShowSuggestions(false);
        setLoadingSuggestions(false);
        return;
      }

      setAiSuggestions(patterns);

      const weeksAgoMessage = weeksChecked > 1 ? ` (${weeksChecked} weeks ago)` : "";
      await showSuccess(
        "AI Suggestions Ready",
        `Found ${patterns.length} likely tasks from past ${pastWeeks.length} weeks${weeksAgoMessage}`,
      );
    } catch (e) {
      console.error("[AI Suggestions] Error:", e);
      await handleError(e, "Failed to load suggestions");
      setShowSuggestions(false);
    } finally {
      setLoadingSuggestions(false);
    }
  };

  return (
    <List isLoading={loading || loadingGitHub} searchBarPlaceholder="View and manage your work logs">
      <List.Dropdown tooltip="Week" storeValue onChange={(v) => setWeekOffset(v as TimePeriodString)}>
        <List.Dropdown.Item title="This Week" value={TimePeriod.This} />
        <List.Dropdown.Item title="Last Week" value={TimePeriod.Last} />
        <List.Dropdown.Item title="Two Weeks Ago" value={TimePeriod.TwoWeeksAgo} />
      </List.Dropdown>

      {/* GitHub PR Suggestions Section */}
      {githubEnabled && showGitHubSuggestions && githubSuggestions.length > 0 && (
        <List.Section title="🔀 GitHub PR Issues" subtitle={`${githubSuggestions.length} Jira issues from your PRs`}>
          {githubSuggestions.map((suggestion) => {
            const mostRelevantRef = suggestion.references[0];
            const dateStr = suggestion.mostRecentDate ? format(parseISO(suggestion.mostRecentDate), "MMM d") : "";

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
                      title="Log Work for This Issue"
                      icon={Icon.Plus}
                      target={
                        <LogWorkForm
                          date={days[0].date}
                          onSuccess={refreshLogs}
                          prefilledIssueKey={suggestion.issueKey}
                        />
                      }
                    />
                    {mostRelevantRef.prUrl && (
                      <Action.OpenInBrowser title="Open Pr in Browser" url={mostRelevantRef.prUrl} icon={Icon.Globe} />
                    )}
                    <Action.CopyToClipboard
                      title="Copy Issue Key"
                      content={suggestion.issueKey}
                      icon={Icon.Clipboard}
                    />
                    <Action
                      title="Hide GitHub Suggestions"
                      icon={Icon.EyeDisabled}
                      onAction={() => setShowGitHubSuggestions(false)}
                      shortcut={{ modifiers: ["cmd"], key: "h" }}
                    />
                  </ActionPanel>
                }
              />
            );
          })}
        </List.Section>
      )}

      {/* AI Suggestions Section */}
      {aiEnabled && showSuggestions && aiSuggestions.length > 0 && (
        <List.Section title="🤖 AI Suggested Tasks" subtitle={`Based on past ${prefs.aiLookbackWeeks || "4"} weeks`}>
          {aiSuggestions.map((suggestion) => (
            <List.Item
              key={suggestion.issueKey}
              icon={Icon.Stars}
              title={suggestion.issueKey}
              subtitle={suggestion.summary}
              accessories={[
                { text: formatDurationDetailed(suggestion.typicalDuration) },
                {
                  tag: {
                    value: suggestion.confidence.toUpperCase(),
                    color:
                      suggestion.confidence === "high"
                        ? Color.Green
                        : suggestion.confidence === "medium"
                          ? Color.Orange
                          : Color.Yellow,
                  },
                },
              ]}
              actions={
                <ActionPanel>
                  <Action.Push
                    title="Log Work with This Issue"
                    icon={Icon.Plus}
                    target={
                      <LogWorkForm
                        date={days[0].date}
                        onSuccess={refreshLogs}
                        prefilledIssueKey={suggestion.issueKey}
                      />
                    }
                  />
                  <Action.CopyToClipboard title="Copy Issue Key" content={suggestion.issueKey} icon={Icon.Clipboard} />
                  <Action
                    title="Hide AI Suggestions"
                    icon={Icon.EyeDisabled}
                    onAction={() => setShowSuggestions(false)}
                    shortcut={{ modifiers: ["cmd", "shift"], key: "h" }}
                  />
                </ActionPanel>
              }
            />
          ))}
        </List.Section>
      )}

      {days.map((d) => {
        const dayLogs = weekLogs.get(d.date) || [];
        const dayTotal = dayLogs.reduce((acc, log) => acc + (log.timeSpentSeconds || 0), 0);
        const dayFormatted = formatDurationDetailed(dayTotal);
        const dayName = format(parseISO(d.date + "T12:00:00"), "EEEE, MMM d");

        return (
          <List.Section
            key={d.date}
            title={dayName}
            subtitle={dayLogs.length > 0 ? `${dayFormatted} logged` : "No work logged"}
          >
            {dayLogs.length === 0 ? (
              <List.Item
                title="No work logged"
                subtitle="Press Enter to add a work log"
                icon={Icon.Circle}
                accessories={[{ text: d.date }]}
                actions={
                  <ActionPanel>
                    <Action.Push
                      title="Add Work Log"
                      icon={Icon.Plus}
                      target={<LogWorkForm date={d.date} onSuccess={refreshLogs} />}
                    />
                    {githubEnabled && githubAuthorized && !showGitHubSuggestions && (
                      <Action
                        title="Show GitHub Pr Suggestions"
                        icon={Icon.CodeBlock}
                        onAction={() => setShowGitHubSuggestions(true)}
                        shortcut={{ modifiers: ["cmd"], key: "g" }}
                      />
                    )}
                    {aiEnabled && !showSuggestions && (
                      <Action
                        title="Show AI Suggestions"
                        icon={Icon.Stars}
                        onAction={loadAiSuggestions}
                        shortcut={{ modifiers: ["cmd"], key: "s" }}
                      />
                    )}
                    <Action title="Refresh Logs" icon={Icon.ArrowClockwise} onAction={refreshLogs} />
                  </ActionPanel>
                }
              />
            ) : (
              dayLogs.map((log, idx) => {
                const logFormatted = formatDurationDetailed(log.timeSpentSeconds);
                const timeOfDay = formatTimeOfDay(log.startTime);
                return (
                  <List.Item
                    key={`${log.tempoWorklogId}-${idx}`}
                    icon={Icon.Checkmark}
                    title={log.issue?.key || `Issue #${log.issue?.id}`}
                    subtitle={log.description || "No description"}
                    accessories={[{ text: logFormatted }, { text: timeOfDay ? `@ ${timeOfDay}` : "" }]}
                    actions={
                      <ActionPanel>
                        <Action.Push
                          title="Add Work Log"
                          icon={Icon.Plus}
                          target={<LogWorkForm date={d.date} onSuccess={refreshLogs} />}
                        />
                        <Action.Push title="View Day Detail" icon={Icon.Eye} target={<DayDetail date={d.date} />} />
                        {githubEnabled && githubAuthorized && !showGitHubSuggestions && (
                          <Action
                            title="Show GitHub Pr Suggestions"
                            icon={Icon.CodeBlock}
                            onAction={() => setShowGitHubSuggestions(true)}
                            shortcut={{ modifiers: ["cmd"], key: "g" }}
                          />
                        )}
                        {aiEnabled && !showSuggestions && (
                          <Action
                            title="Show AI Suggestions"
                            icon={Icon.Stars}
                            onAction={loadAiSuggestions}
                            shortcut={{ modifiers: ["cmd"], key: "s" }}
                          />
                        )}
                        <Action title="Refresh Logs" icon={Icon.ArrowClockwise} onAction={refreshLogs} />
                      </ActionPanel>
                    }
                  />
                );
              })
            )}
          </List.Section>
        );
      })}

      <List.Section title="Week Summary">
        <List.Item title={`Total for ${header}`} subtitle={`${totalWeekFormatted} logged`} icon={Icon.BarChart} />
      </List.Section>
    </List>
  );
}

function DayDetail({ date }: { date: string }) {
  const [logs, setLogs] = useState<TempoWorklog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const wl = await getMyWorklogs(date, date);
        setLogs(wl);
      } catch (e) {
        await handleError(e, "Failed to load logs");
      } finally {
        setLoading(false);
      }
    })();
  }, [date]);

  const totalSec = logs.reduce((acc, w) => acc + (w.timeSpentSeconds || 0), 0);
  const totalFormatted = formatDurationDetailed(totalSec);

  return (
    <List isLoading={loading} searchBarPlaceholder="Your work logs for this day">
      <List.Section
        title={`${format(new Date(date), "EEEE, MMM d, yyyy")}`}
        subtitle={`Total logged: ${totalFormatted}`}
      >
        {logs.length === 0 ? (
          <List.Item
            title="No work logged yet"
            subtitle="Press Enter to add a work log for this day"
            icon={Icon.Circle}
            actions={
              <ActionPanel>
                <Action.Push title="Add Work Log" icon={Icon.Plus} target={<LogWorkForm date={date} />} />
              </ActionPanel>
            }
          />
        ) : (
          logs.map((w) => {
            const logFormatted = formatDurationDetailed(w.timeSpentSeconds);
            const timeOfDay = formatTimeOfDay(w.startTime);
            return (
              <List.Item
                key={w.tempoWorklogId}
                icon={Icon.Checkmark}
                title={w.issue?.key || `Issue #${w.issue?.id}`}
                subtitle={w.description || "No description"}
                accessories={[{ text: logFormatted }, { text: timeOfDay ? `@ ${timeOfDay}` : "" }]}
                actions={
                  <ActionPanel>
                    <Action.Push title="Add Work Log" icon={Icon.Plus} target={<LogWorkForm date={date} />} />
                  </ActionPanel>
                }
              />
            );
          })
        )}
      </List.Section>
    </List>
  );
}

function LogWorkForm({
  date,
  onSuccess,
  prefilledIssueKey,
}: {
  date: string;
  onSuccess?: () => Promise<void>;
  prefilledIssueKey?: string;
}) {
  const {
    jqlQueries,
    selectedJql,
    setSelectedJql,
    issues,
    selectedIssue,
    setSelectedIssue,
    editingJql,
    jqlEditValue,
    setJqlEditValue,
    loadingIssues,
    previewCount,
    previewLoading,
    startEdit,
    saveEdit,
    cancelEdit,
    persistLastIssue,
  } = useJqlIssuePicker();

  const [manualIssue, setManualIssue] = useState(prefilledIssueKey || "");
  const [plannedSeconds, setPlannedSeconds] = useState(1800);
  const [plannedStart, setPlannedStart] = useState<string>("09:00:00");

  const { workTypes, loading } = useWorkTypes();
  const {
    timeline,
    conflictSummary,
    loading: loadingTimeline,
  } = useTimeline({
    date,
    plannedDuration: plannedSeconds,
    plannedStart,
    issueKey: selectedIssue || manualIssue.trim() || "(Select issue)",
  });

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

      let issueId: string;
      let issueKey: string;

      if (manualIssue.trim()) {
        const error = getIssueKeyError(manualIssue.trim());
        if (error) throw new Error(error);
        issueId = await getIssueIdFromKey(manualIssue.trim());
        if (!issueId) throw new Error("Issue not found.");
        issueKey = manualIssue.trim();
      } else if (selectedIssue) {
        issueId = await getIssueIdFromKey(selectedIssue);
        issueKey = selectedIssue;
        await persistLastIssue(issueKey);
      } else {
        throw new Error("Please select or enter a valid issue key.");
      }

      await showLoading("Logging…");

      const seconds = parseDurationFromValues(values);

      if (seconds === 0) {
        throw new Error("Duration must be greater than 0");
      }

      const startTime = parseStartTimeFromValues(values);

      await createWorklog({
        issueId,
        timeSpentSeconds: seconds,
        startDate: date,
        startTime: startTime,
        description: values.description,
        workTypeValue: values.workType,
      });

      const displayDuration = formatDuration(seconds);
      await showSuccess(`Logged ${displayDuration} to ${issueKey}`);

      if (onSuccess) {
        await onSuccess();
      }
    } catch (e) {
      await handleError(e, "Failed to log");
    }
  }

  const handleEditAction = async () => {
    if (editingJql) {
      try {
        await saveEdit();
        await showSuccess("JQL updated");
      } catch (e) {
        await handleError(e, "Failed to save");
        return;
      }
    } else {
      startEdit();
    }
  };

  const manualIssueError = manualIssue.trim() ? getIssueKeyError(manualIssue.trim()) : null;

  return (
    <Form
      isLoading={loading || loadingIssues || loadingTimeline}
      actions={
        <ActionPanel>
          <Action.SubmitForm title="Log Work" onSubmit={onSubmit} />
          <Action title={editingJql ? "Save Jql Edit" : "Edit Selected Jql"} onAction={handleEditAction} />
          {editingJql && <Action title="Cancel Jql Edit" onAction={cancelEdit} />}
          <Action
            title="Open Manage Queries"
            onAction={async () => {
              const { launchCommand, LaunchType } = await import("@raycast/api");
              await launchCommand({ name: "manage-queries", type: LaunchType.UserInitiated });
            }}
          />
        </ActionPanel>
      }
    >
      <Form.Description
        title="Log Work to Jira/Tempo"
        text={`Adding work log for ${format(parseISO(date + "T12:00:00"), "EEEE, MMM d, yyyy")} (${date})`}
      />
      {prefilledIssueKey && (
        <Form.Description
          title="✨ From GitHub PR"
          text={`Issue ${prefilledIssueKey} was found in your GitHub PRs/commits. You can change it below if needed.`}
        />
      )}
      <Form.Separator />
      <Form.Description text="Select a saved JQL query. To add, edit, or remove queries, use the Manage Queries command." />
      <Form.Dropdown
        id="jql"
        title="JQL Query"
        value={selectedJql}
        onChange={(v) => {
          setSelectedJql(v);
          setSelectedIssue("");
        }}
      >
        {jqlQueries.map((q) => (
          <Form.Dropdown.Item key={q.value} value={q.value} title={q.title + (q.isDefault ? " (Default)" : "")} />
        ))}
      </Form.Dropdown>
      {editingJql ? (
        <Form.TextArea
          id="jqlEdit"
          title={`Edit Selected JQL${previewLoading ? " (Loading preview...)" : previewCount !== null ? ` (Matches: ${previewCount})` : ""}`}
          value={jqlEditValue}
          onChange={setJqlEditValue}
        />
      ) : null}
      <Form.Dropdown id="issueKey" title="Issue" value={selectedIssue} onChange={setSelectedIssue} storeValue>
        {issues.map((i) => (
          <Form.Dropdown.Item key={i.key} value={i.key} title={`${i.key} — ${i.summary}`} />
        ))}
      </Form.Dropdown>
      <Form.TextField
        id="manualIssue"
        title="Or enter issue key manually"
        value={manualIssue}
        onChange={setManualIssue}
        placeholder="e.g. ABC-123"
        error={manualIssueError || undefined}
      />

      <Form.Dropdown id="workType" title="Work Type" storeValue>
        {workTypes.map((t) => (
          <Form.Dropdown.Item key={t.value} value={t.value} title={t.label} />
        ))}
      </Form.Dropdown>

      <TimeEntryFields
        showDuration
        showStartTime
        onDurationChange={(secs) => setPlannedSeconds(secs)}
        onStartTimeChange={(t) => setPlannedStart(t)}
      />

      <Form.Separator />

      {timeline && <Form.Description title="Day Timeline" text={timeline} />}
      {conflictSummary && <Form.Description title="" text={conflictSummary} />}

      <Form.Separator />
      <Form.TextArea id="description" title="Description" placeholder="What did you work on?" />
    </Form>
  );
}
