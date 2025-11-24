/// <reference types="@raycast/api">

/* 🚧 🚧 🚧
 * This file is auto-generated from the extension's manifest.
 * Do not modify manually. Instead, update the `package.json` file.
 * 🚧 🚧 🚧 */

/* eslint-disable @typescript-eslint/ban-types */

type ExtensionPreferences = {
  /** Jira Base URL - Your Jira instance base URL (e.g., your-domain.atlassian.net) */
  "jiraBaseUrl": string,
  /** Jira Email - Your Jira email address used for authentication */
  "jiraEmail": string,
  /** Jira API Token - Your Jira API token (create one at https://id.atlassian.com/manage-profile/security/api-tokens) */
  "jiraApiToken": string,
  /** Tempo API Token - Your Tempo API token (create one at https://<your-domain>.atlassian.net/plugins/servlet/ac/io.tempo.jira/tempo-app#!/configuration/api-integration) */
  "tempoApiToken": string,
  /** Rounding Mode (Timer & Backfill) - Rounding mode for timer and backfill operations */
  "roundingMode": "none" | "up15" | "nearest15" | "down15",
  /** Backfill Default Week - Default week for backfill operations */
  "backfillDefaultWeek": "this" | "last" | "twoWeeksAgo",
  /** Time Input Method - Choose how to input time duration and start time */
  "timeInputMethod": "dropdown" | "text",
  /** AI Provider (Summaries) - AI provider for generating summaries */
  "aiProvider": "github" | "ollama" | "none",
  /** GitHub Model - GitHub Copilot model ID to use for AI features. Use 'Tempo: View Available AI Models' command to see all supported models. */
  "githubModel": string,
  /** AI Pattern Lookback Period - Number of weeks to analyze for AI pattern suggestions */
  "aiLookbackWeeks": "1" | "2" | "3" | "4" | "6" | "8" | "12" | "16",
  /** Enable GitHub PR Suggestions - Show Jira issues from your GitHub PRs and commits in Backfill Week view */
  "enableGitHubPRs": boolean,
  /** Timer Notification Hours - Hours at which to notify about long-running timers (comma-separated, e.g., 1,4,8) */
  "timerNotifyAt": string,
  /** Ollama Host - Ollama host URL (e.g., http://127.0.0.1:11434) */
  "ollamaHost": string,
  /** Ollama Model - Ollama model to use for AI summaries */
  "ollamaModel": string
}

/** Preferences accessible in all the extension's commands */
declare type Preferences = ExtensionPreferences

declare namespace Preferences {
  /** Preferences accessible in the `quick-log` command */
  export type QuickLog = ExtensionPreferences & {}
  /** Preferences accessible in the `authorize-github` command */
  export type AuthorizeGithub = ExtensionPreferences & {}
  /** Preferences accessible in the `authorize-github-pat` command */
  export type AuthorizeGithubPat = ExtensionPreferences & {}
  /** Preferences accessible in the `view-models` command */
  export type ViewModels = ExtensionPreferences & {}
  /** Preferences accessible in the `log-time` command */
  export type LogTime = ExtensionPreferences & {}
  /** Preferences accessible in the `worklogs` command */
  export type Worklogs = ExtensionPreferences & {}
  /** Preferences accessible in the `start-timer` command */
  export type StartTimer = ExtensionPreferences & {}
  /** Preferences accessible in the `stop-timer` command */
  export type StopTimer = ExtensionPreferences & {}
  /** Preferences accessible in the `backfill-week` command */
  export type BackfillWeek = ExtensionPreferences & {}
  /** Preferences accessible in the `browse-github-prs` command */
  export type BrowseGithubPrs = ExtensionPreferences & {}
  /** Preferences accessible in the `ai-summary` command */
  export type AiSummary = ExtensionPreferences & {}
  /** Preferences accessible in the `manage-queries` command */
  export type ManageQueries = ExtensionPreferences & {}
  /** Preferences accessible in the `timer-menu` command */
  export type TimerMenu = ExtensionPreferences & {}
}

declare namespace Arguments {
  /** Arguments passed to the `quick-log` command */
  export type QuickLog = {}
  /** Arguments passed to the `authorize-github` command */
  export type AuthorizeGithub = {}
  /** Arguments passed to the `authorize-github-pat` command */
  export type AuthorizeGithubPat = {}
  /** Arguments passed to the `view-models` command */
  export type ViewModels = {}
  /** Arguments passed to the `log-time` command */
  export type LogTime = {}
  /** Arguments passed to the `worklogs` command */
  export type Worklogs = {}
  /** Arguments passed to the `start-timer` command */
  export type StartTimer = {}
  /** Arguments passed to the `stop-timer` command */
  export type StopTimer = {}
  /** Arguments passed to the `backfill-week` command */
  export type BackfillWeek = {}
  /** Arguments passed to the `browse-github-prs` command */
  export type BrowseGithubPrs = {}
  /** Arguments passed to the `ai-summary` command */
  export type AiSummary = {}
  /** Arguments passed to the `manage-queries` command */
  export type ManageQueries = {}
  /** Arguments passed to the `timer-menu` command */
  export type TimerMenu = {}
}

