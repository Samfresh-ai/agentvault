export function jsonOk<T>(data: T, init?: ResponseInit) {
  return Response.json(data, init);
}

export function jsonError(message: string, code: string, status = 500, extra?: Record<string, unknown>) {
  return Response.json(
    {
      error: message,
      code,
      ...extra,
    },
    { status },
  );
}

export function parseJson(value: string) {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}
