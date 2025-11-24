import { LocalStorage, getPreferenceValues } from "@raycast/api";

export interface TimerEntry {
  issueKey: string;
  issueId: string;
  description?: string;
  start: string;
  workTypeValue: string;
}

const TIMER_KEY = "tempo-active-timer";
const ROUNDING_INTERVAL = 900;

export async function startTimer(entry: Omit<TimerEntry, "start">): Promise<TimerEntry> {
  const data: TimerEntry = { ...entry, start: new Date().toISOString() };
  await LocalStorage.setItem(TIMER_KEY, JSON.stringify(data));
  return data;
}

export async function stopTimer(): Promise<{ entry: TimerEntry; seconds: number } | null> {
  const raw = await LocalStorage.getItem(TIMER_KEY);
  if (!raw) return null;
  
  await LocalStorage.removeItem(TIMER_KEY);
  const entry = JSON.parse(raw as string) as TimerEntry;
  const start = new Date(entry.start).getTime();
  let diff = Math.floor((Date.now() - start) / 1000);

  const prefs = getPreferenceValues<{ roundingMode?: string }>();
  if (prefs.roundingMode && prefs.roundingMode !== "none") {
    diff = applyRounding(diff, prefs.roundingMode);
  }
  
  return { entry, seconds: diff };
}

export async function getActiveTimer(): Promise<TimerEntry | null> {
  const raw = await LocalStorage.getItem(TIMER_KEY);
  if (!raw) return null;
  return JSON.parse(raw as string) as TimerEntry;
}

export function applyRounding(seconds: number, mode: string): number {
  switch (mode) {
    case "up15":
      return Math.ceil(seconds / ROUNDING_INTERVAL) * ROUNDING_INTERVAL;
    case "down15":
      return Math.floor(seconds / ROUNDING_INTERVAL) * ROUNDING_INTERVAL;
    case "nearest15":
      return Math.round(seconds / ROUNDING_INTERVAL) * ROUNDING_INTERVAL;
    default:
      return seconds;
  }
}
