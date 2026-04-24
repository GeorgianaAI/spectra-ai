export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--bg)" }}>
      <div
        className="p-8 rounded-lg border max-w-md text-center"
        style={{ background: "var(--surface)", borderColor: "var(--border)" }}
      >
        <div className="mb-4 text-5xl font-bold" style={{ color: "var(--accent)" }}>
          404
        </div>
        <h1 className="text-xl font-semibold mb-2" style={{ color: "var(--text-primary)" }}>
          Page not found
        </h1>
        <p className="mb-6" style={{ color: "var(--text-secondary)" }}>
          The page you're looking for doesn't exist.
        </p>
        <a
          href="/dashboard"
          className="inline-block px-6 py-2 rounded font-medium transition-colors"
          style={{ background: "var(--accent)", color: "var(--bg)" }}
        >
          Back to Dashboard
        </a>
      </div>
    </div>
  );
}
