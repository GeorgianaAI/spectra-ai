export type AuthEventType =
  | "login_success"
  | "login_failed"
  | "login_rate_limited"
  | "refresh_success"
  | "refresh_invalid_token"
  | "refresh_rate_limited";

export function logAuthEvent(event: { type: AuthEventType; ip: string }): void {
  console.log(
    JSON.stringify({
      timestamp: new Date().toISOString(),
      service: "spectra-auth",
      ...event,
    }),
  );
}
