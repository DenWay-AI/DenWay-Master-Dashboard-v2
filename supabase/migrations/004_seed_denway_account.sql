-- Migration 004: Seed DenWay account
-- This creates the initial account for DenWay B2B

-- Insert DenWay account (idempotent - uses ON CONFLICT)
INSERT INTO accounts (id, type, name, is_active)
VALUES (
  'a0000000-0000-0000-0000-000000000001',
  'DENWAY_B2B',
  'DenWay',
  true
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  is_active = EXCLUDED.is_active,
  updated_at = NOW();

-- NOTE: After running this migration, you need to add your GHL location ID:
-- 
-- INSERT INTO account_sources (account_id, source, external_id, is_active)
-- VALUES (
--   'a0000000-0000-0000-0000-000000000001',
--   'GHL',
--   'YOUR_GHL_LOCATION_ID_HERE',
--   true
-- )
-- ON CONFLICT (account_id, source) DO UPDATE SET
--   external_id = EXCLUDED.external_id,
--   is_active = EXCLUDED.is_active,
--   updated_at = NOW();
