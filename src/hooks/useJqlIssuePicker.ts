import { useCallback, useEffect, useRef, useState } from "react";
import { searchIssues } from "../api/jira";
import { loadJqlQueries, saveJqlQueries, type JqlQuery, loadLastIssueForJql, saveLastIssueForJql } from "../utils/jql";

export type IssueLite = { key: string; summary: string };

export interface UseJqlIssuePickerOptions {
  debounceMs?: number;
  autoLoadIssues?: boolean;
  previewDebounceMs?: number;
}

export function useJqlIssuePicker(options: UseJqlIssuePickerOptions = {}) {
  const { debounceMs = 500, autoLoadIssues = true, previewDebounceMs = 600 } = options;

  const [jqlQueries, setJqlQueries] = useState<JqlQuery[]>([]);
  const [selectedJql, setSelectedJql] = useState("");
  const [issues, setIssues] = useState<IssueLite[]>([]);
  const [selectedIssue, setSelectedIssue] = useState("");
  const [editingJql, setEditingJql] = useState(false);
  const [jqlEditValue, setJqlEditValue] = useState("");
  const [loadingIssues, setLoadingIssues] = useState(false);
  const [previewCount, setPreviewCount] = useState<number | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const loadTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const previewTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load stored queries + set default
  useEffect(() => {
    (async () => {
      const queries = await loadJqlQueries();
      setJqlQueries(queries);
      const def = queries.find((q) => q.isDefault) ?? queries[0];
      if (def) setSelectedJql(def.value);
    })();
  }, []);

  // Load issues for selectedJql (debounced)
  useEffect(() => {
    if (!autoLoadIssues || !selectedJql) return;
    if (loadTimer.current) clearTimeout(loadTimer.current);
    setLoadingIssues(true);
    loadTimer.current = setTimeout(async () => {
      try {
        const res = await searchIssues(selectedJql);
        const mapped = res.map((i) => ({ key: i.key, summary: i.fields.summary }));
        setIssues(mapped);
        const last = await loadLastIssueForJql(selectedJql);
        if (last && mapped.some((i) => i.key === last)) setSelectedIssue(last);
        else setSelectedIssue("");
      } catch {
        // swallow here; caller can still show toast externally if desired
        setIssues([]);
      } finally {
        setLoadingIssues(false);
      }
    }, debounceMs);
    return () => {
      if (loadTimer.current) clearTimeout(loadTimer.current);
    };
  }, [selectedJql, autoLoadIssues, debounceMs]);

  // Live preview of issue count while editing JQL
  useEffect(() => {
    if (!editingJql) {
      setPreviewCount(null);
      if (previewTimer.current) clearTimeout(previewTimer.current);
      return;
    }
    if (!jqlEditValue.trim()) {
      setPreviewCount(null);
      return;
    }
    if (previewTimer.current) clearTimeout(previewTimer.current);
    setPreviewLoading(true);
    previewTimer.current = setTimeout(async () => {
      try {
        const res = await searchIssues(jqlEditValue);
        setPreviewCount(res.length);
      } catch {
        setPreviewCount(null);
      } finally {
        setPreviewLoading(false);
      }
    }, previewDebounceMs);
    return () => {
      if (previewTimer.current) clearTimeout(previewTimer.current);
    };
  }, [editingJql, jqlEditValue, previewDebounceMs]);

  const startEdit = useCallback(() => {
    if (!selectedJql) return;
    setJqlEditValue(selectedJql);
    setEditingJql(true);
  }, [selectedJql]);

  // If user changes selectedJql while editing, reset edit state to prevent confusion
  useEffect(() => {
    if (editingJql) {
      // When switching queries mid-edit, reset editing state and adopt new query text
      setEditingJql(false);
      setPreviewCount(null);
      setJqlEditValue("");
    }
  }, [selectedJql]);

  const cancelEdit = useCallback(() => {
    setEditingJql(false);
    setPreviewCount(null);
  }, []);

  const saveEdit = useCallback(async () => {
    if (!editingJql) return;
    const updatedVal = jqlEditValue.trim();
    if (!updatedVal) throw new Error("JQL cannot be empty");
    const updated = jqlQueries.map((q) => (q.value === selectedJql ? { ...q, value: updatedVal } : q));
    await saveJqlQueries(updated);
    setJqlQueries(updated);
    setSelectedJql(updatedVal);
    setEditingJql(false);
  }, [editingJql, jqlEditValue, jqlQueries, selectedJql]);

  const persistLastIssue = useCallback(
    async (issueKey: string) => {
      if (!issueKey || !selectedJql) return;
      await saveLastIssueForJql(selectedJql, issueKey);
    },
    [selectedJql],
  );

  return {
    // state
    jqlQueries,
    selectedJql,
    setSelectedJql,
    issues,
    selectedIssue,
    setSelectedIssue,
    editingJql,
    jqlEditValue,
    setJqlEditValue,
    loadingIssues,
    previewCount,
    previewLoading,
    // actions
    startEdit,
    cancelEdit,
    saveEdit,
    persistLastIssue,
  };
}
