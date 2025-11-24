import { showToast, Toast } from "@raycast/api";

export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && error !== null && "message" in error) {
    return String(error.message);
  }
  return "An unknown error occurred";
}

export async function handleError(error: unknown, title: string): Promise<void> {
  const message = getErrorMessage(error);
  await showToast({
    style: Toast.Style.Failure,
    title,
    message,
  });
}

export async function showSuccess(title: string, message?: string): Promise<void> {
  await showToast({
    style: Toast.Style.Success,
    title,
    message,
  });
}

export async function showLoading(title: string, message?: string): Promise<void> {
  await showToast({
    style: Toast.Style.Animated,
    title,
    message,
  });
}
