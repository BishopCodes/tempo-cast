import { useState } from "react";
import { format, subWeeks, addDays } from "date-fns";
import { getMyWorklogs } from "../api/tempo";
import { analyzeWorklogPatterns, WorklogPattern } from "../ai/pattern-analyzer";
import { showLoading, showSuccess, handleError } from "../utils/error-handling";

interface UseAISuggestionsProps {
  enabled: boolean;
  weekStartDate: string;
  lookbackWeeks: number;
}

export function useAISuggestions({ enabled, weekStartDate, lookbackWeeks }: UseAISuggestionsProps) {
  const [suggestions, setSuggestions] = useState<WorklogPattern[]>([]);
  const [loading, setLoading] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  const findLastLoggedWeek = async (
    targetWeekStart: string,
    maxWeeks: number,
  ): Promise<{ weekStart: string; weeksChecked: number } | null> => {
    for (let i = 1; i <= maxWeeks; i++) {
      const weekStart = format(subWeeks(new Date(targetWeekStart), i), "yyyy-MM-dd");
      const weekEnd = format(addDays(new Date(weekStart), 6), "yyyy-MM-dd");
      const logs = await getMyWorklogs(weekStart, weekEnd);

      if (logs.length > 0) {
        return { weekStart, weeksChecked: i };
      }
    }
    return null;
  };

  const load = async () => {
    if (!enabled || !weekStartDate) return;

    try {
      setLoading(true);
      setIsVisible(true);

      await showLoading("Analyzing patterns...");

      const lastLogged = await findLastLoggedWeek(weekStartDate, lookbackWeeks * 2);

      if (!lastLogged) {
        await handleError(
          new Error(`No worklogs found in the past ${lookbackWeeks * 2} weeks`),
          "No Recent Work Found",
        );
        setIsVisible(false);
        setLoading(false);
        return;
      }

      const pastWeeks = await fetchPastWeeks(lastLogged.weekStart, lookbackWeeks);
      const totalLogs = pastWeeks.reduce((sum, week) => sum + week.length, 0);

      if (pastWeeks.length === 0) {
        await handleError(new Error("Need at least some past work to analyze patterns"), "No Historical Data");
        setIsVisible(false);
        setLoading(false);
        return;
      }

      await showLoading("Running AI Analysis...", `Analyzing ${totalLogs} logs from ${pastWeeks.length} weeks`);

      const patterns = await analyzeWorklogPatterns(pastWeeks, weekStartDate);

      if (patterns.length === 0) {
        await handleError(
          new Error(`Analyzed ${totalLogs} logs but found no patterns. Check console for details.`),
          "No Patterns Found",
        );
        setIsVisible(false);
        setLoading(false);
        return;
      }

      setSuggestions(patterns);

      const weeksAgoMessage = lastLogged.weeksChecked > 1 ? ` (${lastLogged.weeksChecked} weeks ago)` : "";
      await showSuccess(
        "AI Suggestions Ready",
        `Found ${patterns.length} likely tasks from past ${pastWeeks.length} weeks${weeksAgoMessage}`,
      );
    } catch (e) {
      console.error("[AI Suggestions] Error:", e);
      await handleError(e, "Failed to load suggestions");
      setIsVisible(false);
    } finally {
      setLoading(false);
    }
  };

  return {
    suggestions,
    loading,
    isVisible,
    setIsVisible,
    load,
  };
}

async function fetchPastWeeks(lastLoggedWeekStart: string, lookbackWeeks: number) {
  const pastWeeks = [];

  for (let i = 0; i < lookbackWeeks; i++) {
    const weekStart = format(subWeeks(new Date(lastLoggedWeekStart), i), "yyyy-MM-dd");
    const weekEnd = format(addDays(new Date(weekStart), 6), "yyyy-MM-dd");
    const logs = await getMyWorklogs(weekStart, weekEnd);
    if (logs.length > 0) {
      pastWeeks.push(logs);
    }
  }

  return pastWeeks;
}
