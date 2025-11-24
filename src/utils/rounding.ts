import { getPreferenceValues } from "@raycast/api";
import { applyRounding } from "../state/timer";

export function maybeRound(seconds: number): number {
  const prefs = getPreferenceValues<{ roundingMode?: string }>();
  if (!prefs.roundingMode || prefs.roundingMode === "none") return seconds;
  return applyRounding(seconds, prefs.roundingMode);
}
