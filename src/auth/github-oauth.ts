import { LocalStorage } from "@raycast/api";
import { setTimeout } from "timers/promises";

// GitHub Copilot OAuth client ID (public client for device flow)
// This is the same client ID used by VSCode and other GitHub Copilot clients
const GITHUB_COPILOT_CLIENT_ID = "Iv1.b507a08c87ecfe98";

const STORAGE_KEY = "github_oauth_token";
const PAT_STORAGE_KEY = "github_personal_access_token";

export interface DeviceCodeResponse {
  device_code: string;
  user_code: string;
  verification_uri: string;
  expires_in: number;
  interval: number;
}

interface TokenResponse {
  access_token: string;
  token_type: string;
  scope: string;
  error?: string;
}

/**
 * Get the stored GitHub OAuth token
 */
export async function getGitHubToken(): Promise<string | undefined> {
  return await LocalStorage.getItem<string>(STORAGE_KEY);
}

/**
 * Remove the stored GitHub OAuth token (logout)
 */
export async function removeGitHubToken(): Promise<void> {
  await LocalStorage.removeItem(STORAGE_KEY);
}

/**
 * Request device code from GitHub (Step 1 of device flow)
 */
export async function requestDeviceCode(): Promise<DeviceCodeResponse> {
  const deviceCodeResponse = await fetch("https://github.com/login/device/code", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      client_id: GITHUB_COPILOT_CLIENT_ID,
      scope: "read:user repo", // Added repo scope for PR/commit access
    }),
  });

  if (!deviceCodeResponse.ok) {
    throw new Error(`Failed to get device code: ${deviceCodeResponse.statusText}`);
  }

  return await deviceCodeResponse.json();
}

/**
 * Complete the authorization flow by polling for the token
 */
export async function completeAuthorization(deviceData: DeviceCodeResponse): Promise<string> {
  const accessToken = await pollForToken(deviceData.device_code, deviceData.interval, deviceData.expires_in);
  await LocalStorage.setItem(STORAGE_KEY, accessToken);
  return accessToken;
}

/**
 * Poll GitHub's token endpoint until authorization is complete
 */
async function pollForToken(deviceCode: string, intervalSeconds: number, expiresIn: number): Promise<string> {
  const startTime = Date.now();
  const expiresAt = startTime + expiresIn * 1000;
  let currentInterval = intervalSeconds * 1000;

  while (Date.now() < expiresAt) {
    await setTimeout(currentInterval);

    const response = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        client_id: GITHUB_COPILOT_CLIENT_ID,
        device_code: deviceCode,
        grant_type: "urn:ietf:params:oauth:grant-type:device_code",
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to poll for token: ${response.statusText}`);
    }

    const data: TokenResponse = await response.json();

    if (data.error) {
      if (data.error === "authorization_pending") {
        continue;
      } else if (data.error === "slow_down") {
        currentInterval += 5000;
        continue;
      } else if (data.error === "expired_token") {
        throw new Error("Device code expired. Please try again.");
      } else if (data.error === "access_denied") {
        throw new Error("Authorization was denied.");
      } else {
        throw new Error(`Authorization error: ${data.error}`);
      }
    }

    return data.access_token;
  }

  throw new Error("Authorization timed out. Please try again.");
}

/**
 * Check if user is authorized
 */
export async function isAuthorized(): Promise<boolean> {
  const token = await getGitHubToken();
  return !!token;
}

/**
 * Exchange GitHub OAuth token for a Copilot token
 */
export async function getCopilotToken(githubToken: string): Promise<string> {
  const response = await fetch("https://api.github.com/copilot_internal/v2/token", {
    method: "GET",
    headers: {
      Authorization: `token ${githubToken}`,
      "Editor-Version": "vscode/1.95.0",
      "Editor-Plugin-Version": "copilot-chat/0.22.0",
      "User-Agent": "GitHubCopilotChat/0.22.0",
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to get Copilot token: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  return data.token;
}

// ============================================================================
// Personal Access Token (PAT) for GitHub API (PR/commit access)
// ============================================================================

/**
 * Get the stored GitHub Personal Access Token
 */
export async function getGitHubPAT(): Promise<string | undefined> {
  return await LocalStorage.getItem<string>(PAT_STORAGE_KEY);
}

/**
 * Store a GitHub Personal Access Token
 */
export async function setGitHubPAT(token: string): Promise<void> {
  await LocalStorage.setItem(PAT_STORAGE_KEY, token);
}

/**
 * Remove the stored GitHub Personal Access Token
 */
export async function removeGitHubPAT(): Promise<void> {
  await LocalStorage.removeItem(PAT_STORAGE_KEY);
}

/**
 * Check if user has set a Personal Access Token
 */
export async function hasPAT(): Promise<boolean> {
  const token = await getGitHubPAT();
  return !!token;
}
