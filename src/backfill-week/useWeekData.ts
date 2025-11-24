import { useState, useEffect, useMemo } from "react";
import { addDays, startOfWeek, subWeeks } from "date-fns";
import { getMyWorklogs } from "../api/tempo";
import { TempoWorklog } from "../types";
import { formatDurationDetailed } from "../utils/time-formatting";
import { handleError, showSuccess } from "../utils/error-handling";

export enum TimePeriod {
  Last = "last",
  This = "this",
  TwoWeeksAgo = "twoWeeksAgo",
}

export type TimePeriodString = `${TimePeriod}`;

interface WeekDay {
  date: string;
}

export interface UseWeekDataResult {
  days: WeekDay[];
  weekLogs: Map<string, TempoWorklog[]>;
  loading: boolean;
  header: string;
  totalWeekSeconds: number;
  totalWeekFormatted: string;
  refreshLogs: () => Promise<void>;
  fromDate: string;
  toDate: string;
}

const WEEK_OFFSET_WEEKS: Record<TimePeriodString, number> = {
  [TimePeriod.This]: 0,
  [TimePeriod.Last]: 1,
  [TimePeriod.TwoWeeksAgo]: 2,
};

function calculateWeekDays(weekOffset: TimePeriodString): WeekDay[] {
  const base = new Date();
  const weeksToSubtract = WEEK_OFFSET_WEEKS[weekOffset] || 0;
  const targetDate = subWeeks(base, weeksToSubtract);
  const from = startOfWeek(targetDate, { weekStartsOn: 1 });

  const days: WeekDay[] = [];
  for (let i = 0; i < 7; i++) {
    const d = addDays(from, i);
    days.push({ date: d.toISOString().substring(0, 10) });
  }
  return days;
}

function groupLogsByDate(logs: TempoWorklog[]): Map<string, TempoWorklog[]> {
  const logsByDate = new Map<string, TempoWorklog[]>();

  for (const log of logs) {
    const existing = logsByDate.get(log.startDate) || [];
    existing.push(log);
    logsByDate.set(log.startDate, existing);
  }

  return logsByDate;
}

function calculateTotalSeconds(weekLogs: Map<string, TempoWorklog[]>): number {
  let total = 0;

  weekLogs.forEach((logs) => {
    logs.forEach((log) => {
      total += log.timeSpentSeconds || 0;
    });
  });

  return total;
}

export function useWeekData(weekOffset: TimePeriodString): UseWeekDataResult {
  const [days, setDays] = useState<WeekDay[]>([]);
  const [weekLogs, setWeekLogs] = useState<Map<string, TempoWorklog[]>>(new Map());
  const [loading, setLoading] = useState(true);

  const fromDate = days.length > 0 ? days[0].date : "";
  const toDate = days.length > 0 ? days[days.length - 1].date : "";

  // Calculate week days when offset changes
  useEffect(() => {
    setDays(calculateWeekDays(weekOffset));
  }, [weekOffset]);

  // Load worklogs when days change
  useEffect(() => {
    if (days.length === 0) return;

    const loadLogs = async () => {
      try {
        setLoading(true);
        const allLogs = await getMyWorklogs(days[0].date, days[days.length - 1].date);
        setWeekLogs(groupLogsByDate(allLogs));
      } catch (e) {
        await handleError(e, "Failed to load logs");
      } finally {
        setLoading(false);
      }
    };

    loadLogs();
  }, [days]);

  const header = useMemo(() => (weekOffset === "last" ? "Last Week" : "This Week"), [weekOffset]);

  const totalWeekSeconds = useMemo(() => calculateTotalSeconds(weekLogs), [weekLogs]);

  const totalWeekFormatted = formatDurationDetailed(totalWeekSeconds);

  const refreshLogs = async () => {
    if (days.length === 0) return;

    try {
      setLoading(true);
      const allLogs = await getMyWorklogs(days[0].date, days[days.length - 1].date);
      setWeekLogs(groupLogsByDate(allLogs));
      await showSuccess("Logs refreshed");
    } catch (e) {
      await handleError(e, "Failed to refresh logs");
    } finally {
      setLoading(false);
    }
  };

  return {
    days,
    weekLogs,
    loading,
    header,
    totalWeekSeconds,
    totalWeekFormatted,
    refreshLogs,
    fromDate,
    toDate,
  };
}
