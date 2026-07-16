CREATE TABLE IF NOT EXISTS calls (
  id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id            UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  ghl_message_id       TEXT UNIQUE NOT NULL,
  ghl_conversation_id  TEXT NOT NULL,
  ghl_contact_id       TEXT,
  contact_name         TEXT,
  contact_phone        TEXT,
  direction            TEXT,            -- 'inbound' | 'outbound'
  status               TEXT,            -- 'completed' | 'voicemail' | 'missed'
  duration_seconds     INTEGER,
  ghl_user_id          TEXT,            -- links to reps.ghl_user_id
  contact_created_at   TIMESTAMPTZ,     -- GHL contact creation time (for speed-to-lead)
  called_at            TIMESTAMPTZ NOT NULL,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_calls_client_called ON calls(client_id, called_at DESC);
CREATE INDEX IF NOT EXISTS idx_calls_ghl_user ON calls(ghl_user_id);
CREATE INDEX IF NOT EXISTS idx_calls_contact ON calls(ghl_contact_id);
