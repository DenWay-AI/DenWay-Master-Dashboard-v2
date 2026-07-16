ALTER TABLE b2b_sales_tracker
  ADD COLUMN IF NOT EXISTS client_id uuid REFERENCES clients(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS b2b_sales_tracker_client_id_idx ON b2b_sales_tracker(client_id);

-- Auto-match existing records: link closed/valued deals to clients by company name
-- Run this after migration to seed initial links, then review in Settings → Sales Pipeline Links
-- UPDATE b2b_sales_tracker bst
-- SET client_id = c.id
-- FROM clients c
-- WHERE bst.client_id IS NULL
--   AND (
--     lower(trim(bst.company_name)) = lower(trim(c.name))
--     OR lower(trim(c.name)) ILIKE '%' || lower(trim(bst.company_name)) || '%'
--     OR lower(trim(bst.company_name)) ILIKE '%' || lower(trim(c.name)) || '%'
--   );
--
-- Preview first (uncomment SELECT to check before running UPDATE):
-- SELECT bst.id, bst.company_name, bst.call_outcome, bst.contract_value, c.name as matched_client
-- FROM b2b_sales_tracker bst
-- JOIN clients c ON (
--   lower(trim(bst.company_name)) = lower(trim(c.name))
--   OR lower(trim(c.name)) ILIKE '%' || lower(trim(bst.company_name)) || '%'
--   OR lower(trim(bst.company_name)) ILIKE '%' || lower(trim(c.name)) || '%'
-- )
-- WHERE bst.client_id IS NULL
-- ORDER BY bst.appointment_date DESC;
