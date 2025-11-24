import { Detail, ActionPanel, Action, popToRoot } from "@raycast/api";
import { useCallback, useEffect, useState } from "react";
import { stopTimer, getActiveTimer, type TimerEntry } from "./state/timer";
import { createWorklog } from "./api/tempo";
import { formatDuration } from "./utils/time-formatting";
import { handleError, showSuccess } from "./utils/error-handling";

export default function ActiveTimer() {
  const [timer, setTimer] = useState<TimerEntry | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [isStopping, setIsStopping] = useState(false);
  const [markdown, setMarkdown] = useState<string>("# Loading Active Timer...\n\nLooking for an active timer.");

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      const active = await getActiveTimer();
      if (mounted) {
        setTimer(active);
        if (!active) {
          setMarkdown("# No Active Timer\n\nStart a timer first using Start Timer.");
          await handleError(new Error("No active timer"), "No Active Timer");
          setTimeout(() => popToRoot(), 1200);
        }
      }
    };

    load();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!timer || isStopping) return;

    const update = () => {
      const start = new Date(timer.start).getTime();
      setElapsed(Math.max(0, Math.floor((Date.now() - start) / 1000)));
    };
    
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [timer, isStopping]);

  useEffect(() => {
    if (!timer) return;

    const human = formatDuration(elapsed);
    setMarkdown(
      `# Active Timer\n\n` +
        `**Issue:** ${timer.issueKey}\n\n` +
        `**Elapsed:** ${elapsed}s (${human})\n\n` +
        `${timer.description ? `**Description:** ${timer.description}\n\n` : ""}` +
        `Press ⏎ (Enter) to Stop & Log Time.`,
    );
  }, [timer, elapsed]);

  const handleStop = useCallback(async () => {
    if (isStopping) return;
    
    setIsStopping(true);
    const stopped = await stopTimer();
    
    if (!stopped) {
      await handleError(new Error("No active timer"), "No Active Timer");
      setMarkdown("# No Active Timer\n\nNothing to stop.");
      setTimeout(() => popToRoot(), 1200);
      return;
    }

    const { entry, seconds } = stopped;

    const startDateTime = new Date(entry.start);
    const year = startDateTime.getFullYear();
    const month = String(startDateTime.getMonth() + 1).padStart(2, "0");
    const day = String(startDateTime.getDate()).padStart(2, "0");
    const startDate = `${year}-${month}-${day}`;
    
    const hours = String(startDateTime.getHours()).padStart(2, "0");
    const minutes = String(startDateTime.getMinutes()).padStart(2, "0");
    const seconds_time = String(startDateTime.getSeconds()).padStart(2, "0");
    const startTime = `${hours}:${minutes}:${seconds_time}`;

    const loggedSeconds = Math.max(60, seconds);
    const formattedDuration = formatDuration(loggedSeconds);

    try {
      setMarkdown(
        `# Logging Work...\n\n` +
          `**Issue:** ${entry.issueKey}\n\n` +
          `**Duration (rounded):** ${formattedDuration}\n\n` +
          `**Started:** ${startDate} ${startTime}\n\n` +
          `Please wait...`,
      );

      await createWorklog({
        issueId: entry.issueId,
        timeSpentSeconds: loggedSeconds,
        startDate,
        startTime,
        description: entry.description,
        workTypeValue: entry.workTypeValue,
      });

      setMarkdown(
        `# ✅ Work Logged\n\n` +
          `**Issue:** ${entry.issueKey}\n\n` +
          `**Time Logged:** ${formattedDuration}\n\n` +
          `**Started:** ${startDate} ${startTime}\n\n` +
          `${entry.description ? `**Description:** ${entry.description}\n\n` : ""}` +
          `Returning to menu...`,
      );
      
      await showSuccess(`Logged ${formattedDuration} to ${entry.issueKey}`);
    } catch (error) {
      setMarkdown(
        `# ❌ Failed to Log Work\n\n` +
          `**Issue:** ${entry.issueKey}\n\n` +
          `Please try again.`,
      );
      await handleError(error, "Failed to log");
    } finally {
      setTimeout(() => popToRoot(), 1500);
    }
  }, [isStopping]);

  return (
    <Detail
      isLoading={!timer && !isStopping}
      markdown={markdown}
      actions={
        timer && !isStopping ? (
          <ActionPanel>
            <Action title="Stop & Log Time" onAction={handleStop} />
          </ActionPanel>
        ) : undefined
      }
    />
  );
}
