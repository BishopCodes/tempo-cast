import { getPreferenceValues } from "@raycast/api";
import { getCopilotToken, getGitHubToken } from "../auth/github-oauth";

interface Prefs {
  aiProvider?: "github" | "ollama" | "none";
  githubModel?: string;
  ollamaHost?: string;
  ollamaModel?: string;
}

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface AIProvider {
  chat(messages: ChatMessage[]): Promise<string>;
}

export interface ModelInfo {
  id: string;
  name: string;
  version?: string;
}

export async function getAvailableModels(): Promise<ModelInfo[]> {
  try {
    const githubToken = await getGitHubToken();
    if (!githubToken) {
      return getDefaultModels();
    }

    const copilotToken = await getCopilotToken(githubToken);

    const res = await fetch("https://api.githubcopilot.com/models", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${copilotToken}`,
        "Content-Type": "application/json",
        "Editor-Version": "vscode/1.95.0",
        "User-Agent": "GitHubCopilotChat/0.22.0",
      },
    });

    if (!res.ok) {
      return getDefaultModels();
    }

    const json = await res.json();

    if (json.data && Array.isArray(json.data)) {
      return json.data.map((model: { id: string; name: string; version: string }) => ({
        id: model.id || model.name,
        name: model.name || model.id,
        version: model.version,
      }));
    }

    if (Array.isArray(json)) {
      return json.map((model: { id: string; name: string; version: string }) => ({
        id: model.id || model.name,
        name: model.name || model.id,
        version: model.version,
      }));
    }

    return getDefaultModels();
  } catch {
    return getDefaultModels();
  }
}

function getDefaultModels(): ModelInfo[] {
  return [
    { id: "gpt-4o", name: "GPT-4o (Latest)" },
    { id: "gpt-4o-mini", name: "GPT-4o Mini (Recommended)" },
    { id: "gpt-4-turbo", name: "GPT-4 Turbo" },
    { id: "gpt-3.5-turbo", name: "GPT-3.5 Turbo" },
    { id: "o1-preview", name: "o1-preview" },
    { id: "o1-mini", name: "o1-mini" },
    { id: "claude-3.5-sonnet", name: "Claude 3.5 Sonnet" },
  ];
}

export async function getAIProvider(): Promise<AIProvider> {
  const prefs = getPreferenceValues<Prefs>();
  const provider = prefs.aiProvider || "none";

  if (provider === "github") {
    return {
      chat: async (messages: ChatMessage[]) => {
        const githubToken = await getGitHubToken();

        if (!githubToken) {
          throw new Error("GitHub Copilot token required. Run 'Authorize GitHub Copilot' command.");
        }

        const copilotToken = await getCopilotToken(githubToken);
        const model = prefs.githubModel || "gpt-4o-mini";

        const res = await fetch(`https://api.githubcopilot.com/chat/completions`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${copilotToken}`,
            "Content-Type": "application/json",
            "Editor-Version": "vscode/1.95.0",
            "Editor-Plugin-Version": "copilot-chat/0.22.0",
            "User-Agent": "GitHubCopilotChat/0.22.0",
          },
          body: JSON.stringify({
            model,
            messages,
            temperature: 1,
            top_p: 1,
            max_tokens: 2000,
            stream: false,
          }),
        });

        if (!res.ok) {
          const errorText = await res.text();
          throw new Error(`GitHub Copilot error ${res.status}: ${errorText}`);
        }

        const json = await res.json();
        return json?.choices?.[0]?.message?.content || "(no content)";
      },
    };
  }

  if (provider === "ollama") {
    return {
      chat: async (messages: ChatMessage[]) => {
        const host = prefs.ollamaHost || "http://127.0.0.1:11434";
        const model = prefs.ollamaModel || "llama3.1:8b";

        const prompt = messages.map((m) => `${m.role}: ${m.content}`).join("\n\n");

        const res = await fetch(host + "/api/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ model, prompt, stream: false }),
        });

        if (!res.ok) {
          throw new Error(`Ollama error ${res.status}`);
        }

        const json = await res.json();
        return json?.response || "(no content)";
      },
    };
  }

  throw new Error("No AI provider configured. Please set aiProvider in preferences.");
}

export async function summarizeWeek(dataJson: string): Promise<string> {
  const prefs = getPreferenceValues<Prefs>();
  const provider = prefs.aiProvider || "none";

  if (provider === "github") return summarizeGitHubModels(prefs, dataJson);
  if (provider === "ollama") return summarizeOllama(prefs, dataJson);
  return fallbackSummary(dataJson);
}

async function summarizeGitHubModels(p: Prefs, dataJson: string): Promise<string> {
  const githubToken = await getGitHubToken();

  if (!githubToken) {
    return "⚠️ GitHub Copilot token required. Run 'Authorize GitHub Copilot' command (requires GitHub Copilot access).";
  }

  try {
    const copilotToken = await getCopilotToken(githubToken);
    const model = p.githubModel || "gpt-4o-mini";

    const body = {
      model,
      messages: [
        {
          role: "system",
          content:
            "Summarize the following Tempo worklogs into a concise weekly report with bullet points grouped by issue or project, " +
            "include total hours per group and overall total. Keep under 220 words.",
        },
        { role: "user", content: dataJson },
      ],
      temperature: 1,
      top_p: 1,
      max_tokens: 1000,
      stream: false,
    };

    const res = await fetch(`https://api.githubcopilot.com/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${copilotToken}`,
        "Content-Type": "application/json",
        "Editor-Version": "vscode/1.95.0",
        "Editor-Plugin-Version": "copilot-chat/0.22.0",
        "User-Agent": "GitHubCopilotChat/0.22.0",
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errorText = await res.text();
      return `GitHub Copilot error ${res.status}: ${errorText}`;
    }

    const json = await res.json();
    return json?.choices?.[0]?.message?.content || "(no content)";
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    if (errorMsg.includes("404") || errorMsg.includes("403")) {
      return "⚠️ GitHub Copilot access required. Make sure you have an active Copilot subscription (Free tier available at github.com/copilot).";
    }
    return `Error getting Copilot token: ${errorMsg}`;
  }
}

async function summarizeOllama(p: Prefs, dataJson: string): Promise<string> {
  const host = p.ollamaHost || "http://127.0.0.1:11434";
  const model = p.ollamaModel || "llama3.1:8b";
  const prompt =
    "Summarize the following Tempo worklogs into a concise weekly report with bullet points grouped by issue or project, " +
    "include total hours per group and overall total. Keep under 220 words. Data: " +
    dataJson;

  const res = await fetch(host + "/api/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model, prompt, stream: false }),
  });

  if (!res.ok) return `Ollama error ${res.status}`;

  const json = await res.json();
  return json?.response || "(no content)";
}

function fallbackSummary(dataJson: string): string {
  try {
    const data = JSON.parse(dataJson) as Array<{
      date: string;
      items: Array<{
        timeSpentSeconds: number;
        issue?: unknown;
        description?: string;
      }>;
    }>;
    let total = 0;
    for (const d of data) {
      for (const i of d.items) {
        total += i.timeSpentSeconds || 0;
      }
    }
    const hours = (total / 3600).toFixed(2);
    return `Weekly total: ${hours}h across ${data.length} day(s). (Configure AI provider for detailed bullets.)`;
  } catch {
    return "(Set AI provider in preferences to generate summaries)";
  }
}
