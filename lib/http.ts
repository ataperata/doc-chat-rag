export class HttpError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "HttpError";
    this.status = status;
  }
}

export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigError";
  }
}

export function jsonError(message: string, status: number) {
  return Response.json({ error: message }, { status });
}

export function publicError(error: unknown, fallback: string) {
  if (error instanceof HttpError) return jsonError(error.message, error.status);
  if (error instanceof ConfigError) return jsonError(error.message, 500);
  console.error(error);
  return jsonError(fallback, 500);
}
