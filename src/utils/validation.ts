const ISSUE_KEY_PATTERN = /^[A-Z][A-Z0-9]+-\d+$/i;

export function validateIssueKey(key: string): boolean {
  return ISSUE_KEY_PATTERN.test(key.trim());
}

export function getIssueKeyError(key: string): string | null {
  if (!key.trim()) {
    return "Issue key is required";
  }
  if (!validateIssueKey(key)) {
    return "Invalid issue key format (expected: ABC-123)";
  }
  return null;
}

export function validateDuration(seconds: number): string | null {
  if (seconds <= 0) {
    return "Duration must be greater than 0";
  }
  if (seconds > 24 * 3600) {
    return "Duration cannot exceed 24 hours";
  }
  return null;
}
