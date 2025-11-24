import { Form, ActionPanel, Action, Icon, Detail, useNavigation } from "@raycast/api";
import { useState, useEffect } from "react";
import {
  parseTimeEntry,
  formatParsedEntry,
  validateParsedEntry,
  type ParsedTimeEntry,
} from "./utils/natural-language-parser";
import { getIssueIdFromKey, getIssue } from "./api/jira";
import { createWorklog } from "./api/tempo";
import { formatDuration } from "./utils/time-formatting";
import { useWorkTypes } from "./hooks/useWorkTypes";
import { handleError, showLoading, showSuccess } from "./utils/error-handling";

export default function QuickLogTime() {
  const [input, setInput] = useState("");
  const [parsed, setParsed] = useState<ParsedTimeEntry | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [issueSummary, setIssueSummary] = useState<string>("");
  const [selectedWorkType, setSelectedWorkType] = useState<string>("");
  const { workTypes, loading: loadingWorkTypes } = useWorkTypes();
  const { push } = useNavigation();

  useEffect(() => {
    if (workTypes.length > 0 && !selectedWorkType) {
      setSelectedWorkType(workTypes[0].value);
    }
  }, [workTypes, selectedWorkType]);

  useEffect(() => {
    let mounted = true;

    const processInput = async () => {
      const result = parseTimeEntry(input);
      setParsed(result);

      const error = validateParsedEntry(result);
      setValidationError(error);

      if (result && !error) {
        try {
          const issue = await getIssue(result.issueKey);
          if (mounted) {
            setIssueSummary(issue.fields.summary);
          }
        } catch {
          if (mounted) {
            setIssueSummary("(Issue not found)");
          }
        }
      } else {
        setIssueSummary("");
      }
    };

    processInput();

    return () => {
      mounted = false;
    };
  }, [input]);

  async function handleSubmit() {
    if (!parsed || validationError) {
      await handleError(new Error(validationError || "Could not parse input"), "Invalid Input");
      return;
    }

    if (!selectedWorkType) {
      await handleError(new Error("Please select a work type"), "Work Type Required");
      return;
    }

    try {
      await showLoading("Logging time...");

      const issueId = await getIssueIdFromKey(parsed.issueKey);
      if (!issueId) {
        throw new Error("Issue not found");
      }

      const date = new Date().toISOString().substring(0, 10);
      const time = parsed.startTime || new Date().toTimeString().substring(0, 8);

      const worklog = await createWorklog({
        issueId,
        timeSpentSeconds: parsed.durationSeconds,
        startDate: date,
        startTime: time,
        description: parsed.description,
        workTypeValue: selectedWorkType,
      });

      await showSuccess("Time Logged!", `${formatDuration(parsed.durationSeconds)} to ${parsed.issueKey}`);

      push(
        <Detail
          markdown={`# ✅ Time Logged Successfully\n\n**Issue:** ${parsed.issueKey}\n**Duration:** ${formatDuration(parsed.durationSeconds)}\n**Time:** ${time}\n${parsed.description ? `**Description:** ${parsed.description}\n` : ""}\n**Worklog ID:** #${worklog.tempoWorklogId}`}
          actions={
            <ActionPanel>
              <Action.CopyToClipboard title="Copy Worklog ID" content={worklog.tempoWorklogId.toString()} />
            </ActionPanel>
          }
        />,
      );
    } catch (error) {
      await handleError(error, "Failed to Log Time");
    }
  }

  const examples = `**Examples:**
• ABC-123 2h working on feature
• ABC-123 1.5h @ 9am bug fix  
• ABC-123 30m code review
• ABC-123 2h30m @ 14:00 team meeting
• PROJ-456 45m @ 2pm documentation`;

  return (
    <Form
      isLoading={loadingWorkTypes}
      actions={
        <ActionPanel>
          <Action.SubmitForm title="Log Time" onSubmit={handleSubmit} icon={Icon.Clock} />
        </ActionPanel>
      }
    >
      <Form.Description title="Quick Log Time" text="Type naturally to log time quickly" />

      <Form.TextField
        id="input"
        title="Time Entry"
        placeholder="ABC-123 2h working on feature"
        value={input}
        onChange={setInput}
        autoFocus
      />

      {parsed && !validationError && (
        <>
          <Form.Description title="Parsed Entry" text={`✅ ${formatParsedEntry(parsed)}`} />
          {issueSummary && <Form.Description title="Issue Summary" text={issueSummary} />}
        </>
      )}

      {validationError && <Form.Description title="Error" text={`❌ ${validationError}`} />}

      <Form.Dropdown id="workType" title="Work Type" value={selectedWorkType} onChange={setSelectedWorkType}>
        {workTypes.map((type) => (
          <Form.Dropdown.Item key={type.value} value={type.value} title={type.label} />
        ))}
      </Form.Dropdown>

      <Form.Separator />

      <Form.Description text={examples} />
    </Form>
  );
}
