import { Action, ActionPanel, Form, confirmAlert, Alert, Icon } from "@raycast/api";
import { useEffect, useState } from "react";
import { getIssueIdFromKey } from "./api/jira";
import { useJqlIssuePicker } from "./hooks/useJqlIssuePicker";
import { useWorkTypes } from "./hooks/useWorkTypes";
import { startTimer as start, getActiveTimer, stopTimer } from "./state/timer";
import { formatDuration } from "./utils/time-formatting";
import { createWorklog } from "./api/tempo";
import { handleError, showSuccess, showLoading } from "./utils/error-handling";
import { getIssueKeyError } from "./utils/validation";

export default function StartTimer() {
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

  const { workTypes, loading } = useWorkTypes();
  const [existingTimer, setExistingTimer] = useState<Awaited<ReturnType<typeof getActiveTimer>>>(null);
  const [manualIssue, setManualIssue] = useState("");

  function getJqlEditTitle(): string {
    if (previewLoading) {
      return "Edit Selected JQL (Loading preview...)";
    }
    if (previewCount !== null) {
      return `Edit Selected JQL (Matches: ${previewCount})`;
    }
    return "Edit Selected JQL";
  }

  useEffect(() => {
    (async () => {
      try {
        const activeTimer = await getActiveTimer();
        setExistingTimer(activeTimer);
      } catch (e) {
        console.error("Failed to get active timer:", e);
      }
    })();
  }, []);

  async function onSubmit(values: { issueKey?: string; description?: string; worklogType: string }) {
    try {
      const activeTimer = await getActiveTimer();

      if (activeTimer) {
        const start = new Date(activeTimer.start).getTime();
        const elapsed = Math.floor((Date.now() - start) / 1000);
        const formattedElapsed = formatDuration(elapsed);
        const hours = elapsed / 3600;

        let warningIcon = Icon.Clock;
        let warningMessage = `You have an active timer for ${activeTimer.issueKey} (${formattedElapsed} elapsed).`;

        if (hours >= 8) {
          warningIcon = Icon.ExclamationMark;
          warningMessage = `⚠️ WARNING: Timer for ${activeTimer.issueKey} has been running for ${formattedElapsed}!\n\nThis is unusually long - please verify this is correct.`;
        } else if (hours >= 4) {
          warningIcon = Icon.Important;
          warningMessage = `⚠️ NOTICE: Timer for ${activeTimer.issueKey} has been running for ${formattedElapsed}.\n\nThis is quite long - don't forget to stop it!`;
        } else if (hours >= 2) {
          warningIcon = Icon.Info;
          warningMessage = `Timer for ${activeTimer.issueKey} has been running for ${formattedElapsed}.`;
        }

        const confirmed = await confirmAlert({
          title: "Active Timer Running",
          message: `${warningMessage}\n\nDo you want to stop it and log the time before starting a new timer?`,
          icon: warningIcon,
          primaryAction: {
            title: "Stop & Log Time",
            style: Alert.ActionStyle.Default,
          },
          dismissAction: {
            title: "Cancel",
            style: Alert.ActionStyle.Cancel,
          },
        });

        if (!confirmed) {
          return;
        }

        await showLoading("Stopping existing timer...");

        const stopped = await stopTimer();
        if (stopped) {
          const { entry, seconds } = stopped;

          await createWorklog({
            issueId: entry.issueId,
            timeSpentSeconds: Math.max(60, seconds),
            startDate: new Date(entry.start).toISOString().substring(0, 10),
            startTime: new Date(entry.start).toTimeString().substring(0, 8),
            description: entry.description,
            workTypeValue: entry.workTypeValue,
          });

          const loggedDuration = formatDuration(Math.max(60, seconds));
          await showSuccess(`Logged ${loggedDuration} to ${entry.issueKey}`);
        }
      }

      let issueKey = selectedIssue || values.issueKey || "";

      if (manualIssue.trim()) {
        const error = getIssueKeyError(manualIssue.trim());
        if (error) throw new Error(error);
        issueKey = manualIssue.trim();
      }

      if (!issueKey) throw new Error("Issue is required");

      const issueId = await getIssueIdFromKey(issueKey);
      await start({
        issueKey,
        issueId,
        description: values.description,
        workTypeValue: values.worklogType,
      });

      if (!manualIssue.trim()) {
        await persistLastIssue(issueKey);
      }

      await showSuccess(`Timer started for ${issueKey}`);
    } catch (e) {
      await handleError(e, "Failed to start timer");
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
      actions={
        <ActionPanel>
          <Action.SubmitForm title="Start Timer" onSubmit={onSubmit} />
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
      isLoading={loading || loadingIssues}
    >
      {existingTimer && (
        <>
          <Form.Description
            title="🔴 ACTIVE TIMER RUNNING"
            text={`Timer for ${existingTimer.issueKey} is currently active!\n\nStarting a new timer will automatically stop and log the current one.`}
          />
          <Form.Separator />
        </>
      )}
      <Form.Description text="Select a saved JQL query. Manage them via the Manage Queries command." />
      <Form.Dropdown
        id="jql"
        title="JQL Query"
        value={selectedJql}
        onChange={(v) => {
          setSelectedJql(v);
          setSelectedIssue("");
        }}
        storeValue
      >
        {jqlQueries.map((q) => (
          <Form.Dropdown.Item key={q.value} value={q.value} title={q.title + (q.isDefault ? " (Default)" : "")} />
        ))}
      </Form.Dropdown>
      {editingJql ? (
        <Form.TextArea id="jqlEdit" title={getJqlEditTitle()} value={jqlEditValue} onChange={setJqlEditValue} />
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
      <Form.Dropdown id="worklogType" title="Work Type" storeValue>
        {workTypes.map((t) => (
          <Form.Dropdown.Item key={t.value} value={t.value} title={t.label} />
        ))}
      </Form.Dropdown>
      <Form.TextArea id="description" title="Description" placeholder="Optional description" />
    </Form>
  );
}
