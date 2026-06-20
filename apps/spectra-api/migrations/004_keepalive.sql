-- Single-row table written by the Inngest keepalive function (Mon/Wed/Fri).
-- Prevents Supabase free-tier project archival via unambiguous DB write activity.
CREATE TABLE IF NOT EXISTS _keepalive (
  id       int PRIMARY KEY DEFAULT 1,
  pinged_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO _keepalive (id, pinged_at) VALUES (1, now())
  ON CONFLICT (id) DO UPDATE SET pinged_at = now();
