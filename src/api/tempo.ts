import fetch from "cross-fetch";
import { getPreferenceValues, LocalStorage } from "@raycast/api";
import { z } from "zod";
import type { TempoWorklog } from "../types";
import { handleError } from "../utils/error-handling";

interface Prefs {
  jiraBaseUrl: string;
  jiraEmail: string;
  jiraApiToken: string;
  tempoApiToken: string;
}

const TEMPO_API_BASE = "https://api.tempo.io/4";
const WORK_TYPES_CACHE_KEY = "tempo.worktypes.cache.v1";
const WORK_TYPES_TTL_MS = 1000 * 60 * 60 * 24 * 7;

let cachedAccountId: string | null = null;
let cachedWorkTypes: WorkType[] | null = null;

async function jiraAccountId(): Promise<string> {
  if (cachedAccountId) return cachedAccountId;

  const { jiraBaseUrl, jiraEmail, jiraApiToken } = getPreferenceValues<Prefs>();
  const res = await fetch(`https://${jiraBaseUrl}/rest/api/3/myself`, {
    headers: {
      Authorization: "Basic " + Buffer.from(`${jiraEmail}:${jiraApiToken}`).toString("base64"),
      Accept: "application/json",
    },
  });
  
  if (!res.ok) {
    throw new Error(`Jira authentication failed: ${res.status} ${res.statusText}`);
  }

  const me = (await res.json()) as { accountId: string };
  cachedAccountId = me.accountId;
  return cachedAccountId;
}

function tempoHeaders(): Record<string, string> {
  const { tempoApiToken } = getPreferenceValues<Prefs>();
  if (!tempoApiToken) {
    throw new Error("Tempo API token is not configured in preferences");
  }
  return {
    Authorization: `Bearer ${tempoApiToken}`,
    "Content-Type": "application/json",
    Accept: "application/json",
  };
}

async function tempoFetch(path: string, init?: RequestInit): Promise<Response> {
  const res = await fetch(`${TEMPO_API_BASE}${path}`, {
    ...init,
    headers: { ...tempoHeaders(), ...init?.headers },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    let message = `Tempo API error: ${res.status} ${res.statusText}`;
    if (text) message += ` – ${text.slice(0, 300)}`;
    await handleError(new Error(message), "Tempo API Error");
    throw new Error(message);
  }

  return res;
}

export interface WorkType {
  value: string;
  label: string;
}

export async function getWorkTypes(forceRefresh = false): Promise<WorkType[]> {
  if (!forceRefresh && cachedWorkTypes && cachedWorkTypes.length > 0) {
    return cachedWorkTypes;
  }

  if (!forceRefresh) {
    const cached = await LocalStorage.getItem<string>(WORK_TYPES_CACHE_KEY);
    if (cached) {
      try {
        const parsed = JSON.parse(cached) as { ts: number; items: WorkType[] };
        if (Array.isArray(parsed.items) && Date.now() - parsed.ts < WORK_TYPES_TTL_MS) {
          cachedWorkTypes = parsed.items;
          return cachedWorkTypes;
        }
      } catch {
        // Ignore parse errors
      }
    }
  }

  const res = await tempoFetch(`/work-attributes`, { method: "GET" });
  const json = await res.json();

  const attributeSchema = z.object({
    key: z.string(),
    name: z.string(),
    values: z.array(z.string()),
    names: z.record(z.string(), z.string()),
  });

  const collectionSchema = z.object({
    results: z.array(attributeSchema),
  });

  const attributes = Array.isArray(json) ? z.array(attributeSchema).parse(json) : collectionSchema.parse(json).results;
  const workTypeAttr = attributes.find((a) => a.name.toLowerCase() === "work type");

  const arr: WorkType[] =
    workTypeAttr?.values.map((v) => ({
      value: v,
      label: workTypeAttr.names[v],
    })) ?? [];

  cachedWorkTypes = arr;
  await LocalStorage.setItem(WORK_TYPES_CACHE_KEY, JSON.stringify({ ts: Date.now(), items: arr }));
  return arr;
}

export async function createWorklog(params: {
  issueId: string;
  timeSpentSeconds: number;
  startDate: string;
  startTime?: string;
  description?: string;
  workTypeValue: string;
}): Promise<TempoWorklog> {
  const authorAccountId = await jiraAccountId();

  const body = {
    issueId: Number(params.issueId),
    timeSpentSeconds: params.timeSpentSeconds,
    startDate: params.startDate,
    authorAccountId,
    attributes: [
      {
        key: "_WorkType_",
        value: params.workTypeValue,
      },
    ],
    ...(params.startTime ? { startTime: params.startTime } : {}),
    ...(params.description ? { description: params.description } : {}),
  };

  const res = await tempoFetch(`/worklogs`, {
    method: "POST",
    body: JSON.stringify(body),
  });

  const schema = z.object({
    tempoWorklogId: z.number(),
  });
  const json = schema.parse(await res.json());
  return json as unknown as TempoWorklog;
}

export async function getMyWorklogs(from: string, to: string): Promise<TempoWorklog[]> {
  const accountId = await jiraAccountId();
  const res = await tempoFetch(
    `/worklogs/user/${accountId}?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
    { method: "GET" }
  );

  const parsed = (await res.json()) as { results?: TempoWorklog[] } | TempoWorklog[];
  const arr = Array.isArray(parsed) ? parsed : (parsed.results ?? []);
  return arr as TempoWorklog[];
}
