import { LocalStorage } from "@raycast/api";

export type JqlQuery = { title: string; value: string; isDefault?: boolean };

const BASE_DEFAULT: JqlQuery = {
  title: "Assigned to me (Unresolved)",
  value: "assignee = currentUser() AND resolution = Unresolved ORDER BY updated DESC",
  isDefault: true,
};

export async function loadJqlQueries(): Promise<JqlQuery[]> {
  const stored = await LocalStorage.getItem<string>("jqlQueries");
  if (!stored) {
    await saveJqlQueries([BASE_DEFAULT]);
    return [BASE_DEFAULT];
  }
  const queries: JqlQuery[] = JSON.parse(stored);
  if (queries.length === 0) {
    await saveJqlQueries([BASE_DEFAULT]);
    return [BASE_DEFAULT];
  }
  // Ensure only one isDefault
  let foundDefault = false;
  queries.forEach((q) => {
    if (q.isDefault && !foundDefault) {
      foundDefault = true;
    } else {
      q.isDefault = false;
    }
  });
  if (!foundDefault) queries[0].isDefault = true;
  return queries;
}

export async function saveJqlQueries(queries: JqlQuery[]) {
  // Ensure only one isDefault
  let foundDefault = false;
  queries.forEach((q) => {
    if (q.isDefault && !foundDefault) {
      foundDefault = true;
    } else {
      q.isDefault = false;
    }
  });
  if (!foundDefault && queries.length > 0) queries[0].isDefault = true;
  await LocalStorage.setItem("jqlQueries", JSON.stringify(queries));
}

export async function addJqlQuery(query: JqlQuery) {
  const queries = await loadJqlQueries();
  queries.push({ ...query, isDefault: false });
  await saveJqlQueries(queries);
}

export async function removeJqlQuery(index: number) {
  let queries = await loadJqlQueries();
  queries.splice(index, 1);
  if (queries.length === 0) queries = [BASE_DEFAULT];
  await saveJqlQueries(queries);
}

export async function setDefaultJql(index: number) {
  const queries = await loadJqlQueries();
  queries.forEach((q, i) => (q.isDefault = i === index));
  await saveJqlQueries(queries);
}

// --- Per-JQL last selected issue persistence ---
const LAST_ISSUE_KEY = "lastIssueByJql";

export async function saveLastIssueForJql(jql: string, issueKey: string) {
  if (!jql || !issueKey) return;
  const raw = await LocalStorage.getItem<string>(LAST_ISSUE_KEY);
  const map = raw ? (JSON.parse(raw) as Record<string, string>) : {};
  map[jql] = issueKey;
  // Keep map from growing endlessly (cap at 50 entries)
  const entries = Object.entries(map);
  if (entries.length > 50) {
    entries.splice(0, entries.length - 50); // remove oldest (approx; insertion order not guaranteed strictly)
  }
  await LocalStorage.setItem(LAST_ISSUE_KEY, JSON.stringify(Object.fromEntries(entries)));
}

export async function loadLastIssueForJql(jql: string): Promise<string | null> {
  if (!jql) return null;
  const raw = await LocalStorage.getItem<string>(LAST_ISSUE_KEY);
  if (!raw) return null;
  const map = JSON.parse(raw) as Record<string, string>;
  return map[jql] ?? null;
}
