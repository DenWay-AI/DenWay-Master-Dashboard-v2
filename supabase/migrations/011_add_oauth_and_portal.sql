-- Migration 011: GHL OAuth token store + client portal support

-- OAuth token store (GHL now, Meta/others later)
CREATE TABLE IF NOT EXISTS oauth_tokens (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  client_id     UUID REFERENCES clients(id) ON DELETE CASCADE, -- NULL = company-level
  provider      TEXT NOT NULL,  -- 'ghl_company' | 'ghl_location'
  access_token  TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  expires_at    TIMESTAMPTZ NOT NULL,
  scope         TEXT,
  raw           JSONB,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Each client has at most one token per provider
CREATE UNIQUE INDEX IF NOT EXISTS idx_oauth_tokens_client_provider
  ON oauth_tokens(client_id, provider) WHERE client_id IS NOT NULL;

-- Company-level token: only one per provider
CREATE UNIQUE INDEX IF NOT EXISTS idx_oauth_tokens_company_provider
  ON oauth_tokens(provider) WHERE client_id IS NULL;

-- Client portal: extend user_profiles to support 'client' role
ALTER TABLE user_profiles DROP CONSTRAINT IF EXISTS user_profiles_role_check;
ALTER TABLE user_profiles ADD CONSTRAINT user_profiles_role_check
  CHECK (role IN ('admin', 'rep', 'client'));

ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES clients(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_user_profiles_client_id ON user_profiles(client_id);

-- Appointment: track whether lead became a patient (used in portal + billing)
ALTER TABLE appointments
  ADD COLUMN IF NOT EXISTS became_patient BOOLEAN DEFAULT FALSE;

-- HOW TO CREATE A PORTAL USER (run after this migration):
--
-- 1. Go to Supabase Dashboard → Auth → Users → Add User
-- 2. Then run:
--    INSERT INTO user_profiles (id, role, client_id)
--    VALUES ('USER_UUID', 'client', 'CLIENT_UUID');
--    UPDATE auth.users SET raw_user_meta_data = '{"role":"client","client_id":"CLIENT_UUID"}'
--    WHERE id = 'USER_UUID';
--
-- Or use the /api/settings/portal-users endpoint from the Settings page.
