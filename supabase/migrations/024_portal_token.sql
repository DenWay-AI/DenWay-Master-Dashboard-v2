-- Add secret token to clients for login-free portal access
ALTER TABLE clients ADD COLUMN IF NOT EXISTS portal_token TEXT UNIQUE;

-- Generate tokens for all existing clients
UPDATE clients SET portal_token = encode(gen_random_bytes(24), 'hex') WHERE portal_token IS NULL;

ALTER TABLE clients ALTER COLUMN portal_token SET NOT NULL;

-- Auto-generate token on new client insert
CREATE OR REPLACE FUNCTION set_portal_token()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.portal_token IS NULL THEN
    NEW.portal_token := encode(gen_random_bytes(24), 'hex');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_set_portal_token ON clients;
CREATE TRIGGER trg_set_portal_token
  BEFORE INSERT ON clients
  FOR EACH ROW EXECUTE FUNCTION set_portal_token();
