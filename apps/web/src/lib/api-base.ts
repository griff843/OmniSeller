import { requireUser } from './requireUser';

export const API_BASE_URL = process.env.OMNISELLER_API_BASE_URL ?? 'http://localhost:3001';

export function internalApiHeaders(userId: string, headers?: HeadersInit): HeadersInit {
  const internalSecret = process.env.OMNISELLER_API_INTERNAL_SECRET;

  if (!internalSecret) {
    throw new Error('OMNISELLER_API_INTERNAL_SECRET is required for server-to-server API requests');
  }

  return {
    'Content-Type': 'application/json',
    'x-omniseller-user-id': userId,
    'x-omniseller-internal-secret': internalSecret,
    ...(headers ?? {}),
  };
}

export class ApiRequestError extends Error {
  constructor(
    public readonly status: number,
    public readonly path: string,
    message?: string,
  ) {
    super(message ?? `API request failed: ${status}`);
    this.name = 'ApiRequestError';
  }
}

export async function fetchApi<T>(path: string, init?: RequestInit): Promise<T> {
  const user = await requireUser();
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    cache: 'no-store',
    headers: internalApiHeaders(user.id, init?.headers),
  });

  if (!response.ok) {
    let message = `API request failed: ${response.status}`;

    try {
      const text = await response.text();
      if (text) {
        message = text;
      }
    } catch {
      // Keep the status-based fallback when the body cannot be read.
    }

    throw new ApiRequestError(response.status, path, message);
  }

  return (await response.json()) as T;
}

export async function proxyApi(
  path: string,
  init?: RequestInit,
): Promise<Response> {
  const user = await requireUser();
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: internalApiHeaders(user.id, init?.headers),
  });

  const text = await response.text();

  return new Response(text, {
    status: response.status,
    headers: {
      'Content-Type': response.headers.get('content-type') ?? 'application/json',
    },
  });
}
