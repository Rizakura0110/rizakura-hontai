import { apiErrorResponseSchema } from "@tech-inbox/contracts";

export class ApiClientError extends Error {
  readonly code: string;
  readonly requestId: string | undefined;
  readonly status: number;

  constructor(message: string, status: number, code: string, requestId?: string) {
    super(message);
    this.name = "ApiClientError";
    this.code = code;
    this.requestId = requestId;
    this.status = status;
  }
}

async function parseJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    throw new ApiClientError(
      "サーバーから正しいJSON応答を受け取れませんでした。",
      response.status,
      "INVALID_RESPONSE",
    );
  }
}

export async function assertSuccess(response: Response): Promise<unknown> {
  const body = await parseJson(response);
  if (response.ok) return body;

  const error = apiErrorResponseSchema.safeParse(body);
  if (error.success) {
    throw new ApiClientError(
      error.data.error.message,
      response.status,
      error.data.error.code,
      error.data.error.requestId,
    );
  }

  throw new ApiClientError("リクエストを完了できませんでした。", response.status, "UNKNOWN_ERROR");
}

export async function apiFetch(
  path: string,
  init: RequestInit = {},
  signal?: AbortSignal,
): Promise<Response> {
  const headers = new Headers(init.headers);
  headers.set("Accept", "application/json");

  if (init.body !== undefined && init.body !== null) {
    headers.set("Content-Type", "application/json");
    headers.set("X-Tech-Inbox-Client", "web");
  }

  const requestInit: RequestInit = {
    ...init,
    credentials: "same-origin",
    headers,
  };
  if (signal !== undefined) requestInit.signal = signal;

  return fetch(path, requestInit);
}

export function userFacingError(error: unknown): string {
  if (error instanceof ApiClientError) return error.message;
  if (error instanceof DOMException && error.name === "AbortError") return "";
  return "通信に失敗しました。時間をおいて再度お試しください。";
}
