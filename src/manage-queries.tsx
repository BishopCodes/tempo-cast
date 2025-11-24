import { Action, ActionPanel, Form, Icon } from "@raycast/api";
import { useEffect, useState } from "react";
import { loadJqlQueries, addJqlQuery, removeJqlQuery, setDefaultJql, saveJqlQueries, JqlQuery } from "./utils/jql";
import { handleError, showSuccess } from "./utils/error-handling";

export default function ManageQueries() {
  const [jqlQueries, setJqlQueries] = useState<JqlQuery[]>([]);
  const [newTitle, setNewTitle] = useState("");
  const [newJql, setNewJql] = useState("");
  const [selectedIdx, setSelectedIdx] = useState<number>(0);
  const [editTitle, setEditTitle] = useState("");
  const [editJql, setEditJql] = useState("");

  useEffect(() => {
    loadJqlQueries().then((queries) => {
      setJqlQueries(queries);
      setSelectedIdx(0);
      setEditTitle(queries[0]?.title ?? "");
      setEditJql(queries[0]?.value ?? "");
    });
  }, []);

  useEffect(() => {
    if (jqlQueries.length > 0) {
      setEditTitle(jqlQueries[selectedIdx]?.title ?? "");
      setEditJql(jqlQueries[selectedIdx]?.value ?? "");
    }
  }, [selectedIdx, jqlQueries]);

  async function handleAddQuery() {
    try {
      if (!newTitle.trim() || !newJql.trim()) {
        throw new Error("Title and JQL are required");
      }
      await addJqlQuery({ title: newTitle, value: newJql });
      const queries = await loadJqlQueries();
      setJqlQueries(queries);
      setNewTitle("");
      setNewJql("");
      setSelectedIdx(queries.length - 1);
      await showSuccess("Query added!");
    } catch (error) {
      await handleError(error, "Failed to add query");
    }
  }

  async function handleRemoveQuery() {
    try {
      await removeJqlQuery(selectedIdx);
      const queries = await loadJqlQueries();
      setJqlQueries(queries);
      setSelectedIdx(0);
      await showSuccess("Query removed!");
    } catch (error) {
      await handleError(error, "Failed to remove query");
    }
  }

  async function handleSetDefault() {
    try {
      await setDefaultJql(selectedIdx);
      setJqlQueries(await loadJqlQueries());
      await showSuccess("Default set!");
    } catch (error) {
      await handleError(error, "Failed to set default");
    }
  }

  async function handleSaveEdit() {
    try {
      if (!editTitle.trim() || !editJql.trim()) {
        throw new Error("Title and JQL are required");
      }
      const updatedQueries = [...jqlQueries];
      updatedQueries[selectedIdx] = {
        ...updatedQueries[selectedIdx],
        title: editTitle,
        value: editJql,
      };
      await saveJqlQueries(updatedQueries);
      setJqlQueries(await loadJqlQueries());
      await showSuccess("Query updated!");
    } catch (error) {
      await handleError(error, "Failed to save query");
    }
  }

  return (
    <Form
      actions={
        <ActionPanel>
          <Action title="Add Query" icon={Icon.Plus} onAction={handleAddQuery} />
          {jqlQueries.length > 0 && (
            <>
              <Action title="Save" icon={Icon.Checkmark} onAction={handleSaveEdit} />
              <Action title="Remove" icon={Icon.Minus} onAction={handleRemoveQuery} />
              {!jqlQueries[selectedIdx]?.isDefault && (
                <Action title="Set as Default" icon={Icon.Star} onAction={handleSetDefault} />
              )}
            </>
          )}
        </ActionPanel>
      }
    >
      <Form.Description text="Add a new JQL query:" />
      <Form.TextField
        id="newTitle"
        title="Query Title"
        value={newTitle}
        onChange={setNewTitle}
        placeholder="Enter a title for this query"
      />
      <Form.TextField id="newJql" title="JQL" value={newJql} onChange={setNewJql} placeholder="Enter JQL query" />

      <Form.Separator />

      <Form.Description text="Manage your saved queries:" />
      {jqlQueries.length > 0 && (
        <>
          <Form.Dropdown
            id="selectQuery"
            title="Select Query"
            value={String(selectedIdx)}
            onChange={(idx) => setSelectedIdx(Number(idx))}
          >
            {jqlQueries.map((q, idx) => (
              <Form.Dropdown.Item
                key={q.value}
                value={String(idx)}
                title={q.title + (q.isDefault ? " (Default)" : "")}
              />
            ))}
          </Form.Dropdown>
          <Form.TextField id="editTitle" title="Edit Title" value={editTitle} onChange={setEditTitle} />
          <Form.TextField id="editJql" title="Edit JQL" value={editJql} onChange={setEditJql} />
        </>
      )}
      {jqlQueries.length === 0 && <Form.Description text="No queries saved yet." />}
    </Form>
  );
}
