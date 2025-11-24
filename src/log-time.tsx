import { Action, ActionPanel, Form, Icon } from "@raycast/api";
import { useState } from "react";
import { getIssueIdFromKey } from "./api/jira";
import { createWorklog } from "./api/tempo";
import { useJqlIssuePicker } from "./hooks/useJqlIssuePicker";
import { useWorkTypes } from "./hooks/useWorkTypes";
import { useTimeline } from "./hooks/useTimeline";
import { formatDuration } from "./utils/time-formatting";
import { handleError, showSuccess, showLoading } from "./utils/error-handling";
import { getIssueKeyError } from "./utils/validation";
import {
  parseDurationFromValues,
  parseStartTimeFromValues,
  TimeEntryFields,
  type DurationValues,
  type StartTimeValues,
} from "./components/TimeEntryFields";

export default function Command() {
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

  const [manualIssue, setManualIssue] = useState("");
  const [startDateTime, setStartDateTime] = useState<Date | null>(null);
  const [plannedDuration, setPlannedDuration] = useState(1800);
  const [plannedStart, setPlannedStart] = useState("09:00:00");

  const { workTypes, loading: loadingWorkTypes } = useWorkTypes();
  const {
    timeline,
    conflictSummary,
    loading: loadingTimeline,
  } = useTimeline({
    date: startDateTime ? startDateTime.toISOString().substring(0, 10) : new Date().toISOString().substring(0, 10),
    plannedDuration,
    plannedStart: startDateTime ? startDateTime.toTimeString().substring(0, 8) : plannedStart,
    issueKey: selectedIssue || manualIssue.trim() || "(Select issue)",
  });

  async function onSubmit(
    values: {
      description?: string;
      worklogType?: string;
    } & DurationValues &
      StartTimeValues,
  ) {
    try {
      if (!values.worklogType) {
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

      const date = startDateTime
        ? startDateTime.toISOString().substring(0, 10)
        : new Date().toISOString().substring(0, 10);
      const time = startDateTime ? startDateTime.toTimeString().substring(0, 8) : parseStartTimeFromValues(values);

      await showLoading("Creating worklog…");
      const secs = parseDurationFromValues(values);
      const wl = await createWorklog({
        issueId,
        timeSpentSeconds: secs,
        startDate: date,
        startTime: time,
        description: values.description,
        workTypeValue: values.worklogType,
      });

      const formattedDuration = formatDuration(secs);
      await showSuccess(`Logged ${formattedDuration} to ${issueKey}`, `Tempo worklog #${wl.tempoWorklogId}`);
    } catch (e) {
      await handleError(e, "Failed to log time");
    }
  }

  const manualIssueError = manualIssue.trim() ? getIssueKeyError(manualIssue.trim()) : null;

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

  return (
    <Form
      actions={
        <ActionPanel>
          <Action.SubmitForm title="Log Time in Tempo" onSubmit={onSubmit} icon={Icon.Clock} />
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
      isLoading={loadingWorkTypes || loadingIssues || loadingTimeline}
    >
      <Form.Description text="Select a saved JQL query. To add, edit, or remove queries, use the Manage Queries button." />
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
      <Form.Dropdown id="worklogType" title="Work Type" storeValue>
        {workTypes.map((t) => (
          <Form.Dropdown.Item key={t.value} value={t.value} title={t.label} />
        ))}
      </Form.Dropdown>

      <TimeEntryFields
        onDurationChange={(secs) => setPlannedDuration(secs)}
        onStartTimeChange={(time) => setPlannedStart(time)}
      />

      <Form.Separator />

      {timeline && <Form.Description title="Day Timeline" text={timeline} />}
      {conflictSummary && <Form.Description title="" text={conflictSummary} />}

      <Form.Separator />
      <Form.DatePicker
        id="startDateTime"
        title="Override Date & Time"
        value={startDateTime}
        onChange={setStartDateTime}
        info="Optional: Override the date and time. If set, this takes precedence over the start time fields above."
      />
      <Form.TextArea id="description" title="Description" placeholder="What did you do?" />
    </Form>
  );
}
