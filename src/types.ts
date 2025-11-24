export type JiraIssue = {
  id: string;
  key: string;
  fields: {
    summary: string;
    issuetype?: { name: string };
    project?: { key: string };
  };
};

export type TempoWorklog = {
  tempoWorklogId: number;
  jiraWorklogId?: number;
  issue: { id: number; key?: string };
  timeSpentSeconds: number;
  startDate: string; // YYYY-MM-DD
  startTime: string; // HH:mm:ss
  description?: string;
  author?: { accountId: string };
};

export type DayWorklogs = {
  date: string;
  items: TempoWorklog[];
};
