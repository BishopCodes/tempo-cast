import { Action, ActionPanel, Icon, List } from "@raycast/api";
import { useEffect, useState } from "react";
import { getMyWorklogs } from "./api/tempo";
import { tempoDayUrl, tempoWeekUrl } from "./utils/tempo";
import { TempoWorklog } from "./types";
import { formatDurationDetailed, formatTimeOfDay } from "./utils/time-formatting";
import { handleError } from "./utils/error-handling";

export default function Command() {
  const [items, setItems] = useState<TempoWorklog[]>([]);
  const [loading, setLoading] = useState(true);
  const today = new Date().toISOString().substring(0, 10);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      try {
        const wl = await getMyWorklogs(today, today);
        if (mounted) {
          setItems(wl);
        }
      } catch (error) {
        if (mounted) {
          await handleError(error, "Failed to load worklogs");
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    load();

    return () => {
      mounted = false;
    };
  }, [today]);

  const totalSeconds = items.reduce((acc, w) => acc + (w.timeSpentSeconds || 0), 0);
  const totalFormatted = formatDurationDetailed(totalSeconds);

  return (
    <List isLoading={loading} searchBarPlaceholder="Tempo worklogs for today">
      <List.Section
        title="Today's Work Logs"
        subtitle={items.length > 0 ? `Total: ${totalFormatted}` : "No work logged"}
      >
        {items.map((w) => {
          const dateForUrl = (w?.startDate as string) || today;
          const logFormatted = formatDurationDetailed(w.timeSpentSeconds);
          const timeOfDay = formatTimeOfDay(w.startTime);
          return (
            <List.Item
              key={w.tempoWorklogId}
              icon={Icon.Checkmark}
              title={w.issue?.key ? w.issue.key : `Issue ${w.issue?.id}`}
              subtitle={w.description || "No description"}
              accessories={[{ text: logFormatted }, { text: timeOfDay ? `@ ${timeOfDay}` : "" }]}
              actions={
                <ActionPanel>
                  <Action.OpenInBrowser
                    title="Open Tempo Day View"
                    url={tempoDayUrl(dateForUrl)}
                    icon={Icon.Calendar}
                  />
                  <Action.OpenInBrowser title="Open Tempo Week View" url={tempoWeekUrl()} icon={Icon.Globe} />
                </ActionPanel>
              }
            />
          );
        })}
      </List.Section>
    </List>
  );
}
