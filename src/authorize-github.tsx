import { Action, ActionPanel, Clipboard, closeMainWindow, Detail, Icon, open, popToRoot, showHUD } from "@raycast/api";
import { useEffect, useState } from "react";
import {
  completeAuthorization,
  DeviceCodeResponse,
  isAuthorized,
  removeGitHubToken,
  requestDeviceCode,
} from "./auth/github-oauth";

export default function AuthorizeGitHub() {
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deviceCode, setDeviceCode] = useState<DeviceCodeResponse | null>(null);
  const [polling, setPolling] = useState(false);

  useEffect(() => {
    checkAuthorization();
  }, []);

  async function checkAuthorization() {
    setLoading(true);
    try {
      const isAuth = await isAuthorized();
      setAuthorized(isAuth);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    }
    setLoading(false);
  }

  async function handleAuthorize() {
    setLoading(true);
    setError(null);
    try {
      // Step 1: Request device code
      const deviceData = await requestDeviceCode();
      setDeviceCode(deviceData);
      setLoading(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to get device code");
      setLoading(false);
    }
  }

  async function handleCopyAndOpen() {
    if (!deviceCode) return;

    try {
      // Copy code to clipboard
      await Clipboard.copy(deviceCode.user_code);

      // Open GitHub in browser
      await open(deviceCode.verification_uri);

      // Show HUD after opening browser
      await showHUD("✅ Code copied! Authorize on GitHub, then return here.");

      // Start polling for authorization
      setPolling(true);
      await completeAuthorization(deviceCode);
      setAuthorized(true);
      await showHUD("✅ Successfully authorized GitHub Copilot");
      await popToRoot();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to complete authorization");
      setPolling(false);
    }
  }

  // Auto-copy to clipboard when device code is ready
  useEffect(() => {
    if (deviceCode && !polling && !authorized) {
      Clipboard.copy(deviceCode.user_code);
    }
  }, [deviceCode, polling, authorized]);

  async function handleCancel() {
    setDeviceCode(null);
    setError(null);
  }

  async function handleLogout() {
    setLoading(true);
    try {
      await removeGitHubToken();
      setAuthorized(false);
      await showHUD("Logged out from GitHub");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to logout");
    }
    setLoading(false);
  }

  if (loading) {
    return <Detail isLoading={true} markdown="Loading..." />;
  }

  // Show verification code screen
  if (deviceCode && !authorized) {
    return (
      <Detail
        isLoading={polling}
        markdown={`# 🔐 GitHub Authorization Code

## Your Verification Code:

# \`${deviceCode.user_code}\`

## Instructions:

1. **Copy the code above** (it's already copied to your clipboard!)
2. **Click "Open GitHub & Authorize"** below to open GitHub in your browser
3. **Paste the code** on GitHub's authorization page
4. **Return here** - authorization will complete automatically once you approve

The code will expire in ${Math.floor(deviceCode.expires_in / 60)} minutes.

${polling ? "⏳ **Waiting for you to authorize on GitHub...**" : ""}`}
        actions={
          <ActionPanel>
            <Action
              title="Copy Code & Open GitHub"
              onAction={handleCopyAndOpen}
              icon={Icon.Globe}
              shortcut={{ modifiers: ["cmd"], key: "return" }}
            />
            <Action
              title="Copy Code Only"
              onAction={async () => {
                await Clipboard.copy(deviceCode.user_code);
                await showHUD("✅ Code copied!");
              }}
              icon={Icon.Clipboard}
              shortcut={{ modifiers: ["cmd"], key: "c" }}
            />
            <Action title="Cancel" onAction={handleCancel} icon={Icon.XMarkCircle} />
          </ActionPanel>
        }
      />
    );
  }

  if (error) {
    return (
      <Detail
        markdown={`# ❌ Error\n\n${error}`}
        actions={
          <ActionPanel>
            <Action title="Try Again" onAction={handleAuthorize} icon={Icon.Repeat} />
            <Action title="Close" onAction={closeMainWindow} icon={Icon.XMarkCircle} />
          </ActionPanel>
        }
      />
    );
  }

  if (authorized) {
    return (
      <Detail
        markdown={`# ✅ GitHub Copilot Authorized

You are connected to GitHub Copilot!

You can now use GitHub Copilot for AI summaries in the AI Summary feature.

**Note:** Requires an active GitHub Copilot subscription (Free, Pro, Business, or Enterprise).`}
        actions={
          <ActionPanel>
            <Action title="Logout" onAction={handleLogout} icon={Icon.Logout} style={Action.Style.Destructive} />
            <Action title="Close" onAction={closeMainWindow} icon={Icon.XMarkCircle} />
          </ActionPanel>
        }
      />
    );
  }

  return (
    <Detail
      markdown={`# 🔐 Authorize GitHub Copilot

Connect your GitHub account to use GitHub Copilot for AI summaries.

## What will happen:

1. You'll be shown a verification code
2. Your browser will open to GitHub's authorization page
3. Enter the verification code on GitHub
4. Return to Raycast - authorization will complete automatically

## Requirements:

- A GitHub account with Copilot access (Free, Pro, Business, or Enterprise)
- This uses the GitHub Copilot Chat API

Press **Authorize** below to begin.`}
      actions={
        <ActionPanel>
          <Action title="Authorize GitHub Copilot" onAction={handleAuthorize} icon={Icon.Check} />
          <Action title="Cancel" onAction={closeMainWindow} icon={Icon.XMarkCircle} />
        </ActionPanel>
      }
    />
  );
}
