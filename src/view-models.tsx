import { List, ActionPanel, Action, Icon, showToast, Toast, openExtensionPreferences, Clipboard } from "@raycast/api";
import { useState, useEffect } from "react";
import { getAvailableModels, type ModelInfo } from "./ai/provider";

export default function ViewModels() {
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [loading, setLoading] = useState(true);

  const loadModels = async () => {
    try {
      setLoading(true);
      await showToast({
        style: Toast.Style.Animated,
        title: "Fetching available models...",
      });

      const fetchedModels = await getAvailableModels();
      setModels(fetchedModels);

      await showToast({
        style: Toast.Style.Success,
        title: "Models Loaded",
        message: `Found ${fetchedModels.length} available models`,
      });
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Unknown error";
      await showToast({
        style: Toast.Style.Failure,
        title: "Failed to load models",
        message: msg,
      });
    } finally {
      setLoading(false);
    }
  };

  const setAsPreferredModel = async (modelId: string) => {
    try {
      // Copy to clipboard
      await Clipboard.copy(modelId);

      // Show toast with instructions
      await showToast({
        style: Toast.Style.Success,
        title: "Model ID Copied",
        message: "Opening preferences to paste...",
      });

      // Open preferences
      await openExtensionPreferences();
    } catch (error) {
      await showToast({
        style: Toast.Style.Failure,
        title: "Failed to set model",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  };

  useEffect(() => {
    loadModels();
  }, []);

  return (
    <List isLoading={loading} searchBarPlaceholder="Search models...">
      <List.Section
        title="Available GitHub Copilot Models"
        subtitle={`${models.length} models - Copy ID to use in preferences`}
      >
        {models.map((model) => (
          <List.Item
            key={model.id}
            icon={Icon.Stars}
            title={model.name}
            subtitle={model.id}
            accessories={model.version ? [{ text: model.version }] : []}
            actions={
              <ActionPanel>
                <Action
                  title="Set as Preferred Model"
                  icon={Icon.Check}
                  onAction={() => setAsPreferredModel(model.id)}
                  shortcut={{ modifiers: ["cmd"], key: "s" }}
                />
                <Action.CopyToClipboard
                  title="Copy Model ID"
                  content={model.id}
                  shortcut={{ modifiers: ["cmd"], key: "c" }}
                />
                <Action.CopyToClipboard
                  title="Copy Model Name"
                  content={model.name}
                  shortcut={{ modifiers: ["cmd", "shift"], key: "c" }}
                />
                <Action
                  title="Refresh Models"
                  icon={Icon.ArrowClockwise}
                  onAction={loadModels}
                  shortcut={{ modifiers: ["cmd"], key: "r" }}
                />
                <Action.OpenInBrowser
                  title="Open GitHub Copilot Models Docs"
                  url="https://docs.github.com/en/copilot/using-github-copilot/asking-github-copilot-questions-in-your-ide"
                  shortcut={{ modifiers: ["cmd"], key: "o" }}
                />
              </ActionPanel>
            }
          />
        ))}
      </List.Section>
      {models.length === 0 && !loading && (
        <List.EmptyView
          icon={Icon.ExclamationMark}
          title="No Models Found"
          description="Unable to fetch models from GitHub Copilot API. Using default list."
        />
      )}
    </List>
  );
}
