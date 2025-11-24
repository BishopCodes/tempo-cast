import { Action, ActionPanel, Detail, Icon } from "@raycast/api";
import { useEffect, useState } from "react";
import { startOfWeek, addDays, format } from "date-fns";
import { getMyWorklogs } from "./api/tempo";
import { summarizeWeek } from "./ai/provider";
import { DayWorklogs } from "./types";
import { getErrorMessage } from "./utils/error-handling";

export default function AiSummary() {
  const [text, setText] = useState("Generating AI summary...");
  const [ready, setReady] = useState(false);
  const [weekLabel, setWeekLabel] = useState("");

  useEffect(() => {
    let mounted = true;

    const generate = async () => {
      try {
        const now = new Date();
        const from = startOfWeek(now, { weekStartsOn: 0 });
        const to = addDays(from, 6);
        setWeekLabel(`${format(from, "MMM d")} - ${format(to, "MMM d, yyyy")} (Week ${format(now, "ww")})`);

        const days: DayWorklogs[] = [];
        for (let i = 0; i < 7; i++) {
          const d = addDays(from, i);
          const ds = d.toISOString().substring(0, 10);
          const items = await getMyWorklogs(ds, ds);
          days.push({ date: ds, items });
        }
        
        const s = await summarizeWeek(JSON.stringify(days));
        if (mounted) {
          setText(s);
        }
      } catch (error) {
        if (mounted) {
          const msg = getErrorMessage(error);
          setText("## ❌ Error\n\n" + msg);
        }
      } finally {
        if (mounted) {
          setReady(true);
        }
      }
    };

    generate();

    return () => {
      mounted = false;
    };
  }, []);

  const markdown = `# 📊 Weekly Summary

${weekLabel}

---

${text}`;

  return (
    <Detail
      isLoading={!ready}
      markdown={markdown}
      actions={
        <ActionPanel>
          <Action.CopyToClipboard
            title="Copy Summary"
            content={text}
            icon={Icon.Clipboard}
            shortcut={{ modifiers: ["cmd"], key: "c" }}
          />
          <Action.CopyToClipboard
            title="Copy with Header"
            content={markdown}
            icon={Icon.Document}
            shortcut={{ modifiers: ["cmd", "shift"], key: "c" }}
          />
        </ActionPanel>
      }
    />
  );
}
