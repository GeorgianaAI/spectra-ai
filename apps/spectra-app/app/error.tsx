"use client";

import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Error:", error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--bg)" }}>
      <div
        className="p-8 rounded-lg border max-w-md text-center"
        style={{ background: "var(--surface)", borderColor: "var(--border)" }}
      >
        <div className="mb-4 text-4xl" style={{ color: "var(--accent)" }}>
          ⚠️
        </div>
        <h1 className="text-xl font-semibold mb-2" style={{ color: "var(--text-primary)" }}>
          Something went wrong
        </h1>
        <p className="mb-6" style={{ color: "var(--text-secondary)" }}>
          An unexpected error occurred. Try again or return to the dashboard.
        </p>
        <div className="flex gap-3">
          <button
            onClick={reset}
            className="flex-1 px-4 py-2 rounded font-medium transition-colors"
            style={{ background: "var(--accent)", color: "var(--bg)" }}
          >
            Try Again
          </button>
          <a
            href="/dashboard"
            className="flex-1 px-4 py-2 rounded font-medium transition-colors border"
            style={{
              color: "var(--accent)",
              borderColor: "var(--accent)",
            }}
          >
            Dashboard
          </a>
        </div>
      </div>
    </div>
  );
}
