-- Fix sync_run_items.account_id FK — drop the reference to accounts
-- and repurpose the column to hold clients.id instead.
-- We use clients as the primary entity; the separate accounts table is unused.

ALTER TABLE sync_run_items DROP CONSTRAINT IF EXISTS sync_run_items_account_id_fkey;

-- Re-add as FK to clients
ALTER TABLE sync_run_items
  ADD CONSTRAINT sync_run_items_client_id_fkey
  FOREIGN KEY (account_id) REFERENCES clients(id) ON DELETE CASCADE;
