import { getPreferenceValues } from "@raycast/api";

type Prefs = { jiraBaseUrl: string };

/** Build Tempo URLs that always start with the configured jiraBaseUrl */
export function tempoWeekUrl() {
  const { jiraBaseUrl } = getPreferenceValues<Prefs>();
  return `https://${jiraBaseUrl}/jira/tempo-app/my-work/week`;
}

export function tempoDayUrl(dateISO: string) {
  const { jiraBaseUrl } = getPreferenceValues<Prefs>();
  // dateISO should be YYYY-MM-DD
  return `https://${jiraBaseUrl}/jira/tempo-app/my-work/day?date=${encodeURIComponent(dateISO)}`;
}
