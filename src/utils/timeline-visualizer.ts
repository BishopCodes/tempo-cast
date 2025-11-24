import { TempoWorklog } from "../types";

export interface TimeBlock {
  startTime: string;
  endTime: string;
  durationSeconds: number;
  issueKey: string;
  description?: string;
  isPlanned?: boolean;
}

export interface TimelineConflict {
  block1: TimeBlock;
  block2: TimeBlock;
  overlapMinutes: number;
}

function timeToMinutes(time: string): number {
  const [h, m, s] = time.split(":").map(Number);
  return h * 60 + m + (s || 0) / 60;
}

function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = Math.floor(minutes % 60);
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
}

export function calculateEndTime(startTime: string, durationSeconds: number): string {
  const startMinutes = timeToMinutes(startTime);
  const durationMinutes = durationSeconds / 60;
  const endMinutes = startMinutes + durationMinutes;
  return minutesToTime(endMinutes);
}

export function worklogsToTimeBlocks(worklogs: TempoWorklog[]): TimeBlock[] {
  return worklogs.map((log) => {
    const startTime = log.startTime || "09:00:00";
    const endTime = calculateEndTime(startTime, log.timeSpentSeconds);
    return {
      startTime,
      endTime,
      durationSeconds: log.timeSpentSeconds,
      issueKey: log.issue?.key || `#${log.issue?.id}`,
      description: log.description,
      isPlanned: false,
    };
  });
}

export function detectConflicts(blocks: TimeBlock[]): TimelineConflict[] {
  const conflicts: TimelineConflict[] = [];

  for (let i = 0; i < blocks.length; i++) {
    for (let j = i + 1; j < blocks.length; j++) {
      const block1 = blocks[i];
      const block2 = blocks[j];

      const start1 = timeToMinutes(block1.startTime);
      const end1 = timeToMinutes(block1.endTime);
      const start2 = timeToMinutes(block2.startTime);
      const end2 = timeToMinutes(block2.endTime);

      const overlapStart = Math.max(start1, start2);
      const overlapEnd = Math.min(end1, end2);

      if (overlapStart < overlapEnd) {
        const overlapMinutes = overlapEnd - overlapStart;
        conflicts.push({ block1, block2, overlapMinutes });
      }
    }
  }

  return conflicts;
}

export function generateVisualTimeline(blocks: TimeBlock[], plannedBlock?: TimeBlock): string {
  const START_HOUR = 6;
  const END_HOUR = 20;
  const SLOT_MINUTES = 30;
  const totalSlots = ((END_HOUR - START_HOUR) * 60) / SLOT_MINUTES;

  const allBlocks = plannedBlock ? [...blocks, plannedBlock] : blocks;
  const sortedBlocks = [...allBlocks].sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));

  let timeline = "**Day Timeline** (6am - 8pm)\n\n";

  const slots: Array<{ time: string; blocks: TimeBlock[] }> = [];
  for (let i = 0; i < totalSlots; i++) {
    const slotMinutes = START_HOUR * 60 + i * SLOT_MINUTES;
    const slotTime = minutesToTime(slotMinutes);
    const slotEnd = minutesToTime(slotMinutes + SLOT_MINUTES);

    const overlappingBlocks = sortedBlocks.filter((block) => {
      const blockStart = timeToMinutes(block.startTime);
      const blockEnd = timeToMinutes(block.endTime);
      return blockStart < timeToMinutes(slotEnd) && blockEnd > timeToMinutes(slotTime);
    });

    slots.push({ time: slotTime, blocks: overlappingBlocks });
  }

  for (const slot of slots) {
    if (slot.blocks.length === 0) {
      timeline += `${slot.time} │\n`;
    } else {
      const blockSymbols = slot.blocks.map((b) => (b.isPlanned ? "🟦" : "🟩")).join("");
      const blockLabels = slot.blocks.map((b) => `${b.issueKey} (${Math.round(b.durationSeconds / 60)}m)`).join(", ");

      const indicator = slot.blocks.length > 1 ? "⚠️ " : "";
      timeline += `${slot.time} │ ${indicator}${blockSymbols} ${blockLabels}\n`;
    }
  }

  timeline += "\n**Legend:**\n";
  timeline += "🟩 Existing worklogs\n";
  timeline += "🟦 New entry (planned)\n";
  timeline += "⚠️  Overlap detected\n";

  return timeline;
}

export function generateConflictSummary(conflicts: TimelineConflict[]): string {
  if (conflicts.length === 0) {
    return "✅ No time conflicts detected";
  }

  let summary = `⚠️  **${conflicts.length} conflict${conflicts.length > 1 ? "s" : ""} detected:**\n\n`;

  for (const conflict of conflicts) {
    const { block1, block2, overlapMinutes } = conflict;
    const overlapHours = overlapMinutes / 60;
    const formatted = overlapHours >= 1 ? `${overlapHours.toFixed(1)}h` : `${Math.round(overlapMinutes)}m`;

    summary += `• ${block1.issueKey} (${block1.startTime}) overlaps with ${block2.issueKey} (${block2.startTime}) by ${formatted}\n`;
  }

  return summary;
}

export function generateSimpleTimeline(blocks: TimeBlock[], plannedBlock?: TimeBlock): string {
  const allBlocks = plannedBlock ? [...blocks, plannedBlock] : blocks;
  const sortedBlocks = [...allBlocks].sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));

  let timeline = "**Today's Schedule:**\n\n";

  for (const block of sortedBlocks) {
    const duration = Math.round(block.durationSeconds / 60);
    const hours = Math.floor(duration / 60);
    const mins = duration % 60;
    const durationStr = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;

    const emoji = block.isPlanned ? "🟦" : "🟩";
    timeline += `${emoji} ${block.startTime} - ${block.endTime} (${durationStr})\n`;
    timeline += `   ${block.issueKey}`;
    if (block.description) {
      timeline += ` - ${block.description.substring(0, 40)}${block.description.length > 40 ? "..." : ""}`;
    }
    timeline += "\n\n";
  }

  return timeline;
}
