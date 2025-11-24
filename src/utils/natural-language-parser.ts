export interface ParsedTimeEntry {
  issueKey: string;
  durationSeconds: number;
  startTime?: string;
  description?: string;
}

function extractIssueKey(input: string): string | null {
  const match = input.match(/\b([A-Z][A-Z0-9]+-\d+)\b/i);
  return match ? match[1].toUpperCase() : null;
}

function parseDuration(input: string): number | null {
  let text = input.replace(/\b[A-Z][A-Z0-9]+-\d+\b/gi, "");
  text = text.replace(/@\s*\d{1,2}(:\d{2})?\s*(am|pm)?/gi, "");

  const hoursMinutes = text.match(/(\d+(?:\.\d+)?)\s*h(?:ours?)?\s*(\d+)?\s*m(?:in(?:ute)?s?)?/i);
  if (hoursMinutes) {
    const hours = parseFloat(hoursMinutes[1]);
    const minutes = hoursMinutes[2] ? parseInt(hoursMinutes[2], 10) : 0;
    return Math.round(hours * 3600 + minutes * 60);
  }

  const hoursOnly = text.match(/(\d+(?:\.\d+)?)\s*h(?:ours?)?/i);
  if (hoursOnly) {
    return Math.round(parseFloat(hoursOnly[1]) * 3600);
  }

  const minutesOnly = text.match(/(\d+)\s*m(?:in(?:ute)?s?)?/i);
  if (minutesOnly) {
    return parseInt(minutesOnly[1], 10) * 60;
  }

  return null;
}

function parseStartTime(input: string): string | null {
  const timeMatch = input.match(/@\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
  if (!timeMatch) return null;

  let hours = parseInt(timeMatch[1], 10);
  const minutes = timeMatch[2] ? parseInt(timeMatch[2], 10) : 0;
  const meridiem = timeMatch[3]?.toLowerCase();

  if (meridiem === "pm" && hours < 12) {
    hours += 12;
  } else if (meridiem === "am" && hours === 12) {
    hours = 0;
  }

  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    return null;
  }

  return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:00`;
}

function extractDescription(input: string): string {
  let text = input.replace(/\b[A-Z][A-Z0-9]+-\d+\b/gi, "");
  text = text.replace(/\d+(?:\.\d+)?\s*h(?:ours?)?\s*\d*\s*m(?:in(?:ute)?s?)?/gi, "");
  text = text.replace(/\d+(?:\.\d+)?\s*h(?:ours?)?/gi, "");
  text = text.replace(/\d+\s*m(?:in(?:ute)?s?)?/gi, "");
  text = text.replace(/@\s*\d{1,2}(:\d{2})?\s*(am|pm)?/gi, "");
  text = text.trim();
  text = text.replace(/^[-–—,;:.]\s*/, "");

  return text;
}

export function parseTimeEntry(input: string): ParsedTimeEntry | null {
  if (!input || input.trim().length === 0) {
    return null;
  }

  const issueKey = extractIssueKey(input);
  if (!issueKey) {
    return null;
  }

  const durationSeconds = parseDuration(input);
  if (!durationSeconds || durationSeconds <= 0) {
    return null;
  }

  const startTime = parseStartTime(input);
  const description = extractDescription(input);

  return {
    issueKey,
    durationSeconds,
    startTime: startTime || undefined,
    description: description || undefined,
  };
}

export function formatParsedEntry(entry: ParsedTimeEntry): string {
  const hours = Math.floor(entry.durationSeconds / 3600);
  const minutes = Math.floor((entry.durationSeconds % 3600) / 60);

  let duration = "";
  if (hours > 0 && minutes > 0) {
    duration = `${hours}h ${minutes}m`;
  } else if (hours > 0) {
    duration = `${hours}h`;
  } else {
    duration = `${minutes}m`;
  }

  let time = "";
  if (entry.startTime) {
    const [h, m] = entry.startTime.split(":");
    const hour = parseInt(h, 10);
    const minute = m;
    const ampm = hour >= 12 ? "PM" : "AM";

    let displayHour = hour;
    if (hour === 0) {
      displayHour = 12;
    } else if (hour > 12) {
      displayHour = hour - 12;
    }

    time = ` @ ${displayHour}:${minute} ${ampm}`;
  }

  const desc = entry.description ? ` - ${entry.description}` : "";

  return `${entry.issueKey}: ${duration}${time}${desc}`;
}

export function validateParsedEntry(entry: ParsedTimeEntry | null): string | null {
  if (!entry) {
    return "Could not parse input. Format: ISSUE-123 2h description or ISSUE-123 30m @ 9am description";
  }

  if (!entry.issueKey || !/^[A-Z][A-Z0-9]+-\d+$/i.test(entry.issueKey)) {
    return "Invalid issue key format. Expected: ABC-123";
  }

  if (!entry.durationSeconds || entry.durationSeconds <= 0) {
    return "Invalid duration. Use formats like: 2h, 30m, 2h30m, 1.5h";
  }

  if (entry.durationSeconds > 24 * 3600) {
    return "Duration cannot exceed 24 hours";
  }

  return null;
}
