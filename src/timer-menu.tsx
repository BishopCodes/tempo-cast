import { MenuBarExtra, Icon, LaunchType, launchCommand, open, getPreferenceValues } from "@raycast/api";
import { useEffect, useState } from "react";
import React from "react";
import { getActiveTimer, type TimerEntry } from "./state/timer";
import { formatDuration } from "./utils/time-formatting";

const lastNotificationAt: { [key: string]: number } = {};

interface Preferences {
  timerNotifyAt?: string;
}

export default function Command() {
  const [timer, setTimer] = useState<TimerEntry | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [loading, setLoading] = useState(true);
  const prefs = getPreferenceValues<Preferences>();

  const notifyAtHours = (prefs.timerNotifyAt || "1,4,8")
    .split(",")
    .map((h) => parseFloat(h.trim()))
    .filter((h) => !isNaN(h) && h > 0);

  useEffect(() => {
    const checkTimer = async () => {
      const activeTimer = await getActiveTimer();
      setTimer(activeTimer);
      setLoading(false);
    };

    checkTimer();
    const refreshInterval = setInterval(checkTimer, 5000);
    return () => clearInterval(refreshInterval);
  }, []);

  useEffect(() => {
    if (!timer) {
      setElapsed(0);
      return;
    }

    const updateElapsed = () => {
      const start = new Date(timer.start).getTime();
      const diff = Math.floor((Date.now() - start) / 1000);
      setElapsed(diff);
    };

    updateElapsed();
    const interval = setInterval(updateElapsed, 1000);
    return () => clearInterval(interval);
  }, [timer]);

  useEffect(() => {
    if (!timer || elapsed === 0) return;

    const hours = elapsed / 3600;

    for (const notifyHour of notifyAtHours) {
      if (hours >= notifyHour) {
        const notifyKey = `${timer.issueKey}-${notifyHour}`;
        const lastNotified = lastNotificationAt[notifyKey] || 0;
        const now = Date.now();

        if (now - lastNotified > 60000) {
          lastNotificationAt[notifyKey] = now;

          new Notification("⏱ Timer Running Long", {
            body: `${timer.issueKey} has been running for ${formatDuration(elapsed)}. Don't forget to stop it!`,
            silent: false,
          });
        }
      }
    }
  }, [elapsed, timer, notifyAtHours]);

  const formattedDuration = elapsed > 0 ? formatDuration(elapsed) : "0m";
  const hours = elapsed / 3600;

  if (!timer) {
    return null;
  }

  let iconColor = "#22C55E";
  let statusEmoji = "🟢";
  let statusText = "Active";

  if (hours >= 8) {
    iconColor = "#DC2626";
    statusEmoji = "🔴";
    statusText = "⚠️ VERY LONG";
  } else if (hours >= 4) {
    iconColor = "#F59E0B";
    statusEmoji = "🟠";
    statusText = "⚠️ Long";
  } else if (hours >= 2) {
    iconColor = "#EAB308";
    statusEmoji = "🟡";
    statusText = "Getting long";
  }

  const title = `⏱ ${formattedDuration}`;
  const tooltip = `Active Timer: ${timer.issueKey}
Elapsed: ${formattedDuration}
Status: ${statusText}
${timer.description ? `Description: ${timer.description}` : ""}

Click to stop timer`;

  return (
    <MenuBarExtra
      icon={{ source: Icon.Clock, tintColor: iconColor }}
      title={title}
      tooltip={tooltip}
      isLoading={loading}
    >
      <MenuBarExtra.Item
        title={`${statusEmoji} ${timer.issueKey} - ${formattedDuration}`}
        subtitle={statusText}
        icon={Icon.Circle}
      />
      {timer.description && <MenuBarExtra.Item title={timer.description} icon={Icon.Text} />}

      {hours >= 2 && (
        <MenuBarExtra.Item title={`⚠️ Timer has been running for ${formattedDuration}`} icon={Icon.ExclamationMark} />
      )}

      <MenuBarExtra.Section>
        <MenuBarExtra.Item
          title="Stop & Log Time"
          icon={Icon.Stop}
          shortcut={{ modifiers: ["cmd"], key: "s" }}
          onAction={async () => {
            await launchCommand({ name: "stop-timer", type: LaunchType.UserInitiated });
          }}
        />
        <MenuBarExtra.Item
          title="View Worklogs"
          icon={Icon.List}
          onAction={async () => {
            await launchCommand({ name: "worklogs", type: LaunchType.UserInitiated });
          }}
        />
      </MenuBarExtra.Section>

      <MenuBarExtra.Item
        title="Start Different Timer"
        icon={Icon.Play}
        onAction={async () => {
          await launchCommand({ name: "start-timer", type: LaunchType.UserInitiated });
        }}
      />

      <MenuBarExtra.Section>
        <MenuBarExtra.Item
          title="Open Issue in Browser"
          icon={Icon.Globe}
          onAction={async () => {
            const { jiraBaseUrl } = getPreferenceValues<{ jiraBaseUrl: string }>();
            await open(`https://${jiraBaseUrl}/browse/${timer.issueKey}`);
          }}
        />
      </MenuBarExtra.Section>
    </MenuBarExtra>
  );
}
