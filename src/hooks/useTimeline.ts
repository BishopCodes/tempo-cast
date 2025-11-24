import { useEffect, useState } from "react";
import { getMyWorklogs } from "../api/tempo";
import {
  worklogsToTimeBlocks,
  detectConflicts,
  generateSimpleTimeline,
  generateConflictSummary,
  calculateEndTime,
  type TimeBlock,
} from "../utils/timeline-visualizer";

interface UseTimelineProps {
  date: string;
  plannedDuration: number;
  plannedStart: string;
  issueKey?: string;
}

export function useTimeline({ date, plannedDuration, plannedStart, issueKey }: UseTimelineProps) {
  const [timeline, setTimeline] = useState("");
  const [conflictSummary, setConflictSummary] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let mounted = true;

    const loadTimeline = async () => {
      try {
        setLoading(true);
        const logs = await getMyWorklogs(date, date);
        const blocks = worklogsToTimeBlocks(logs);

        const plannedBlock: TimeBlock = {
          startTime: plannedStart,
          endTime: calculateEndTime(plannedStart, plannedDuration),
          durationSeconds: plannedDuration,
          issueKey: issueKey || "(Select issue)",
          isPlanned: true,
        };

        const allBlocks = [...blocks, plannedBlock];
        const conflicts = detectConflicts(allBlocks);

        if (mounted) {
          setTimeline(generateSimpleTimeline(blocks, plannedBlock));
          setConflictSummary(generateConflictSummary(conflicts));
        }
      } catch {
        if (mounted) {
          setTimeline("");
          setConflictSummary("");
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    loadTimeline();

    return () => {
      mounted = false;
    };
  }, [date, plannedDuration, plannedStart, issueKey]);

  return { timeline, conflictSummary, loading };
}
