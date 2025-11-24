type WithMessage = { message: string };

export function hasMessage(x: unknown): x is WithMessage {
  if (typeof x !== "object" || x === null) return false;

  const obj = x as Record<string, unknown>;
  return typeof obj.message === "string";
}
