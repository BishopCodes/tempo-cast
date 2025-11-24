export function formatDuration(seconds: number): string {
  const totalMinutes = Math.round(seconds / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours > 0 && minutes > 0) {
    return `${hours}h ${minutes}m`;
  }
  if (hours > 0) {
    return `${hours}h`;
  }
  return `${minutes}m`;
}

export function formatDurationDetailed(seconds: number): string {
  const hours = (seconds / 3600).toFixed(2);
  const minutes = Math.round(seconds / 60);
  return `${hours}h (${minutes}m)`;
}

export function formatTimeOfDay(time?: string): string {
  if (!time) return "";

  try {
    const [hourStr, minuteStr] = time.split(":");
    const hour = parseInt(hourStr, 10);
    const minute = minuteStr;

    if (isNaN(hour)) return "";

    const period = hour >= 12 ? "PM" : "AM";
    const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;

    return `${displayHour}:${minute} ${period}`;
  } catch {
    return "";
  }
}
