-- Add Fathom recording URL to B2B sales tracker rows
ALTER TABLE b2b_sales_tracker
  ADD COLUMN IF NOT EXISTS fathom_url text;
