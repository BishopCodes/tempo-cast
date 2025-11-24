import { Form, getPreferenceValues } from "@raycast/api";
import React, { useState } from "react";

interface TimeEntryFieldsProps {
  showDuration?: boolean;
  showStartTime?: boolean;
  durationLabel?: string;
  startTimeLabel?: string;
  onDurationChange?: (seconds: number) => void;
  onStartTimeChange?: (time: string) => void;
}

interface Preferences {
  timeInputMethod?: "dropdown" | "text";
}

const HOUR_OPTIONS = Array.from({ length: 9 }, (_, i) => i);
const MINUTE_OPTIONS = [0, 15, 30, 45, 5, 10, 20, 25, 35, 40, 50, 55];
const HOURS_IN_DAY = Array.from({ length: 24 }, (_, i) => i);

export function TimeEntryFields({
  showDuration = true,
  showStartTime = true,
  durationLabel = "Duration",
  startTimeLabel = "Start Time",
  onDurationChange,
  onStartTimeChange,
}: TimeEntryFieldsProps) {
  const prefs = getPreferenceValues<Preferences>();
  const inputMethod = prefs.timeInputMethod || "dropdown";
  
  const [hoursVal, setHoursVal] = useState("0");
  const [minutesVal, setMinutesVal] = useState("30");
  const [startHourVal, setStartHourVal] = useState("09");
  const [startMinuteVal, setStartMinuteVal] = useState("00");

  const handleDurationChange = (hours: string, minutes: string) => {
    if (onDurationChange) {
      const h = parseInt(hours || "0", 10) || 0;
      const m = parseInt(minutes || "0", 10) || 0;
      onDurationChange((h * 60 + m) * 60);
    }
  };

  const handleStartTimeChange = (hour: string, minute: string) => {
    if (onStartTimeChange) {
      const h = hour.padStart(2, "0");
      const m = minute.padStart(2, "0");
      onStartTimeChange(`${h}:${m}:00`);
    }
  };

  const formatHour = (hour: number): string => {
    if (hour === 0) return "12 AM";
    if (hour < 12) return `${hour} AM`;
    if (hour === 12) return "12 PM";
    return `${hour - 12} PM`;
  };

  return (
    <>
      {showDuration && (
        <>
          {inputMethod === "dropdown" ? (
            <>
              <Form.Separator />
              <Form.Description title={durationLabel} text="How much time did you work?" />
              <Form.Dropdown
                id="hours"
                title="Hours"
                value={hoursVal}
                storeValue
                onChange={(val) => {
                  setHoursVal(val);
                  handleDurationChange(val, minutesVal);
                }}
              >
                {HOUR_OPTIONS.map((h) => (
                  <Form.Dropdown.Item key={h} value={h.toString()} title={`${h} hours`} />
                ))}
              </Form.Dropdown>
              <Form.Dropdown
                id="minutes"
                title="Minutes"
                value={minutesVal}
                storeValue
                onChange={(val) => {
                  setMinutesVal(val);
                  handleDurationChange(hoursVal, val);
                }}
              >
                {MINUTE_OPTIONS.map((m) => (
                  <Form.Dropdown.Item key={m} value={m.toString()} title={`${m} minutes`} />
                ))}
              </Form.Dropdown>
            </>
          ) : (
            <>
              <Form.Separator />
              <Form.TextField
                id="duration"
                title={durationLabel}
                placeholder="e.g. 1h 30m, 90m, or 1:30"
                info="Enter duration as: hours and minutes (1h 30m), total minutes (90m), or time format (1:30)"
                onChange={(val) => {
                  if (onDurationChange) {
                    try {
                      const secs = parseDuration(val || "");
                      onDurationChange(secs);
                    } catch {
                      onDurationChange(0);
                    }
                  }
                }}
              />
            </>
          )}
        </>
      )}

      {showStartTime && (
        <>
          {inputMethod === "dropdown" ? (
            <>
              <Form.Separator />
              <Form.Description title={startTimeLabel} text="What time did you start working?" />
              <Form.Dropdown
                id="startHour"
                title="Hour"
                value={startHourVal}
                storeValue
                onChange={(val) => {
                  setStartHourVal(val);
                  handleStartTimeChange(val, startMinuteVal);
                }}
              >
                {HOURS_IN_DAY.map((h) => (
                  <Form.Dropdown.Item
                    key={h}
                    value={h.toString().padStart(2, "0")}
                    title={`${h.toString().padStart(2, "0")}:00 (${formatHour(h)})`}
                  />
                ))}
              </Form.Dropdown>
              <Form.Dropdown
                id="startMinute"
                title="Minute"
                value={startMinuteVal}
                storeValue
                onChange={(val) => {
                  setStartMinuteVal(val);
                  handleStartTimeChange(startHourVal, val);
                }}
              >
                {MINUTE_OPTIONS.map((m) => (
                  <Form.Dropdown.Item
                    key={m}
                    value={m.toString().padStart(2, "0")}
                    title={`:${m.toString().padStart(2, "0")}`}
                  />
                ))}
              </Form.Dropdown>
            </>
          ) : (
            <>
              <Form.Separator />
              <Form.TextField
                id="startTime"
                title={startTimeLabel}
                placeholder="e.g. 09:00, 14:30, 9:00"
                info="Enter time in 24-hour format (HH:mm) like 09:00 or 14:30"
                onChange={(val) => {
                  if (onStartTimeChange) {
                    const time = val || "09:00";
                    const [h, m] = time.split(":");
                    if (h && m) onStartTimeChange(`${h.padStart(2, "0")}:${m.padStart(2, "0")}:00`);
                  }
                }}
              />
            </>
          )}
        </>
      )}
    </>
  );
}

export interface DurationValues {
  duration?: string;
  hours?: string;
  minutes?: string;
}

export interface StartTimeValues {
  startTime?: string;
  startHour?: string;
  startMinute?: string;
}

export function parseDurationFromValues(values: DurationValues): number {
  const prefs = getPreferenceValues<Preferences>();
  const inputMethod = prefs.timeInputMethod || "dropdown";

  if (inputMethod === "dropdown") {
    const hours = parseInt(values.hours || "0", 10);
    const minutes = parseInt(values.minutes || "0", 10);
    return (hours * 60 + minutes) * 60;
  }
  return parseDuration(values.duration || "");
}

export function parseStartTimeFromValues(values: StartTimeValues): string {
  const prefs = getPreferenceValues<Preferences>();
  const inputMethod = prefs.timeInputMethod || "dropdown";

  if (inputMethod === "dropdown") {
    const startHour = (values.startHour || "09").padStart(2, "0");
    const startMinute = (values.startMinute || "00").padStart(2, "0");
    return `${startHour}:${startMinute}:00`;
  }
  
  const time = values.startTime || "09:00";
  const [hour, minute] = time.split(":");
  return `${hour.padStart(2, "0")}:${(minute || "00").padStart(2, "0")}:00`;
}

function parseDuration(input: string): number {
  const s = String(input || "").trim().toLowerCase();

  if (!s) {
    throw new Error("Duration is required");
  }

  if (/^\d+$/.test(s)) {
    return Number(s) * 60;
  }

  if (/^\d+:\d{1,2}$/.test(s)) {
    const [h, m] = s.split(":");
    return Number(h) * 3600 + Number(m) * 60;
  }

  let total = 0;
  const h = s.match(/(\d+)\s*h/);
  const m = s.match(/(\d+)\s*m/);

  if (h) total += Number(h[1]) * 3600;
  if (m) total += Number(m[1]) * 60;

  if (total === 0) {
    throw new Error("Invalid duration. Try 1h 30m, 90m, or 1:30.");
  }

  return total;
}
