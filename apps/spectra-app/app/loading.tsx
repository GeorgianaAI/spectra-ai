export default function Loading() {
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--bg)" }}>
      <div className="text-center">
        <div
          className="w-12 h-12 mb-4 mx-auto rounded-full border-2 border-transparent animate-spin"
          style={{
            borderTopColor: "var(--accent)",
            borderRightColor: "var(--accent)",
          }}
        />
        <p style={{ color: "var(--text-secondary)" }}>Loading...</p>
      </div>
    </div>
  );
}
