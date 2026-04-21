// Constructs a minimal Request object for unit-testing Next.js route handlers.

export function makeTestRequest(
  path: string,
  options?: { method?: string; headers?: Record<string, string> },
): Request {
  return new Request(`http://localhost:3000${path}`, {
    method: options?.method ?? "GET",
    headers: options?.headers ?? {},
  });
}
