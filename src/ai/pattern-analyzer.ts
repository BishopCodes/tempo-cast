import { TempoWorklog } from "../types";
import { getAIProvider } from "./provider";
import { getIssue, getIssueById } from "../api/jira";

export interface WorklogPattern {
  issueKey: string;
  summary: string;
  typicalDuration: number;
  frequency: number;
  lastWorked: string;
  confidence: "high" | "medium" | "low";
  reasoning: string;
}

export async function analyzeWorklogPatterns(
  pastWeeks: TempoWorklog[][],
  targetWeekStart: string,
): Promise<WorklogPattern[]> {
  const provider = await getAIProvider();

  const issueStats = new Map<
    string,
    {
      count: number;
      totalSeconds: number;
      lastDate: string;
      descriptions: string[];
    }
  >();

  const issueIdToKey = new Map<number, string>();

  for (const weekLogs of pastWeeks) {
    for (const log of weekLogs) {
      if (log.issue?.key) {
        issueIdToKey.set(log.issue.id, log.issue.key);
      } else if (!issueIdToKey.has(log.issue.id)) {
        issueIdToKey.set(log.issue.id, "");
      }
    }
  }

  const idsNeedingLookup = Array.from(issueIdToKey.entries())
    .filter(([, key]) => key === "")
    .map(([id]) => id);

  for (const issueId of idsNeedingLookup) {
    try {
      const issue = await getIssueById(issueId);
      issueIdToKey.set(issueId, issue.key);
    } catch {
      issueIdToKey.delete(issueId);
    }
  }

  for (const weekLogs of pastWeeks) {
    for (const log of weekLogs) {
      const key = issueIdToKey.get(log.issue.id);
      if (!key) continue;

      const existing = issueStats.get(key) || {
        count: 0,
        totalSeconds: 0,
        lastDate: log.startDate,
        descriptions: [],
      };

      existing.count++;
      existing.totalSeconds += log.timeSpentSeconds || 0;
      if (log.description) {
        existing.descriptions.push(log.description);
      }
      if (log.startDate > existing.lastDate) {
        existing.lastDate = log.startDate;
      }

      issueStats.set(key, existing);
    }
  }

  if (issueStats.size === 0) {
    return [];
  }

  const issueList = Array.from(issueStats.entries())
    .map(([key, stats]) => ({
      issueKey: key,
      timesWorked: stats.count,
      avgDuration: Math.round(stats.totalSeconds / stats.count),
      totalDuration: stats.totalSeconds,
      lastWorked: stats.lastDate,
      recentDescriptions: stats.descriptions.slice(-3),
    }))
    .sort((a, b) => b.timesWorked - a.timesWorked);

  const prompt = `You are analyzing work patterns to help a developer backfill their timesheet.

Past ${pastWeeks.length} weeks of work data:
${JSON.stringify(issueList, null, 2)}

Target week: ${targetWeekStart}

Based on the patterns above, suggest 5-8 tasks this person is most likely to work on in the target week.

For each suggestion, consider:
- How frequently they work on this task (higher frequency = more likely)
- How recently they worked on it (more recent = more likely)
- Whether there's a regular weekly pattern
- The typical time investment

Return a JSON array of suggestions with this structure:
[
  {
    "issueKey": "ABC-123",
    "reasoning": "Brief explanation of why this task is likely (1-2 sentences)",
    "confidence": "high" | "medium" | "low",
    "estimatedDuration": <seconds>
  }
]

Return ONLY the JSON array, no other text.`;

  try {
    const response = await provider.chat([
      {
        role: "system",
        content: "You are a helpful assistant that analyzes work patterns. Always respond with valid JSON only.",
      },
      { role: "user", content: prompt },
    ]);

    const suggestions = JSON.parse(response);

    const patterns: WorklogPattern[] = await Promise.all(
      suggestions.map(
        async (s: { issueKey: string; estimatedDuration: BigInteger; confidence: string; reasoning: string }) => {
          const stats = issueStats.get(s.issueKey);
          let summary = "";

          try {
            const issue = await getIssue(s.issueKey);
            summary = issue.fields.summary;
          } catch {
            summary = s.issueKey;
          }

          return {
            issueKey: s.issueKey,
            summary,
            typicalDuration: s.estimatedDuration || stats?.totalSeconds || 3600,
            frequency: stats?.count || 1,
            lastWorked: stats?.lastDate || "",
            confidence: s.confidence || "medium",
            reasoning: s.reasoning || "Pattern detected",
          };
        },
      ),
    );

    return patterns;
  } catch {
    const topIssues = Array.from(issueStats.entries())
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 5);

    const fallbackPatterns: WorklogPattern[] = await Promise.all(
      topIssues.map(async ([key, stats]) => {
        let summary = key;
        try {
          const issue = await getIssue(key);
          summary = issue.fields.summary;
        } catch {
          // Use key as summary if fetch fails
        }

        return {
          issueKey: key,
          summary,
          typicalDuration: Math.round(stats.totalSeconds / stats.count),
          frequency: stats.count,
          lastWorked: stats.lastDate,
          confidence: "medium" as const,
          reasoning: `Worked on ${stats.count} times in past ${pastWeeks.length} weeks`,
        };
      }),
    );

    return fallbackPatterns;
  }
}
