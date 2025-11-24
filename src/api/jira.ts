import fetch from "cross-fetch";
import { getPreferenceValues } from "@raycast/api";
import { z } from "zod";
import type { JiraIssue } from "../types";

interface Prefs {
  jiraBaseUrl: string;
  jiraEmail: string;
  jiraApiToken: string;
}

function jiraHeaders() {
  const { jiraEmail, jiraApiToken } = getPreferenceValues<Prefs>();
  const auth = Buffer.from(`${jiraEmail}:${jiraApiToken}`).toString("base64");
  return {
    Authorization: `Basic ${auth}`,
    Accept: "application/json",
    "Content-Type": "application/json",
  };
}

async function jiraFetch(path: string, init?: RequestInit): Promise<Response> {
  const { jiraBaseUrl } = getPreferenceValues<Prefs>();
  const url = `https://${jiraBaseUrl}${path}`;
  const res = await fetch(url, {
    ...init,
    headers: { ...jiraHeaders(), ...init?.headers },
  });

  if (!res.ok) {
    throw new Error(`Jira API error: ${res.status} ${res.statusText}`);
  }

  return res;
}

export async function searchIssues(jql: string): Promise<JiraIssue[]> {
  const res = await jiraFetch(`/rest/api/3/search/jql?jql=${encodeURIComponent(jql)}&maxResults=50&fields=summary`);
  const schema = z.object({ issues: z.array(z.any()) });
  const json = schema.parse(await res.json());
  return json.issues as JiraIssue[];
}

export async function getIssueIdFromKey(key: string): Promise<string> {
  const res = await jiraFetch(`/rest/api/3/issue/${encodeURIComponent(key)}?fields=summary`);
  const json = (await res.json()) as JiraIssue;
  return json.id;
}

export async function getIssue(key: string): Promise<JiraIssue> {
  const res = await jiraFetch(`/rest/api/3/issue/${encodeURIComponent(key)}?fields=summary,issuetype,project`);
  return (await res.json()) as JiraIssue;
}

export async function getIssueById(id: number): Promise<JiraIssue> {
  const res = await jiraFetch(`/rest/api/3/issue/${id}?fields=summary,issuetype,project`);
  return (await res.json()) as JiraIssue;
}
