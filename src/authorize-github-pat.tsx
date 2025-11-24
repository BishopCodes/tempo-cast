import { Action, ActionPanel, Form, showToast, Toast, popToRoot, open } from "@raycast/api";
import { useState } from "react";
import { setGitHubPAT, removeGitHubPAT } from "./auth/github-oauth";

export default function AuthorizeGitHubPAT() {
  const [token, setToken] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit() {
    if (!token.trim()) {
      await showToast({
        style: Toast.Style.Failure,
        title: "Token Required",
        message: "Please enter your Personal Access Token",
      });
      return;
    }

    setIsLoading(true);

    try {
      // Validate token by making a test API call
      const response = await fetch("https://api.github.com/user", {
        headers: {
          Authorization: `token ${token.trim()}`,
          Accept: "application/vnd.github+json",
        },
      });

      if (!response.ok) {
        throw new Error(`Invalid token: ${response.status} ${response.statusText}`);
      }

      const user = await response.json();

      // Check if token has repo scope
      const scopes = response.headers.get("X-OAuth-Scopes");
      const hasRepoScope = scopes?.includes("repo");

      if (!hasRepoScope) {
        await showToast({
          style: Toast.Style.Failure,
          title: "Missing 'repo' Scope",
          message: "Token must have 'repo' scope to access repositories",
        });
        setIsLoading(false);
        return;
      }

      // Save the token
      await setGitHubPAT(token.trim());

      await showToast({
        style: Toast.Style.Success,
        title: "Authorized Successfully",
        message: `Connected as ${user.login}`,
      });

      await popToRoot();
    } catch (error) {
      await showToast({
        style: Toast.Style.Failure,
        title: "Authorization Failed",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    } finally {
      setIsLoading(false);
    }
  }

  async function handleLogout() {
    setIsLoading(true);
    try {
      await removeGitHubPAT();
      await showToast({
        style: Toast.Style.Success,
        title: "Logged Out",
        message: "Personal Access Token removed",
      });
      await popToRoot();
    } catch (error) {
      await showToast({
        style: Toast.Style.Failure,
        title: "Logout Failed",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Form
      isLoading={isLoading}
      actions={
        <ActionPanel>
          <Action title="Save Token" onAction={handleSubmit} />
          <Action
            title="Remove Token"
            onAction={handleLogout}
            shortcut={{ modifiers: ["cmd"], key: "r" }}
            style={Action.Style.Destructive}
          />
          <Action
            title="Create Personal Access Token"
            onAction={() =>
              open("https://github.com/settings/tokens/new?scopes=repo&description=Tempo%20Raycast%20Extension")
            }
            shortcut={{ modifiers: ["cmd"], key: "n" }}
          />
        </ActionPanel>
      }
    >
      <Form.Description
        title="GitHub Personal Access Token"
        text="This token is used to fetch your PRs and commits. It requires the 'repo' scope for full repository access including organization repositories."
      />
      <Form.PasswordField
        id="token"
        title="Personal Access Token"
        placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
        value={token}
        onChange={setToken}
        info="Create a token with 'repo' scope at: https://github.com/settings/tokens"
      />
      <Form.Description text="⌘N - Create new token on GitHub" />
      <Form.Description text="⌘R - Remove current token" />
    </Form>
  );
}
